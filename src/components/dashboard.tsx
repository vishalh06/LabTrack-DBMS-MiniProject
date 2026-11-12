"use client";

import Management from "./management";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Role = "Student" | "Staff" | "Technician";

type Equipment = {
  equipment_id: number;
  equipment_name: string;
  equipment_status: string;
  lab_id: number;
  lab_name: string;
  has_fault: number;
};

type Laboratory = {
  lab_id: number;
  lab_name: string;
};

type Booking = {
  booking_id: number;
  user_name: string;
  equipment_name: string;
  lab_name: string;
  booking_date: string;
  due_date: string;
  return_date: string | null;
  booking_status: string;
  overdue: number;
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-3";
const buttonClass = "rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50";

async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export default function Dashboard({ role }: { role: Role }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [lab, setLab] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const catalog = await readResponse(
      await fetch("/api/catalog", { cache: "no-store" }),
    );
    setEquipment(catalog.equipment);
    setLaboratories(catalog.laboratories);

    if (role !== "Technician") {
      const result = await readResponse(
        await fetch("/api/bookings", { cache: "no-store" }),
      );
      setBookings(result.bookings);
    }
  }, [role]);

  useEffect(() => {
    async function load() {
      try {
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load data.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [refresh]);

  async function requestBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await readResponse(await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: Number(values.get("equipment_id")),
          booking_date: values.get("booking_date"),
          due_date: values.get("due_date"),
        }),
      }));
      setNotice("Booking request submitted.");
      form.reset();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function bookingAction(bookingId: number, action: string) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await readResponse(await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, action }),
      }));
      setNotice("Booking updated.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const visibleEquipment = equipment.filter((item) =>
    item.equipment_name.toLowerCase().includes(search.toLowerCase())
    && (!lab || String(item.lab_id) === lab)
    && (!status || item.equipment_status === status),
  );

  if (loading) return <p className="mt-8">Loading equipment and bookings...</p>;

  return (
    <div className="mt-10 space-y-10 border-t border-slate-200 pt-8">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}

      {role === "Staff" && <Management />}

      <section>
        <h2 className="text-2xl font-semibold">Equipment catalogue</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input aria-label="Search equipment" value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search equipment" className={inputClass} />
          <select aria-label="Filter laboratory" value={lab}
            onChange={(event) => setLab(event.target.value)} className={inputClass}>
            <option value="">All laboratories</option>
            {laboratories.map((item) =>
              <option key={item.lab_id} value={item.lab_id}>{item.lab_name}</option>,
            )}
          </select>
          <select aria-label="Filter equipment status" value={status}
            onChange={(event) => setStatus(event.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            {["Available", "Issued", "Under Repair"].map((value) =>
              <option key={value}>{value}</option>,
            )}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">Equipment</th>
                <th className="p-3">Laboratory</th>
                <th className="p-3">Current status</th>
              </tr>
            </thead>
            <tbody>
              {visibleEquipment.map((item) =>
                <tr key={item.equipment_id} className="border-b border-slate-200">
                  <td className="p-3">{item.equipment_name}</td>
                  <td className="p-3">{item.lab_name}</td>
                  <td className="p-3">
                    {item.equipment_status}
                    {Boolean(item.has_fault) && " (unresolved fault)"}
                  </td>
                </tr>,
              )}
            </tbody>
          </table>
          {!visibleEquipment.length && <p className="p-3">No matching equipment.</p>}
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Current status describes the physical item. Booking approval also checks reservations for your requested dates.
        </p>
      </section>

      {role === "Student" && (
        <section>
          <h2 className="text-2xl font-semibold">Request equipment</h2>
          <form onSubmit={requestBooking} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block font-medium">Equipment</span>
              <select name="equipment_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>Select equipment</option>
                {equipment.filter((item) =>
                  item.equipment_status === "Available" && !item.has_fault,
                ).map((item) =>
                  <option key={item.equipment_id} value={item.equipment_id}>
                    {item.equipment_name}
                  </option>,
                )}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block font-medium">Start date</span>
              <input name="booking_date" type="date" required className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-2 block font-medium">Due date</span>
              <input name="due_date" type="date" required className={inputClass} />
            </label>
            <button disabled={busy} className={buttonClass}>
              {busy ? "Please wait..." : "Submit request"}
            </button>
          </form>
        </section>
      )}

      {role !== "Technician" ? (
        <section>
          <h2 className="text-2xl font-semibold">
            {role === "Staff" ? "Manage bookings" : "My bookings"}
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">ID</th>
                  {role === "Staff" && <th className="p-3">Student</th>}
                  <th className="p-3">Equipment</th>
                  <th className="p-3">Start</th>
                  <th className="p-3">Due</th>
                  <th className="p-3">Returned</th>
                  <th className="p-3">Status</th>
                  {role === "Staff" && <th className="p-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) =>
                  <tr key={booking.booking_id} className="border-b border-slate-200">
                    <td className="p-3">{booking.booking_id}</td>
                    {role === "Staff" && <td className="p-3">{booking.user_name}</td>}
                    <td className="p-3">{booking.equipment_name}</td>
                    <td className="whitespace-nowrap p-3">{booking.booking_date}</td>
                    <td className="whitespace-nowrap p-3">{booking.due_date}</td>
                    <td className="whitespace-nowrap p-3">{booking.return_date || "-"}</td>
                    <td className="p-3">
                      {booking.booking_status}
                      {Boolean(booking.overdue) && <strong className="block text-red-700">Overdue</strong>}
                    </td>
                    {role === "Staff" && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {booking.booking_status === "Pending" && <>
                            <button disabled={busy} className={buttonClass}
                              onClick={() => bookingAction(booking.booking_id, "approve")}>Approve</button>
                            <button disabled={busy} className={buttonClass}
                              onClick={() => bookingAction(booking.booking_id, "reject")}>Reject</button>
                          </>}
                          {booking.booking_status === "Approved" &&
                            <button disabled={busy} className={buttonClass}
                              onClick={() => bookingAction(booking.booking_id, "issue")}>Issue</button>}
                          {booking.booking_status === "Issued" &&
                            <button disabled={busy} className={buttonClass}
                              onClick={() => bookingAction(booking.booking_id, "return")}>Record return</button>}
                        </div>
                      </td>
                    )}
                  </tr>,
                )}
              </tbody>
            </table>
            {!bookings.length && <p className="p-3">No bookings yet.</p>}
          </div>
        </section>
      ) : (
        <p className="rounded-lg bg-slate-100 p-4">
          Technician fault assignments will be added in Vidit&apos;s half.
        </p>
      )}
    </div>
  );
}