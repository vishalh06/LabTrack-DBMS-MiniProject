import { connection } from "next/server";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";



export async function GET() {
  await connection();
  try {
    const user = await currentUser();
    return NextResponse.json(
      { user },
      { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Session lookup failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Database unavailable." }, { status: 503 },
    );
  }
}