"use client";

import { useEffect, useState, type FormEvent } from "react";

type Lab = { lab_id: number; lab_name: string; location: string };
type Item = { equipment_id: number; equipment_name: string; lab_id: number };

const field = "w-full rounded-lg border border-slate-300 bg-white p-3";
const button = "rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50";

export default function Management() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [labId, setLabId] = useState("");
  const [labName, setLabName] = useState("");
  const [location, setLocation] = useState("");
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemLab, setItemLab] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load records.");
        setLabs(data.laboratories);
        setItems(data.equipment);
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load records.");
      }
    }
    void load();
  }, []);

  function selectLab(value: string) {
    setLabId(value);
    const selected = labs.find((lab) => String(lab.lab_id) === value);
    setLabName(selected?.lab_name || "");
    setLocation(selected?.location || "");
  }

  function selectItem(value: string) {
    setItemId(value);
    const selected = items.find((item) => String(item.equipment_id) === value);
    setItemName(selected?.equipment_name || "");
    setItemLab(selected ? String(selected.lab_id) : "");
  }

  async function save(
    event: FormEvent<HTMLFormElement>,
    entity: "laboratory" | "equipment",
  ) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const operation = submitter?.value || "save";
    const id = entity === "laboratory" ? labId : itemId;

    if (operation === "delete" && !window.confirm(
      "Delete this record? Referenced records cannot be deleted.",
    )) return;

    setBusy(true);
    setError("");
    try {
      const body = {
        entity,
        operation: operation === "delete" ? "delete" : id ? "update" : "create",
        ...(id ? { id: Number(id) } : {}),
        ...(operation !== "delete" ? {
          name: entity === "laboratory" ? labName : itemName,
          ...(entity === "laboratory"
            ? { location }
            : { lab_id: Number(itemLab) }),
        } : {}),
      };
      const response = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operation failed.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-semibold">Manage laboratories and equipment</h2>
      <p className="mt-2 text-sm text-slate-600">
        Choose New to add a record, or select an existing record to edit it.
        Equipment status is controlled by bookings and repairs.
      </p>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}

      <div className="mt-5 grid gap-8 lg:grid-cols-2">
        <form onSubmit={(event) => save(event, "laboratory")} className="space-y-4">
          <h3 className="text-lg font-semibold">Laboratory</h3>
          <select aria-label="Select laboratory to edit" value={labId}
            onChange={(event) => selectLab(event.target.value)} className={field}>
            <option value="">New laboratory</option>
            {labs.map((lab) =>
              <option key={lab.lab_id} value={lab.lab_id}>{lab.lab_name}</option>,
            )}
          </select>
          <label className="block">
            <span className="mb-2 block">Name</span>
            <input required maxLength={100} value={labName}
              onChange={(event) => setLabName(event.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-2 block">Location</span>
            <input required maxLength={100} value={location}
              onChange={(event) => setLocation(event.target.value)} className={field} />
          </label>
          <div className="flex gap-3">
            <button value="save" disabled={busy || !ready} className={button}>Save laboratory</button>
            {labId && <button value="delete" formNoValidate disabled={busy || !ready}
              className={button}>Delete laboratory</button>}
          </div>
        </form>

        <form onSubmit={(event) => save(event, "equipment")} className="space-y-4">
          <h3 className="text-lg font-semibold">Equipment</h3>
          <select aria-label="Select equipment to edit" value={itemId}
            onChange={(event) => selectItem(event.target.value)} className={field}>
            <option value="">New equipment</option>
            {items.map((item) =>
              <option key={item.equipment_id} value={item.equipment_id}>
                {item.equipment_name}
              </option>,
            )}
          </select>
          <label className="block">
            <span className="mb-2 block">Name</span>
            <input required maxLength={100} value={itemName}
              onChange={(event) => setItemName(event.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-2 block">Laboratory</span>
            <select required value={itemLab}
              onChange={(event) => setItemLab(event.target.value)} className={field}>
              <option value="">Select laboratory</option>
              {labs.map((lab) =>
                <option key={lab.lab_id} value={lab.lab_id}>{lab.lab_name}</option>,
              )}
            </select>
          </label>
          <div className="flex gap-3">
            <button value="save" disabled={busy || !ready} className={button}>Save equipment</button>
            {itemId && <button value="delete" formNoValidate disabled={busy || !ready}
              className={button}>Delete equipment</button>}
          </div>
        </form>
      </div>
    </section>
  );
}