import { connection, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";
import { apiError, requireUser } from "@/lib/api";

export async function GET() {
  await connection();
  try {
    await requireUser(["Staff"]);
    const db = getDb();

    const [statusCounts] = await db.query(
      `SELECT fault_status, COUNT(*) AS total
       FROM fault_reports GROUP BY fault_status ORDER BY fault_status`,
    );
    const [labs] = await db.query(
      "SELECT lab_name, total_faults, unresolved_faults, resolved_faults FROM vw_lab_fault_summary ORDER BY total_faults DESC, lab_name",
    );
    const [workload] = await db.query(
      "SELECT technician_id, technician_name, open_faults, resolved_faults, avg_days_to_resolve FROM vw_technician_workload ORDER BY technician_name",
    );
    const [topEquipment] = await db.query(
      `SELECT e.equipment_name, l.lab_name, COUNT(*) AS faults
       FROM fault_reports f
       JOIN equipment e ON e.equipment_id = f.equipment_id
       JOIN laboratories l ON l.lab_id = e.lab_id
       GROUP BY e.equipment_id, e.equipment_name, l.lab_name
       ORDER BY faults DESC, e.equipment_name LIMIT 5`,
    );
    const [average] = await db.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(DATEDIFF(resolved_date, reported_date)), 1) AS avg_days
       FROM fault_reports WHERE fault_status = 'Resolved'`,
    );

    // MongoDB aggregation: repair activity per technician and action.
    let repairActivity: unknown[] | null = null;
    let mongoError: string | null = null;
    try {
      const mongo = await getMongoDb();
      const grouped = await mongo.collection("repair_updates").aggregate([
        {
          $group: {
            _id: { technician_id: "$technician_id", action: "$action" },
            updates: { $sum: 1 },
            last_update: { $max: "$created_at" },
          },
        },
        { $sort: { "_id.technician_id": 1, "_id.action": 1 } },
      ]).toArray();

      const ids = [...new Set(grouped.map((row) => Number(row._id.technician_id)))];
      const names = new Map<number, string>();
      if (ids.length) {
        const [users] = await db.query<RowDataPacket[]>(
          "SELECT user_id, user_name FROM users WHERE user_id IN (?)", [ids],
        );
        for (const row of users) names.set(row.user_id, row.user_name);
      }
      repairActivity = grouped.map((row) => ({
        technician_id: row._id.technician_id,
        technician_name: names.get(Number(row._id.technician_id)) ?? "Unknown",
        action: row._id.action,
        updates: row.updates,
        last_update: row.last_update instanceof Date
          ? row.last_update.toISOString() : String(row.last_update),
      }));
    } catch (error) {
      console.error("MongoDB report failed:",
        error instanceof Error ? error.message : "Unknown error");
      mongoError = "Repair-note statistics are unavailable because MongoDB could not be reached.";
    }

    return NextResponse.json({
      statusCounts,
      labs,
      workload,
      topEquipment,
      averageDaysToResolve: average[0]?.avg_days === null || average[0]?.avg_days === undefined
        ? null : Number(average[0].avg_days),
      repairActivity,
      mongoError,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
