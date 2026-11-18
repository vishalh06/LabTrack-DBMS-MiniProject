import { connection, NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { ApiError, apiError, checkOrigin, requireUser } from "@/lib/api";

interface EquipmentRow extends RowDataPacket {
  equipment_id: number;
  equipment_status: string;
}

interface FaultRow extends RowDataPacket {
  fault_id: number;
  equipment_id: number;
  technician_id: number | null;
  fault_status: "Reported" | "Under Repair" | "Resolved";
}

interface CountRow extends RowDataPacket {
  count: number;
}

const idSchema = z.number().int().positive();

const reportSchema = z.object({
  equipment_id: idSchema,
  description: z.string().trim().min(5).max(500),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    fault_id: idSchema,
    technician_id: idSchema,
  }),
  z.object({ action: z.literal("resolve"), fault_id: idSchema }),
]);

const statusSchema = z.enum(["Reported", "Under Repair", "Resolved"]);

export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(["Student", "Staff", "Technician"]);
    const rawStatus = new URL(request.url).searchParams.get("status");
    const status = rawStatus ? statusSchema.safeParse(rawStatus) : null;
    if (status && !status.success) throw new ApiError("Invalid status filter.");

    const conditions: string[] = [];
    const values: (string | number)[] = [];
    if (user.user_role === "Student") {
      conditions.push("reported_by = ?");
      values.push(user.user_id);
    } else if (user.user_role === "Technician") {
      conditions.push("technician_id = ?");
      values.push(user.user_id);
    }
    if (status?.success) {
      conditions.push("fault_status = ?");
      values.push(status.data);
    }

    const [faults] = await getDb().execute(
      `SELECT fault_id, equipment_id, equipment_name, lab_name,
              reported_by, reporter_name, technician_id, technician_name,
              fault_description, reported_date, assigned_date, resolved_date,
              fault_status, age_days
       FROM vw_fault_details
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY (fault_status = 'Resolved'), fault_id DESC`,
      values,
    );

    let technicians: RowDataPacket[] = [];
    if (user.user_role === "Staff") {
      const [rows] = await getDb().query<RowDataPacket[]>(
        `SELECT technician_id, technician_name, open_faults
         FROM vw_technician_workload ORDER BY technician_name`,
      );
      technicians = rows;
    }

    return NextResponse.json(
      { faults, technicians },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  let conn;
  try {
    checkOrigin(request);
    const user = await requireUser(["Student", "Staff"]);
    const parsed = reportSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new ApiError("Choose equipment and describe the fault in 5 to 500 characters.");
    }
    const data = parsed.data;

    conn = await getDb().getConnection();
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();

    // Every fault/booking mutation locks the equipment row first.
    const [equipment] = await conn.execute<EquipmentRow[]>(
      "SELECT equipment_id, equipment_status FROM equipment WHERE equipment_id = ? FOR UPDATE",
      [data.equipment_id],
    );
    if (!equipment.length) throw new ApiError("Equipment not found.", 404);

    const [duplicates] = await conn.execute<CountRow[]>(
      `SELECT COUNT(*) AS count FROM fault_reports
       WHERE equipment_id = ? AND reported_by = ?
         AND fault_description = ? AND fault_status <> 'Resolved'`,
      [data.equipment_id, user.user_id, data.description],
    );
    if (duplicates[0].count) {
      throw new ApiError("You have already reported this fault and it is still open.", 409);
    }

    const [inserted] = await conn.execute<ResultSetHeader>(
      `INSERT INTO fault_reports
       (equipment_id, reported_by, fault_description, reported_date)
       VALUES (?, ?, ?, CURDATE())`,
      [data.equipment_id, user.user_id, data.description],
    );

    // An issued item stays Issued so the outstanding issue is not erased;
    // the return workflow moves it to Under Repair afterwards.
    if (equipment[0].equipment_status === "Available") {
      await conn.execute(
        "UPDATE equipment SET equipment_status = 'Under Repair' WHERE equipment_id = ?",
        [data.equipment_id],
      );
    }

    await conn.commit();
    return NextResponse.json(
      { success: true, fault_id: inserted.insertId },
      { status: 201 },
    );
  } catch (error) {
    if (conn) await conn.rollback();
    return apiError(error);
  } finally {
    conn?.release();
  }
}

