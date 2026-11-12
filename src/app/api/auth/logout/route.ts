import { NextResponse } from "next/server";
import {
  allowedOrigin, cookieOptions, sessionCookie,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!allowedOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}