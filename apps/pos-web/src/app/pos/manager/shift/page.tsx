"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import "./shift.css";

type Shift = {
  id: string;
  openedAt: string;
  openingCashCents: number;
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ManagerShiftPage() {
  const token = useAuthStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadCurrentShift() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load shift");

      const data = await res.json();
      setShift(data.shift);
    } catch (e) {
      setError("Could not load shift status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentShift();
  }, []);

  async function openShift() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/open`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          terminalCode: "TABLET-1",
          openingCashCents: Math.round(Number(openingCash || 0) * 100),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error ?? "Failed to open shift");
      }

      await loadCurrentShift();
      setOpeningCash("");
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

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error ?? "Failed to close shift");
      }

      await loadCurrentShift();
      setClosingCash("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to close shift");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shiftShell">
      <h1 className="shiftTitle">Shift Management</h1>

      {loading && <div className="shiftCard">Loading shift status…</div>}

      {!loading && !shift && (
        <div className="shiftCard">
          <h2>No Shift Open</h2>
          <p>The restaurant is currently closed.</p>

          <label className="shiftLabel">Opening Cash (optional)</label>
          <input
            className="shiftInput"
            placeholder="0.00"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            inputMode="decimal"
          />

          <button className="primaryBtn" onClick={openShift} disabled={submitting}>
            {submitting ? "Opening…" : "Open Shift"}
          </button>
        </div>
      )}

      {!loading && shift && (
        <div className="shiftCard">
          <h2>Shift Open</h2>

          <div className="shiftRow">
            <span>Opened At</span>
            <strong>{new Date(shift.openedAt).toLocaleString()}</strong>
          </div>

          <div className="shiftRow">
            <span>Opening Cash</span>
            <strong>${centsToDollars(shift.openingCashCents)}</strong>
          </div>

          <hr className="shiftHr" />

          <label className="shiftLabel">Closing Cash</label>
          <input
            className="shiftInput"
            placeholder="0.00"
            value={closingCash}
            onChange={(e) => setClosingCash(e.target.value)}
            inputMode="decimal"
          />

          <button className="dangerBtn" onClick={closeShift} disabled={submitting}>
            {submitting ? "Closing…" : "Close Shift"}
          </button>
        </div>
      )}

      {error && <div className="shiftError">{error}</div>}
    </main>
  );
}
