"use client";

import {
  useCallback, useEffect, useRef, useState, type FormEvent,
} from "react";
import Reports from "./reports";

type Role = "Student" | "Staff" | "Technician";

type EquipmentOption = { equipment_id: number; equipment_name: string };

type Fault = {
  fault_id: number;
  equipment_id: number;
  equipment_name: string;
  lab_name: string;
  reporter_name: string;
  technician_id: number | null;
  technician_name: string | null;
  fault_description: string;
  reported_date: string;
  assigned_date: string | null;
  resolved_date: string | null;
  fault_status: "Reported" | "Under Repair" | "Resolved";
};

type Technician = {
  technician_id: number;
  technician_name: string;
  open_faults: number;
};

type RepairUpdate = {
  event_id: string;
  technician_name: string;
  action: string;
  notes: string;
  details: Record<string, unknown>;
  created_at: string;
};

const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-3";
const buttonClass = "rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50";

async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

const statusStyle: Record<Fault["fault_status"], string> = {
  Reported: "bg-amber-100 text-amber-900",
  "Under Repair": "bg-sky-100 text-sky-900",
  Resolved: "bg-emerald-100 text-emerald-900",
};

function RepairPanel({
  fault, canWrite, onClose,
}: { fault: Fault; canWrite: boolean; onClose: () => void }) {
  const [updates, setUpdates] = useState<RepairUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("Progress");
  const [notes, setNotes] = useState("");
  const [parts, setParts] = useState("");
  const [measurements, setMeasurements] = useState("");
  // The same event_id is reused when retrying a failed submission.
  const eventId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const data = await readResponse(
      await fetch(`/api/repairs?fault_id=${fault.fault_id}`, { cache: "no-store" }),
    );
    setUpdates(data.updates);
  }, [fault.fault_id]);

  useEffect(() => {
    async function start() {
      try {
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load history.");
      } finally {
        setLoading(false);
      }
    }
    void start();
  }, [load]);

  function edited(setter: (value: string) => void, value: string) {
    eventId.current = null;
    setter(value);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    eventId.current ??= crypto.randomUUID();
    const details: Record<string, string> = {};
    if (parts.trim()) details.parts = parts.trim();
    if (measurements.trim()) details.measurements = measurements.trim();
    try {
      await readResponse(await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId.current,
          fault_id: fault.fault_id,
          action,
          notes,
          details,
        }),
      }));
      eventId.current = null;
      setNotes("");
      setParts("");
      setMeasurements("");
      await load();
    } catch (cause) {
      setError(
        (cause instanceof Error ? cause.message : "Save failed.")
        + " Your text is kept; press Save again to retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Repair history for fault #{fault.fault_id}</h4>
        <button onClick={onClose} className="text-sm underline">Close</button>
      </div>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {loading ? <p className="mt-2">Loading history...</p> : (
        <ul className="mt-3 space-y-2">
          {updates.map((item) =>
            <li key={item.event_id} className="rounded border border-slate-200 bg-white p-3 text-sm">
              <strong>{item.action}</strong> by {item.technician_name}
              <span className="text-slate-500"> · {new Date(item.created_at).toLocaleString()}</span>
              <p className="mt-1 whitespace-pre-wrap">{item.notes}</p>
              {Object.entries(item.details).map(([key, value]) =>
                <p key={key} className="text-slate-600">{key}: {String(value)}</p>,
              )}
            </li>,
          )}
          {!updates.length && !error && <li className="text-sm">No repair updates yet.</li>}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Action</span>
            <select value={action} onChange={(e) => edited(setAction, e.target.value)}
              className={inputClass}>
              {["Diagnosis", "Progress", "Repair"].map((value) =>
                <option key={value}>{value}</option>,
              )}
            </select>
          </label>
          <label className="block md:row-span-2">
            <span className="mb-1 block text-sm font-medium">Notes</span>
            <textarea required maxLength={5000} rows={4} value={notes}
              onChange={(e) => edited(setNotes, e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Parts used (optional)</span>
            <input maxLength={200} value={parts}
              onChange={(e) => edited(setParts, e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Measurements (optional)</span>
            <input maxLength={200} value={measurements}
              onChange={(e) => edited(setMeasurements, e.target.value)} className={inputClass} />
          </label>
          <button disabled={busy} className={buttonClass}>
            {busy ? "Saving..." : "Save repair update"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Faults({
  role, equipment, onChanged,
}: {
  role: Role;
  equipment: EquipmentOption[];
  onChanged: () => Promise<void>;
}) {
  const [faults, setFaults] = useState<Fault[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filter, setFilter] = useState("");
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [openFault, setOpenFault] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportKey, setReportKey] = useState(0);

  const load = useCallback(async () => {
    const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const data = await readResponse(
      await fetch(`/api/faults${query}`, { cache: "no-store" }),
    );
    setFaults(data.faults);
    setTechnicians(data.technicians);
  }, [filter]);

  useEffect(() => {
    async function start() {
      try {
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load faults.");
      } finally {
        setLoading(false);
      }
    }
    void start();
  }, [load]);

  async function refreshAll() {
    await load();
    await onChanged();
  }

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch("/api/faults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: Number(values.get("equipment_id")),
          description: values.get("description"),
        }),
      }));
      setNotice("Fault reported.");
      setReportKey((value) => value + 1);
      await refreshAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch("/api/faults", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      setNotice(message);
      await refreshAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const title = role === "Student" ? "My fault reports"
    : role === "Staff" ? "Manage faults" : "My assigned faults";
  const opened = faults.find((item) => item.fault_id === openFault);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Faults</h2>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{notice}</p>}

      {role !== "Technician" && (
        <form key={reportKey} onSubmit={report} className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block font-medium">Faulty equipment</span>
            <select name="equipment_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>Select equipment</option>
              {equipment.map((item) =>
                <option key={item.equipment_id} value={item.equipment_id}>{item.equipment_name}</option>,
              )}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block font-medium">What is wrong?</span>
            <textarea name="description" required minLength={5} maxLength={500} rows={2}
              className={inputClass} />
          </label>
          <button disabled={busy} className={buttonClass}>
            {busy ? "Please wait..." : "Report fault"}
          </button>
        </form>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          {role === "Staff" && (
            <select aria-label="Filter fault status" value={filter}
              onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white p-2">
              <option value="">All statuses</option>
              {["Reported", "Under Repair", "Resolved"].map((value) =>
                <option key={value}>{value}</option>,
              )}
            </select>
          )}
        </div>

        {loading ? <p className="mt-3">Loading faults...</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Equipment</th>
                  <th className="p-3">Description</th>
                  {role !== "Student" && <th className="p-3">Reported by</th>}
                  <th className="p-3">Reported</th>
                  <th className="p-3">Technician</th>
                  <th className="p-3">Status</th>
                  {role !== "Student" && <th className="p-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {faults.map((fault) =>
                  <tr key={fault.fault_id} className="border-b border-slate-200 align-top">
                    <td className="p-3">{fault.fault_id}</td>
                    <td className="p-3">{fault.equipment_name}<span className="block text-slate-500">{fault.lab_name}</span></td>
                    <td className="max-w-xs p-3">{fault.fault_description}</td>
                    {role !== "Student" && <td className="p-3">{fault.reporter_name}</td>}
                    <td className="whitespace-nowrap p-3">{fault.reported_date}</td>
                    <td className="p-3">{fault.technician_name || "-"}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-1 ${statusStyle[fault.fault_status]}`}>
                        {fault.fault_status}
                      </span>
                      {fault.resolved_date && <span className="block text-slate-500">{fault.resolved_date}</span>}
                    </td>
                    {role === "Staff" && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {fault.fault_status !== "Resolved" && <>
                            <select aria-label={`Technician for fault ${fault.fault_id}`}
                              value={chosen[fault.fault_id] || ""}
                              onChange={(e) => setChosen({ ...chosen, [fault.fault_id]: e.target.value })}
                              className="rounded-lg border border-slate-300 bg-white p-2">
                              <option value="">Select technician</option>
                              {technicians.map((tech) =>
                                <option key={tech.technician_id} value={tech.technician_id}>
                                  {tech.technician_name} ({tech.open_faults} open)
                                </option>,
                              )}
                            </select>
                            <button disabled={busy || !chosen[fault.fault_id]} className={buttonClass}
                              onClick={() => act({
                                action: "assign",
                                fault_id: fault.fault_id,
                                technician_id: Number(chosen[fault.fault_id]),
                              }, "Technician assigned.")}>
                              {fault.technician_id ? "Reassign" : "Assign"}
                            </button>
                          </>}
                          {fault.technician_id && (
                            <button className="rounded-lg border border-slate-400 px-4 py-2"
                              onClick={() => setOpenFault(openFault === fault.fault_id ? null : fault.fault_id)}>
                              History
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    {role === "Technician" && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-lg border border-slate-400 px-4 py-2"
                            onClick={() => setOpenFault(openFault === fault.fault_id ? null : fault.fault_id)}>
                            {fault.fault_status === "Under Repair" ? "Update / history" : "History"}
                          </button>
                          {fault.fault_status === "Under Repair" && (
                            <button disabled={busy} className={buttonClass}
                              onClick={() => {
                                if (window.confirm("Mark this fault as resolved?")) {
                                  void act({ action: "resolve", fault_id: fault.fault_id }, "Fault resolved.");
                                }
                              }}>
                              Mark resolved
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>,
                )}
              </tbody>
            </table>
            {!faults.length && <p className="p-3">No faults to show.</p>}
          </div>
        )}

        {opened && (
          <RepairPanel key={opened.fault_id} fault={opened}
            canWrite={role === "Technician" && opened.fault_status === "Under Repair"}
            onClose={() => setOpenFault(null)} />
        )}
      </div>

      {role === "Staff" && <Reports refreshKey={faults.length} />}
    </section>
  );
}
