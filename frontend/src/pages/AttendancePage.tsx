import { FormEvent, useEffect, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import { api } from "../lib/api";

export default function AttendancePage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const load = async () => {
    const [a, e] = await Promise.all([api<any>("/api/v1/attendance"), api<any>("/api/v1/employees")]);
    setItems(a.items || []);
    setEmployees(e.items || []);
  };
  useEffect(() => { load(); }, []);

  const clockIn = async (e: FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    await api("/api/v1/attendance", {
      method: "POST",
      body: JSON.stringify({
        employee_id: Number(employeeId),
        work_date: today,
        clock_in: new Date().toISOString(),
        status: "PRESENT",
      }),
    });
    await load();
  };

  const clockOut = async (id: number) => {
    await api(`/api/v1/attendance/${id}/clock-out`, { method: "POST" });
    await load();
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Clock in / out for staff" />
      <form className="card p-4 flex flex-wrap gap-3 mb-4 items-end" onSubmit={clockIn}>
        <div className="min-w-[220px]">
          <label className="label">Employee</label>
          <select className="input" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select…</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name || `${emp.first_name} ${emp.last_name}`}</option>)}
          </select>
        </div>
        <button className="btn-primary">Clock in</button>
      </form>
      <div className="card overflow-auto">
        <table className="table">
          <thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.employee_name}</td>
                <td>{a.work_date}</td>
                <td>{a.clock_in}</td>
                <td>{a.clock_out || "—"}</td>
                <td>{a.status}</td>
                <td className="text-right">{!a.clock_out && <button className="btn-secondary !py-1" onClick={() => clockOut(a.id)}>Clock out</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
