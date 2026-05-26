"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import "./shifts.css";

type AttendanceRecord = {
  id: string;
  loginAt: string;
  logoutAt: string | null;
  breakMinutes: number;
  notes: string | null;
  workedMinutes: number;
  employee: {
    name: string;
    employeeCode: string | null;
    role: string;
  };
  storeShift: {
    terminalCode: string;
  } | null;
};

type AttendanceResponse = {
  items: AttendanceRecord[];
  activeCount: number;
  totalWorkedMinutes: number;
};

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function duration(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function AdminShiftsPage() {
  const token = useAuthStore((s) => s.token);
  const today = dateInputValue(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [loginAt, setLoginAt] = useState("");
  const [logoutAt, setLogoutAt] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [notes, setNotes] = useState("");

  const loadRecords = useCallback(async (from: string, to: string) => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/sessions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Could not load time records.");
      setData(body as AttendanceResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load time records.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRecords(today, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRecords]);

  function showToday() {
    const value = dateInputValue(new Date());
    setFromDate(value);
    setToDate(value);
    loadRecords(value, value);
  }

  function showWeek() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const from = dateInputValue(start);
    const to = dateInputValue(end);
    setFromDate(from);
    setToDate(to);
    loadRecords(from, to);
  }

  function openEdit(record: AttendanceRecord) {
    setEditing(record);
    setLoginAt(dateTimeInputValue(record.loginAt));
    setLogoutAt(dateTimeInputValue(record.logoutAt));
    setBreakMinutes(String(record.breakMinutes));
    setNotes(record.notes ?? "");
  }

  async function saveRecord(body: {
    loginAt?: string;
    logoutAt?: string | null;
    breakMinutes?: number;
    notes?: string;
  }, sessionId: string) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const response = await res.json().catch(() => null);
      if (!res.ok) throw new Error(response?.error ?? "Could not update time record.");
      setEditing(null);
      await loadRecords(fromDate, toDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update time record.");
    } finally {
      setSaving(false);
    }
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !loginAt) return;
    saveRecord({
      loginAt: new Date(loginAt).toISOString(),
      logoutAt: logoutAt ? new Date(logoutAt).toISOString() : null,
      breakMinutes: Number(breakMinutes || 0),
      notes,
    }, editing.id);
  }

  function clockOutNow(record: AttendanceRecord) {
    if (!window.confirm(`Clock out ${record.employee.name} now?`)) return;
    saveRecord({ logoutAt: new Date().toISOString() }, record.id);
  }

  const completedCount = data?.items.filter((item) => item.logoutAt).length ?? 0;

  return (
    <div className="attendancePage">
      <div className="adminPageHeader">
        <div>
          <div className="adminPageTitle">Shifts &amp; Time Clock</div>
          <p className="adminPageSubtitle">Review employee punches and correct attendance records.</p>
        </div>
        <button className="adminPrimaryBtn" onClick={() => loadRecords(fromDate, toDate)} type="button">Refresh</button>
      </div>

      <section className="attendanceFilters">
        <button className="adminFilterBtn" onClick={showToday} type="button">Today</button>
        <button className="adminFilterBtn" onClick={showWeek} type="button">Last 7 Days</button>
        <label>
          <span>From</span>
          <input className="adminInput" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input className="adminInput" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <button className="attendanceApplyBtn" onClick={() => loadRecords(fromDate, toDate)} type="button">Apply Dates</button>
      </section>

      {error && <div className="attendanceError">{error}</div>}
      {loading && <div className="attendanceStatus">Loading time records...</div>}

      {!loading && data && (
        <>
          <div className="attendanceMetrics">
            <div className="adminMetricCard"><div className="adminMetricLabel">Clocked In Now</div><div className="adminMetricValue">{data.activeCount}</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Completed Punches</div><div className="adminMetricValue">{completedCount}</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Recorded Hours</div><div className="adminMetricValue">{duration(data.totalWorkedMinutes)}</div></div>
          </div>

          <section className="attendanceCard">
            <div className="attendanceCardHeading">
              <h2>Employee Time Records</h2>
              <span>Active employees always appear, even outside the selected range.</span>
            </div>
            {data.items.length === 0 ? (
              <div className="attendanceEmpty">No time records found for this date range.</div>
            ) : (
              <div className="attendanceTableWrap">
                <table className="attendanceTable">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Break</th>
                      <th>Hours</th>
                      <th>Status</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((record) => (
                      <tr key={record.id}>
                        <td><strong>{record.employee.name}</strong><small>ID {record.employee.employeeCode ?? "-"}</small></td>
                        <td>{new Date(record.loginAt).toLocaleString()}</td>
                        <td>{record.logoutAt ? new Date(record.logoutAt).toLocaleString() : "-"}</td>
                        <td>{record.breakMinutes} min</td>
                        <td>{duration(record.workedMinutes)}</td>
                        <td><span className={`attendanceBadge ${record.logoutAt ? "complete" : "active"}`}>{record.logoutAt ? "Complete" : "Clocked In"}</span></td>
                        <td className="attendanceActions">
                          <button onClick={() => openEdit(record)} type="button">Edit</button>
                          {!record.logoutAt && <button className="clockOutAction" onClick={() => clockOutNow(record)} type="button">Clock Out</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {editing && (
        <div className="attendanceModalOverlay" role="dialog" aria-modal="true">
          <form className="attendanceModal" onSubmit={saveEdit}>
            <div className="attendanceModalHeader">
              <div>
                <h2>Edit Time Record</h2>
                <p>{editing.employee.name} / ID {editing.employee.employeeCode ?? "-"}</p>
              </div>
              <button onClick={() => setEditing(null)} type="button">x</button>
            </div>
            <label><span>Clock In</span><input required type="datetime-local" value={loginAt} onChange={(e) => setLoginAt(e.target.value)} /></label>
            <label><span>Clock Out</span><input type="datetime-local" value={logoutAt} onChange={(e) => setLogoutAt(e.target.value)} /></label>
            <label><span>Break Minutes</span><input min="0" type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} /></label>
            <label><span>Admin Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for correction" /></label>
            <div className="attendanceModalActions">
              <button className="cancel" onClick={() => setEditing(null)} type="button">Cancel</button>
              <button className="save" disabled={saving} type="submit">{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
