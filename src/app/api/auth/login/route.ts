import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import type { User } from "@/lib/auth";
import {
  allowedOrigin, cookieOptions, createSession, sessionCookie,
} from "@/lib/auth";
import { getDb } from "@/lib/db";



const schema = z.object({
  email: z.string().trim().email().max(100),
  password: z.string().min(1).max(200),
});

interface LoginUser extends User {
  password_hash: string;
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password." }, { status: 400 },
    );
  }

  try {
    const [users] = await getDb().execute<LoginUser[]>(
      `SELECT user_id, user_name, email, user_role, password_hash
       FROM users WHERE email = ?`,
      [result.data.email.toLowerCase()],
    );
    const user = users[0];
    if (!user || !(await compare(result.data.password, user.password_hash))) {
      return NextResponse.json(
        { error: "Incorrect email or password." }, { status: 401 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      sessionCookie, await createSession(user.user_id), cookieOptions,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Login failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Login unavailable. Check the server terminal." }, { status: 500 },
    );
  }
}