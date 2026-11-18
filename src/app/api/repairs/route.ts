import { connection, NextResponse } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";
import { ApiError, apiError, checkOrigin, requireUser } from "@/lib/api";

interface FaultRow extends RowDataPacket {
  fault_id: number;
  technician_id: number | null;
  fault_status: string;
}

const updateSchema = z.object({
  event_id: z.string().trim().min(8).max(64),
  fault_id: z.number().int().positive(),
  action: z.enum(["Diagnosis", "Progress", "Repair"]),
  notes: z.string().trim().min(1).max(5000),
  details: z.record(z.string(), z.unknown()).default({}),
});

function mongoFailure(error: unknown): never {
  const code = (error as { code?: number } | null)?.code;
  if (code === 121) {
    throw new ApiError("The repair note failed database validation.", 400);
  }
  console.error("MongoDB operation failed:",
    error instanceof Error ? error.message : "Unknown error");
  throw new ApiError(
    "The repair note could not be saved to MongoDB. Nothing was recorded; retry the same update.",
    502,
  );
}

async function loadFault(faultId: number) {
  const [rows] = await getDb().execute<FaultRow[]>(
    "SELECT fault_id, technician_id, fault_status FROM fault_reports WHERE fault_id = ?",
    [faultId],
  );
  if (!rows.length) throw new ApiError("Fault not found.", 404);
  return rows[0];
}

export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(["Staff", "Technician"]);
    const faultId = z.coerce.number().int().positive().safeParse(
      new URL(request.url).searchParams.get("fault_id"),
    );
    if (!faultId.success) throw new ApiError("Provide a valid fault_id.");

    const fault = await loadFault(faultId.data);
    if (user.user_role === "Technician" && fault.technician_id !== user.user_id) {
      throw new ApiError("You are not assigned to this fault.", 403);
    }

    let documents;
    try {
      const db = await getMongoDb();
      documents = await db.collection("repair_updates")
        .find({ fault_id: faultId.data }, { projection: { _id: 0 } })
        .sort({ created_at: 1 })
        .toArray();
    } catch (error) {
      mongoFailure(error);
    }

    const ids = [...new Set(documents.map((item) => Number(item.technician_id)))];
    const names = new Map<number, string>();
    if (ids.length) {
      const [users] = await getDb().query<RowDataPacket[]>(
        "SELECT user_id, user_name FROM users WHERE user_id IN (?)", [ids],
      );
      for (const row of users) names.set(row.user_id, row.user_name);
    }

    const updates = documents.map((item) => ({
      event_id: item.event_id,
      technician_id: item.technician_id,
      technician_name: names.get(Number(item.technician_id)) ?? "Unknown",
      action: item.action,
      notes: item.notes,
      details: item.details,
      created_at: item.created_at instanceof Date
        ? item.created_at.toISOString() : String(item.created_at),
    }));

    return NextResponse.json(
      { updates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(["Technician"]);
    const parsed = updateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new ApiError("Provide an action and notes (up to 5000 characters).");
    }
    const data = parsed.data;
    if (JSON.stringify(data.details).length > 10000) {
      throw new ApiError("Details are too large.");
    }

    // MySQL is authoritative: verify the fault and the assignment first.
    // technician_id always comes from the session, never from the browser.
    const fault = await loadFault(data.fault_id);
    if (fault.technician_id !== user.user_id) {
      throw new ApiError("You are not assigned to this fault.", 403);
    }
    if (fault.fault_status !== "Under Repair") {
      throw new ApiError("Repair updates can only be added while the fault is under repair.", 409);
    }

    try {
      const db = await getMongoDb();
      await db.collection("repair_updates").insertOne({
        event_id: data.event_id,
        fault_id: data.fault_id,
        technician_id: user.user_id,
        action: data.action,
        notes: data.notes,
        details: data.details,
        created_at: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number } | null)?.code === 11000) {
        // A retry of an update that was already stored.
        const db = await getMongoDb();
        const existing = await db.collection("repair_updates").findOne({
          event_id: data.event_id,
          fault_id: data.fault_id,
          technician_id: user.user_id,
        });
        if (existing) {
          return NextResponse.json({ success: true, duplicate: true });
        }
        throw new ApiError("This event_id was already used for another update.", 409);
      }
      mongoFailure(error);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
