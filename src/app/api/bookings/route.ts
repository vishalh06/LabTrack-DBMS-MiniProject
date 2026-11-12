import { connection } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { ApiError, apiError, checkOrigin, requireUser } from "@/lib/api";

interface EquipmentRow extends RowDataPacket {
  equipment_id: number;
  equipment_status: string;
}

interface BookingRow extends RowDataPacket {
  booking_id: number;
  equipment_id: number;
  booking_date: string;
  due_date: string;
  booking_status: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

const requestSchema = z.object({
  equipment_id: z.number().int().positive(),
  booking_date: z.iso.date(),
  due_date: z.iso.date(),
}).refine(
  (value) => value.due_date >= value.booking_date,
  { message: "Due date must not precede booking date." },
);

const actionSchema = z.object({
  booking_id: z.number().int().positive(),
  action: z.enum(["approve", "reject", "issue", "return"]),
});

export async function GET() {
  await connection();
  try {
    const user = await requireUser(["Student", "Staff"]);
    const condition = user.user_role === "Student" ? "WHERE b.user_id = ?" : "";
    const values = user.user_role === "Student" ? [user.user_id] : [];
    const [bookings] = await getDb().execute(
      `SELECT b.*, u.user_name, e.equipment_name, l.lab_name,
              (b.booking_status = 'Issued' AND b.due_date < CURDATE()) AS overdue
       FROM bookings b
       JOIN users u ON u.user_id = b.user_id
       JOIN equipment e ON e.equipment_id = b.equipment_id
       JOIN laboratories l ON l.lab_id = e.lab_id
       ${condition}
       ORDER BY b.booking_id DESC`,
      values,
    );
    return NextResponse.json(
      { bookings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let connection;
  try {
    checkOrigin(request);
    const user = await requireUser(["Student"]);
    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new ApiError("Provide valid equipment and dates; due date must be on or after booking date.");
    }
    const data = parsed.data;
    connection = await getDb().getConnection();
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();

    const [today] = await connection.query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today",
    );
    if (data.booking_date < today[0].today) {
      throw new ApiError("Booking cannot start in the past.");
    }

    const [equipment] = await connection.execute<EquipmentRow[]>(
      "SELECT equipment_id, equipment_status FROM equipment WHERE equipment_id = ? FOR UPDATE",
      [data.equipment_id],
    );
    if (!equipment.length) throw new ApiError("Equipment not found.", 404);

    const [faults] = await connection.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM fault_reports WHERE equipment_id = ? AND fault_status <> 'Resolved'",
      [data.equipment_id],
    );
    if (faults[0].count || equipment[0].equipment_status === "Under Repair") {
      throw new ApiError("This equipment is under repair.", 409);
    }

    const [conflicts] = await connection.execute<CountRow[]>(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE equipment_id = ? AND (
         booking_status = 'Issued'
         OR (booking_status = 'Approved' AND booking_date <= ? AND due_date >= ?)
         OR (booking_status = 'Pending' AND user_id = ?
             AND booking_date <= ? AND due_date >= ?)
       )`,
      [data.equipment_id, data.due_date, data.booking_date,
       user.user_id, data.due_date, data.booking_date],
    );
    if (conflicts[0].count) {
      throw new ApiError("Equipment is issued, reserved for these dates, or you already have an overlapping request.", 409);
    }

    await connection.execute(
      `INSERT INTO bookings (user_id, equipment_id, booking_date, due_date)
       VALUES (?, ?, ?, ?)`,
      [user.user_id, data.equipment_id, data.booking_date, data.due_date],
    );
    await connection.commit();
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    return apiError(error);
  } finally {
    connection?.release();
  }
}

export async function PATCH(request: Request) {
  let connection;
  try {
    checkOrigin(request);
    await requireUser(["Staff"]);
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new ApiError("Invalid booking action.");
    const { booking_id, action } = parsed.data;

    connection = await getDb().getConnection();
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();

    const [initial] = await connection.execute<BookingRow[]>(
      "SELECT * FROM bookings WHERE booking_id = ?", [booking_id],
    );
    if (!initial.length) throw new ApiError("Booking not found.", 404);
    const equipmentId = initial[0].equipment_id;

    // Every booking mutation locks equipment before locking the booking.
    const [equipment] = await connection.execute<EquipmentRow[]>(
      "SELECT * FROM equipment WHERE equipment_id = ? FOR UPDATE",
      [equipmentId],
    );
    const [rows] = await connection.execute<BookingRow[]>(
      "SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE", [booking_id],
    );
    if (!rows.length || !equipment.length) {
      throw new ApiError("Booking or equipment not found.", 404);
    }
    const booking = rows[0];

    const requiredStatus = {
      approve: "Pending",
      reject: "Pending",
      issue: "Approved",
      return: "Issued",
    }[action];
    if (booking.booking_status !== requiredStatus) {
      throw new ApiError("This action is not valid for the current booking status.", 409);
    }

    const [faults] = await connection.execute<CountRow[]>(
      "SELECT COUNT(*) AS count FROM fault_reports WHERE equipment_id = ? AND fault_status <> 'Resolved'",
      [equipmentId],
    );

    if (action === "approve" || action === "issue") {
      await connection.execute(
        "CALL sp_validate_allocation(?, ?)",
        [booking_id, action],
      );
    }

    if (action === "return") {
      await connection.execute(
        "UPDATE bookings SET booking_status = 'Returned', return_date = CURDATE() WHERE booking_id = ?",
        [booking_id],
      );
      await connection.execute(
        "UPDATE equipment SET equipment_status = ? WHERE equipment_id = ?",
        [faults[0].count ? "Under Repair" : "Available", equipmentId],
      );
    } else {
      const nextStatus = {
        approve: "Approved", reject: "Rejected", issue: "Issued",
      }[action];
      await connection.execute(
        "UPDATE bookings SET booking_status = ? WHERE booking_id = ?",
        [nextStatus, booking_id],
      );
      if (action === "issue") {
        await connection.execute(
          "UPDATE equipment SET equipment_status = 'Issued' WHERE equipment_id = ?",
          [equipmentId],
        );
      }
    }

    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    return apiError(error);
  } finally {
    connection?.release();
  }
}