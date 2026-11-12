import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError, requireUser } from "@/lib/api";

export async function GET() {
  await connection();
  try {
    await requireUser(["Student", "Staff", "Technician"]);
    const [laboratories] = await getDb().query(
      "SELECT lab_id, lab_name, location FROM laboratories ORDER BY lab_name",
    );
    const [equipment] = await getDb().query(
      `SELECT e.equipment_id, e.equipment_name, e.equipment_status,
              e.lab_id, l.lab_name,
              EXISTS(
                SELECT 1 FROM fault_reports f
                WHERE f.equipment_id = e.equipment_id
                AND f.fault_status <> 'Resolved'
              ) AS has_fault
       FROM equipment e
       JOIN laboratories l ON l.lab_id = e.lab_id
       ORDER BY l.lab_name, e.equipment_name`,
    );
    return NextResponse.json(
      { laboratories, equipment },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}