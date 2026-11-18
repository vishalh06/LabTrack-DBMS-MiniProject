"use client";

import { useCallback, useEffect, useState } from "react";

type Report = {
  statusCounts: { fault_status: string; total: number }[];
  labs: { lab_name: string; total_faults: number; unresolved_faults: number; resolved_faults: number }[];
  workload: {
    technician_id: number; technician_name: string; open_faults: number;
    resolved_faults: number; avg_days_to_resolve: string | null;
  }[];
  topEquipment: { equipment_name: string; lab_name: string; faults: number }[];
  averageDaysToResolve: number | null;
  repairActivity: {
    technician_name: string; action: string; updates: number; last_update: string;
  }[] | null;
  mongoError: string | null;
};

export default function Reports({ refreshKey }: { refreshKey: number }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/reports", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load reports.");
    setReport(data);
  }, []);

  useEffect(() => {
    async function start() {
      try {
        setError("");
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load reports.");
      }
    }
    void start();
  }, [load, refreshKey]);

  const cell = "p-2";

  return (
    <div className="border-t border-slate-200 pt-6">
      <h3 className="text-xl font-semibold">Fault reports</h3>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {report && (
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <h4 className="font-semibold">Faults by status</h4>
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {report.statusCounts.map((row) =>
                  <tr key={row.fault_status} className="border-b border-slate-200">
                    <td className={cell}>{row.fault_status}</td><td className={cell}>{row.total}</td>
                  </tr>,
                )}
                <tr><td className={cell}>Average days to resolve</td>
                  <td className={cell}>{report.averageDaysToResolve ?? "-"}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-semibold">Faults per laboratory</h4>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="bg-slate-100"><tr>
                <th className={cell}>Laboratory</th><th className={cell}>Total</th>
                <th className={cell}>Unresolved</th><th className={cell}>Resolved</th>
              </tr></thead>
              <tbody>
                {report.labs.map((row) =>
                  <tr key={row.lab_name} className="border-b border-slate-200">
                    <td className={cell}>{row.lab_name}</td><td className={cell}>{row.total_faults}</td>
                    <td className={cell}>{row.unresolved_faults}</td><td className={cell}>{row.resolved_faults}</td>
                  </tr>,
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-semibold">Technician workload</h4>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="bg-slate-100"><tr>
                <th className={cell}>Technician</th><th className={cell}>Open</th>
                <th className={cell}>Resolved</th><th className={cell}>Avg days</th>
              </tr></thead>
              <tbody>
                {report.workload.map((row) =>
                  <tr key={row.technician_id} className="border-b border-slate-200">
                    <td className={cell}>{row.technician_name}</td><td className={cell}>{row.open_faults}</td>
                    <td className={cell}>{row.resolved_faults}</td><td className={cell}>{row.avg_days_to_resolve ?? "-"}</td>
                  </tr>,
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-semibold">Most faulty equipment</h4>
            <table className="mt-2 w-full text-left text-sm">
              <tbody>
                {report.topEquipment.map((row) =>
                  <tr key={`${row.lab_name}-${row.equipment_name}`} className="border-b border-slate-200">
                    <td className={cell}>{row.equipment_name}<span className="block text-slate-500">{row.lab_name}</span></td>
                    <td className={cell}>{row.faults}</td>
                  </tr>,
                )}
              </tbody>
            </table>
            {!report.topEquipment.length && <p className="p-2 text-sm">No faults reported yet.</p>}
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-semibold">Repair activity (MongoDB)</h4>
            {report.mongoError ? <p className="mt-2 text-amber-800">{report.mongoError}</p> : (
              <table className="mt-2 w-full text-left text-sm">
                <thead className="bg-slate-100"><tr>
                  <th className={cell}>Technician</th><th className={cell}>Action</th>
                  <th className={cell}>Updates</th><th className={cell}>Last update</th>
                </tr></thead>
                <tbody>
                  {report.repairActivity?.map((row) =>
                    <tr key={`${row.technician_name}-${row.action}`} className="border-b border-slate-200">
                      <td className={cell}>{row.technician_name}</td><td className={cell}>{row.action}</td>
                      <td className={cell}>{row.updates}</td>
                      <td className={cell}>{new Date(row.last_update).toLocaleString()}</td>
                    </tr>,
                  )}
                </tbody>
              </table>
            )}
            {!report.mongoError && !report.repairActivity?.length &&
              <p className="p-2 text-sm">No repair updates recorded yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
