import "server-only";
import { NextResponse } from "next/server";
import { allowedOrigin, currentUser, type Role } from "./auth";

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function requireUser(roles: Role[]) {
  const user = await currentUser();
  if (!user) throw new ApiError("Please log in.", 401);
  if (!roles.includes(user.user_role)) {
    throw new ApiError("You do not have permission for this action.", 403);
  }
  return user;
}

export function checkOrigin(request: Request) {
  if (!allowedOrigin(request)) throw new ApiError("Request not allowed.", 403);
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const sqlError = error as { code?: string; sqlMessage?: string } | null;
  if (sqlError?.code === "ER_SIGNAL_EXCEPTION") {
    return NextResponse.json(
      { error: sqlError.sqlMessage || "Allocation rejected." },
      { status: 409 },
    );
  }
  if (sqlError?.code === "ER_NO_SUCH_TABLE") {
    return NextResponse.json(
      { error: "Fault-management database objects are missing. Run npm run db:faults." },
      { status: 500 },
    );
  }
  console.error("Database operation failed:",
    error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    { error: "Operation failed. Check the server terminal." },
    { status: 500 },
  );
}