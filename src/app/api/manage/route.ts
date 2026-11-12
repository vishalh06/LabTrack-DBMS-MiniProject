import { NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { ApiError, apiError, checkOrigin, requireUser } from "@/lib/api";

const schema = z.object({
  entity: z.enum(["laboratory", "equipment"]),
  operation: z.enum(["create", "update", "delete"]),
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  location: z.string().trim().min(1).max(100).optional(),
  lab_id: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  let connection;
  try {
    checkOrigin(request);
    await requireUser(["Staff"]);
    const result = schema.safeParse(await request.json().catch(() => null));
    if (!result.success) throw new ApiError("Check the form fields.");
    const data = result.data;
    if (data.operation !== "create" && !data.id) {
      throw new ApiError("Select an existing record.");
    }
    if (data.operation !== "delete") {
      if (!data.name) throw new ApiError("Name is required.");
      if (data.entity === "laboratory" && !data.location) {
        throw new ApiError("Location is required.");
      }
      if (data.entity === "equipment" && !data.lab_id) {
        throw new ApiError("Select a laboratory.");
      }
    }

    connection = await getDb().getConnection();
    await connection.beginTransaction();
    let affected = 0;

    if (data.entity === "laboratory") {
      if (data.operation === "create") {
        await connection.execute(
          "INSERT INTO laboratories (lab_name, location) VALUES (?, ?)",
          [data.name ?? null, data.location ?? null],
        );
      } else {
        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT lab_id FROM laboratories WHERE lab_id = ? FOR UPDATE",
          [data.id ?? null],
        );
        if (!rows.length) throw new ApiError("Laboratory not found.", 404);
        if (data.operation === "update") {
          await connection.execute(
            "UPDATE laboratories SET lab_name = ?, location = ? WHERE lab_id = ?",
            [data.name ?? null, data.location ?? null, data.id ?? null],
          );
        } else {
          const [result] = await connection.execute<ResultSetHeader>(
            "DELETE FROM laboratories WHERE lab_id = ?", [data.id ?? null],
          );
          affected = result.affectedRows;
        }
      }
    } else {
      if (data.operation === "create") {
        await connection.execute(
          "INSERT INTO equipment (equipment_name, lab_id) VALUES (?, ?)",
          [data.name ?? null, data.lab_id ?? null],
        );
      } else {
        const [rows] = await connection.execute<RowDataPacket[]>(
          "SELECT equipment_id, equipment_status FROM equipment WHERE equipment_id = ? FOR UPDATE",
          [data.id ?? null],
        );
        if (!rows.length) throw new ApiError("Equipment not found.", 404);

        if (data.operation === "update") {
          const [active] = await connection.execute<RowDataPacket[]>(
            `SELECT booking_id FROM bookings
             WHERE equipment_id = ? AND booking_status IN ('Approved', 'Issued')
             LIMIT 1`,
            [data.id ?? null],
          );
          const [faults] = await connection.execute<RowDataPacket[]>(
            `SELECT fault_id FROM fault_reports
             WHERE equipment_id = ? AND fault_status <> 'Resolved' LIMIT 1`,
            [data.id ?? null],
          );
          if (active.length || faults.length || rows[0].equipment_status !== "Available") {
            throw new ApiError("Equipment with an active allocation or repair cannot be edited.", 409);
          }
          await connection.execute(
            "UPDATE equipment SET equipment_name = ?, lab_id = ? WHERE equipment_id = ?",
            [data.name ?? null, data.lab_id ?? null, data.id ?? null],
          );
        } else {
          if (rows[0].equipment_status !== "Available") {
            throw new ApiError("Only available, unreferenced equipment can be deleted.", 409);
          }
          const [result] = await connection.execute<ResultSetHeader>(
            "DELETE FROM equipment WHERE equipment_id = ?", [data.id ?? null],
          );
          affected = result.affectedRows;
        }
      }
    }

    if (data.operation === "delete" && !affected) {
      throw new ApiError("Record not found.", 404);
    }
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    const code = (error as { code?: string })?.code;
    if (code === "ER_ROW_IS_REFERENCED_2") {
      return apiError(new ApiError(
        "Cannot delete this record because equipment, bookings, or fault reports reference it.", 409,
      ));
    }
    if (code === "ER_NO_REFERENCED_ROW_2") {
      return apiError(new ApiError("The selected laboratory no longer exists.", 409));
    }
    return apiError(error);
  } finally {
    connection?.release();
  }
}