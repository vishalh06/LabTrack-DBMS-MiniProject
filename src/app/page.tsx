"use client";

import Dashboard from "@/components/dashboard";

import { useEffect, useState, type FormEvent } from "react";

type User = {
  user_id: number;
  user_name: string;
  email: string;
  user_role: "Student" | "Staff" | "Technician";
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json();
        if (response.ok) setUser(data.user);
        else if (response.status !== 401) {
          setError(data.error || "Unable to load your session.");
        }
      } catch {
        setError("Cannot reach the server.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed.");
      const session = await fetch("/api/auth/me", { cache: "no-store" });
      const sessionData = await session.json();
      if (!session.ok) throw new Error(sessionData.error || "Session lookup failed.");
      setUser(sessionData.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed.");
      setUser(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-16 text-slate-900">
      <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Laboratory management
        </p>
        <h1 className="mt-2 text-4xl font-bold">LabTrack</h1>
        <p className="mt-3 text-slate-600">
          Equipment bookings and fault management.
        </p>

        {loading ? <p className="mt-8">Loading...</p> : user ? (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-semibold">Welcome, {user.user_name}</h2>
            <p>Role: <strong>{user.user_role}</strong></p>
            <p className="text-slate-600">{user.email}</p>
            <Dashboard role={user.user_role} />
            <button onClick={logout} disabled={busy}
              className="rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-50">
              {busy ? "Please wait..." : "Log out"}
            </button>
          </div>
        ) : (
          <form onSubmit={login} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block font-medium">Email</label>
              <input id="email" name="email" type="email" required
                autoComplete="username" maxLength={100}
                className="w-full rounded-lg border border-slate-300 p-3" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block font-medium">Password</label>
              <input id="password" name="password" type="password" required
                autoComplete="current-password" maxLength={200}
                className="w-full rounded-lg border border-slate-300 p-3" />
            </div>
            <button disabled={busy}
              className="w-full rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">
              {busy ? "Logging in..." : "Log in"}
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-5 text-red-700">{error}</p>}
      </section>
    </main>
  );
}