export async function PATCH(request: Request) {
  let conn;
  try {
    checkOrigin(request);
    const user = await requireUser(["Staff", "Technician"]);
    const parsed = actionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) throw new ApiError("Invalid fault action.");
    const data = parsed.data;

    if (data.action === "assign" && user.user_role !== "Staff") {
      throw new ApiError("Only staff can assign technicians.", 403);
    }
    if (data.action === "resolve" && user.user_role !== "Technician") {
      throw new ApiError("Only the assigned technician can resolve a fault.", 403);
    }

    conn = await getDb().getConnection();
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();

    const [initial] = await conn.execute<FaultRow[]>(
      "SELECT fault_id, equipment_id FROM fault_reports WHERE fault_id = ?",
      [data.fault_id],
    );
    if (!initial.length) throw new ApiError("Fault not found.", 404);
    const equipmentId = initial[0].equipment_id;

    // Lock order: equipment first, then the fault (same as bookings).
    const [equipment] = await conn.execute<EquipmentRow[]>(
      "SELECT equipment_id, equipment_status FROM equipment WHERE equipment_id = ? FOR UPDATE",
      [equipmentId],
    );
    const [rows] = await conn.execute<FaultRow[]>(
      "SELECT * FROM fault_reports WHERE fault_id = ? FOR UPDATE",
      [data.fault_id],
    );
    if (!rows.length || !equipment.length) throw new ApiError("Fault not found.", 404);
    const fault = rows[0];

    if (data.action === "assign") {
      if (fault.fault_status === "Resolved") {
        throw new ApiError("A resolved fault cannot be reassigned.", 409);
      }
      const [technicians] = await conn.execute<RowDataPacket[]>(
        "SELECT user_id FROM users WHERE user_id = ? AND user_role = 'Technician'",
        [data.technician_id],
      );
      if (!technicians.length) throw new ApiError("Choose a valid technician.");
      if (fault.technician_id === data.technician_id) {
        throw new ApiError("This technician is already assigned.", 409);
      }

      await conn.execute(
        "UPDATE fault_reports SET technician_id = ?, fault_status = 'Under Repair' WHERE fault_id = ?",
        [data.technician_id, data.fault_id],
      );
      if (equipment[0].equipment_status === "Available") {
        await conn.execute(
          "UPDATE equipment SET equipment_status = 'Under Repair' WHERE equipment_id = ?",
          [equipmentId],
        );
      }
    } else {
      if (fault.technician_id !== user.user_id) {
        throw new ApiError("You are not assigned to this fault.", 403);
      }
      if (fault.fault_status !== "Under Repair") {
        throw new ApiError("Only a fault under repair can be resolved.", 409);
      }

      await conn.execute(
        "UPDATE fault_reports SET fault_status = 'Resolved' WHERE fault_id = ?",
        [data.fault_id],
      );

      const [others] = await conn.execute<CountRow[]>(
        `SELECT COUNT(*) AS count FROM fault_reports
         WHERE equipment_id = ? AND fault_id <> ? AND fault_status <> 'Resolved'`,
        [equipmentId, data.fault_id],
      );
      const [issued] = await conn.execute<CountRow[]>(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE equipment_id = ? AND booking_status = 'Issued'`,
        [equipmentId],
      );
      // Resolution must respect an outstanding issue and any other fault.
      const next = issued[0].count ? "Issued"
        : others[0].count ? "Under Repair" : "Available";
      await conn.execute(
        "UPDATE equipment SET equipment_status = ? WHERE equipment_id = ?",
        [next, equipmentId],
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (conn) await conn.rollback();
    return apiError(error);
  } finally {
    conn?.release();
  }
}
