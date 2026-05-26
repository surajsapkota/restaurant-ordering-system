"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import { useRouter } from "next/navigation";
import "./shift.css";

type Shift = {
  id: string;
  status: string;
  terminalCode: string;
  openedAt: string;
  openingCashCents: number;
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ShiftPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const role = user?.role ?? "EMPLOYEE";
  const isManager = role === "MANAGER" || role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalCode, setTerminalCode] = useState("TABLET-1");
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadShift = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load shift");
      const data = await res.json();
      setShift(data.shift ?? null);
    } catch {
      setError("Could not load shift status.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadShift();
  }, [token, loadShift]);

  async function openShift() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          terminalCode: terminalCode.trim(),
          openingCashCents: Math.round(Number(openingCash || 0) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open shift");
      setOpeningCash("");
      await loadShift();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open shift");
    } finally {
      setSubmitting(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shiftId: shift.id,
          closingCashCents: Math.round(Number(closingCash || 0) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to close shift");
      setClosingCash("");
      await loadShift();
      setNotice(`Day closed. ${data.autoClockedOutCount ?? 0} employees automatically clocked out.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close shift");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (res.ok) {
        const data = await res.json();
        const session = data.session;
  
        // Generate timesheet PDF
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "mm", format: [80, 120] });
  
        const loginTime = new Date(session.loginAt).toLocaleString();
        const logoutTime = new Date(session.logoutAt).toLocaleString();
        const hours = Math.floor(session.workedMinutes / 60);
        const mins = session.workedMinutes % 60;
  
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Bombay to Mumbai", 40, 12, { align: "center" });
  
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Employee Timesheet", 40, 20, { align: "center" });
  
        doc.setLineWidth(0.3);
        doc.line(5, 24, 75, 24);
  
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Employee:", 5, 32);
        doc.setFont("helvetica", "normal");
        doc.text(user?.name ?? "Unknown", 35, 32);
  
        doc.setFont("helvetica", "bold");
        doc.text("Date:", 5, 40);
        doc.setFont("helvetica", "normal");
        doc.text(new Date().toLocaleDateString(), 35, 40);
  
        doc.setFont("helvetica", "bold");
        doc.text("Clock In:", 5, 48);
        doc.setFont("helvetica", "normal");
        doc.text(loginTime, 35, 48);
  
        doc.setFont("helvetica", "bold");
        doc.text("Clock Out:", 5, 56);
        doc.setFont("helvetica", "normal");
        doc.text(logoutTime, 35, 56);
  
        doc.line(5, 62, 75, 62);
  
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Total Hours:", 5, 70);
        doc.text(`${hours}h ${mins}m`, 50, 70);
  
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Thank you for your work today!", 40, 82, { align: "center" });
  
        doc.save(`timesheet-${user?.name}-${new Date().toLocaleDateString()}.pdf`);
      }
    } catch {
      // ignore errors, still log out
    }
  
    clearAuth();
    router.push("/login");
  }

  return (
    <div className="shiftPage">

      {/* Top bar */}
      <div className="shiftTopBar">
        <div>
          <div className="shiftBrand">Bombay to Mumbai</div>
          <div className="shiftWho">
            Logged in as <strong>{user?.name}</strong> · {role}
          </div>
        </div>
        <button className="shiftLogoutBtn" onClick={logout}>
          Logout
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="shiftCard">
          <p className="shiftCardSub">Loading shift status…</p>
        </div>
      )}

      {/* No shift open */}
      {!loading && !shift && (
        <div className="shiftCard">
          <h2 className="shiftCardTitle">No Shift Open</h2>

          {!isManager && (
            <p className="shiftWaitMsg">
              The restaurant is currently closed. Please wait for a manager to open the shift.
            </p>
          )}

          {isManager && (
            <>
              <p className="shiftCardSub">Open the shift to start taking orders.</p>

              <label className="shiftLabel">Terminal Code</label>
              <input
                className="shiftInput"
                value={terminalCode}
                onChange={(e) => setTerminalCode(e.target.value)}
              />

              <label className="shiftLabel">Opening Cash ($)</label>
              <input
                className="shiftInput"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                inputMode="decimal"
              />

              <button
                className="shiftOpenBtn"
                onClick={openShift}
                disabled={submitting}
              >
                {submitting ? "Opening…" : "Open Shift"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Shift is open */}
      {!loading && shift && (
        <div className="shiftCard">
          <h2 className="shiftCardTitle">✅ Shift Open</h2>

          <div className="shiftRow">
            <span className="shiftRowLabel">Terminal</span>
            <span className="shiftRowValue">{shift.terminalCode}</span>
          </div>
          <div className="shiftRow">
            <span className="shiftRowLabel">Opened At</span>
            <span className="shiftRowValue">{new Date(shift.openedAt).toLocaleString()}</span>
          </div>
          <div className="shiftRow">
            <span className="shiftRowLabel">Opening Cash</span>
            <span className="shiftRowValue">${centsToDollars(shift.openingCashCents)}</span>
          </div>

          <hr className="shiftDivider" />

          {/* Employee */}
          {!isManager && (
            <button className="shiftOpenBtn" onClick={() => router.push("/pos")}>
              Go to POS →
            </button>
          )}

          {/* Manager */}
          {isManager && (
            <>
              <label className="shiftLabel">Closing Cash ($)</label>
              <input
                className="shiftInput"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                inputMode="decimal"
              />
              <button
                className="shiftCloseBtn"
                onClick={closeShift}
                disabled={submitting}
              >
                {submitting ? "Closing…" : "Close Shift"}
              </button>
              <button className="shiftGhostBtn" onClick={() => router.push("/pos")}>
                Go to POS →
              </button>
            </>
          )}
        </div>
      )}

      {error && <div className="shiftError">{error}</div>}
      {notice && <div className="shiftSuccess">{notice}</div>}

    </div>
  );
}
