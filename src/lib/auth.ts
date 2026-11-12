import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "./db";

export type Role = "Student" | "Staff" | "Technician";

export interface User extends RowDataPacket {
  user_id: number;
  user_name: string;
  email: string;
  user_role: Role;
}

export const sessionCookie = "labtrack_session";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 8 * 60 * 60,
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export function allowedOrigin(request: Request) {
  return request.headers.get("origin") ===
    (process.env.APP_ORIGIN || "http://localhost:3000");
}

export async function createSession(userId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuer("labtrack")
    .setAudience("labtrack-web")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;

  let userId: number;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      issuer: "labtrack",
      audience: "labtrack-web",
    });
    userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  } catch {
    return null;
  }

  const [users] = await getDb().execute<User[]>(
    "SELECT user_id, user_name, email, user_role FROM users WHERE user_id = ?",
    [userId],
  );
  return users[0] || null;
}