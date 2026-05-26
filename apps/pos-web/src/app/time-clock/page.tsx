"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./timeClock.css";

type PunchResult = {
  action: "CLOCK_IN" | "CLOCK_OUT";
  message: string;
  employee: {
    name: string;
    employeeCode: string;
  };
  session: {
    loginAt: string;
    logoutAt: string | null;
    workedMinutes?: number;
  };
};

export default function TimeClockPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PunchResult | null>(null);

  async function submitPunch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!employeeCode.trim() || !pin.trim()) {
      setError("Enter your employee ID and code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/time-clock/punch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: employeeCode.trim(), pin: pin.trim() }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Unable to record your punch.");
      }

      setResult(data as PunchResult);
      setEmployeeCode("");
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record your punch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="clockShell">
      <div className="clockCard">
        <div className="clockBrand">Bombay to Mumbai</div>
        <div className="clockKicker">STAFF TIME CLOCK</div>
        <h1>Clock In / Clock Out</h1>
        <p className="clockIntro">Enter your employee ID and code once when your shift starts, and again when you finish.</p>

        {result && (
          <div className={`clockResult ${result.action === "CLOCK_IN" ? "in" : "out"}`}>
            <strong>{result.action === "CLOCK_IN" ? "Clocked In" : "Clocked Out"}</strong>
            <div>{result.message}</div>
            <span>
              {result.action === "CLOCK_IN"
                ? `Start time: ${new Date(result.session.loginAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : `Hours recorded: ${Math.floor((result.session.workedMinutes ?? 0) / 60)}h ${(result.session.workedMinutes ?? 0) % 60}m`}
            </span>
          </div>
        )}

        <form className="clockForm" onSubmit={submitPunch}>
          <label>
            <span>Employee ID</span>
            <input
              autoFocus
              inputMode="numeric"
              placeholder="e.g. 2001"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
          </label>
          <label>
            <span>Code</span>
            <input
              inputMode="numeric"
              type="password"
              placeholder="Enter your code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
          {error && <div className="clockError">{error}</div>}
          <button className="clockPunchBtn" disabled={loading} type="submit">
            {loading ? "Recording..." : "Clock In / Clock Out"}
          </button>
        </form>

        <button className="clockBackBtn" onClick={() => router.push("/login")} type="button">
          Back to Login
        </button>
      </div>
    </main>
  );
}
