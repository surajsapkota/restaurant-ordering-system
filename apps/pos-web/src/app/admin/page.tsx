"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";

type ShiftData = {
  id: string;
  status: string;
  terminalCode: string;
  openedAt: string;
  openingCashCents: number;
  orderCount: number;
  grossSalesCents: number;
  taxCents: number;
  tipCents: number;
  openedBy?: { name: string };
};

type SessionData = {
  id: string;
  employee: { name: string };
  loginAt: string;
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function AdminOverviewPage() {
  const token = useAuthStore((s) => s.token);

  const [shift, setShift] = useState<ShiftData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const [shiftRes, sessionsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/current`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/employees/sessions/active`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (shiftRes.ok) {
          const data = await shiftRes.json();
          setShift(data.shift ?? null);
        }

        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setSessions(data.sessions ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  return (
    <div>
      <div className="adminPageTitle">Overview</div>

      {loading && <p style={{ color: "rgba(17,24,39,0.6)", fontSize: 14 }}>Loading...</p>}

      {!loading && (
        <>
          {/* Metrics */}
          <div className="adminMetrics">
            <div className="adminMetricCard">
              <div className="adminMetricLabel">Gross Sales Today</div>
              <div className="adminMetricValue">
                ${centsToDollars(shift?.grossSalesCents ?? 0)}
              </div>
              <div className="adminMetricSub">{shift?.orderCount ?? 0} orders</div>
            </div>
            <div className="adminMetricCard">
              <div className="adminMetricLabel">Tax Collected</div>
              <div className="adminMetricValue">
                ${centsToDollars(shift?.taxCents ?? 0)}
              </div>
            </div>
            <div className="adminMetricCard">
              <div className="adminMetricLabel">Tips Today</div>
              <div className="adminMetricValue">
                ${centsToDollars(shift?.tipCents ?? 0)}
              </div>
            </div>
            <div className="adminMetricCard">
              <div className="adminMetricLabel">Clocked In</div>
              <div className="adminMetricValue">{sessions.length}</div>
              <div className="adminMetricSub">staff on shift</div>
            </div>
          </div>

          {/* Cards row */}
          <div className="adminRow">
            {/* Staff clocked in */}
            <div className="adminCard">
              <div className="adminCardTitle">Staff clocked in</div>
              {sessions.length === 0 && (
                <p style={{ fontSize: 13, color: "rgba(17,24,39,0.5)" }}>
                  No staff clocked in right now.
                </p>
              )}
              {sessions.map((s) => (
                <div key={s.id} className="adminInfoRow">
                  <span>
                    <span className="adminDot" />
                    {s.employee.name}
                  </span>
                  <span className="adminInfoLabel">
                    since {new Date(s.loginAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>

            {/* Current shift */}
            <div className="adminCard">
              <div className="adminCardTitle">
                Current shift{" "}
                {shift ? (
                  <span className="adminBadgeOpen">Open</span>
                ) : (
                  <span className="adminBadgeClosed">No shift</span>
                )}
              </div>
              {!shift && (
                <p style={{ fontSize: 13, color: "rgba(17,24,39,0.5)" }}>
                  No shift is currently open.
                </p>
              )}
              {shift && (
                <>
                  <div className="adminInfoRow">
                    <span className="adminInfoLabel">Terminal</span>
                    <span className="adminInfoValue">{shift.terminalCode}</span>
                  </div>
                  <div className="adminInfoRow">
                    <span className="adminInfoLabel">Opened at</span>
                    <span className="adminInfoValue">
                      {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="adminInfoRow">
                    <span className="adminInfoLabel">Opened by</span>
                    <span className="adminInfoValue">{shift.openedBy?.name ?? "—"}</span>
                  </div>
                  <div className="adminInfoRow">
                    <span className="adminInfoLabel">Opening cash</span>
                    <span className="adminInfoValue">${centsToDollars(shift.openingCashCents)}</span>
                  </div>
                  <div className="adminInfoRow">
                    <span className="adminInfoLabel">Orders so far</span>
                    <span className="adminInfoValue">{shift.orderCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}