"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./reports.css";

type StaffSession = {
  id: string;
  loginAt: string;
  employee: {
    id: string;
    name: string;
    role: string;
    employeeCode: string | null;
  };
};

type CurrentShift = {
  id: string;
  openedAt: string;
  openingCashCents: number;
  grossSalesCents: number;
  taxCents: number;
  tipCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  orderCount: number;
  staffClockedIn: StaffSession[];
};

type Payment = {
  id: string;
  method: "CASH" | "CARD";
  amountCents: number;
};

type OrderItem = {
  id: string;
  nameSnapshot: string;
  basePriceCents: number;
  qty: number;
  notes: string | null;
};

type TransactionOrder = {
  id: string;
  orderNumber: number;
  type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
  tableNumber: string | null;
  status: string;
  paymentStatus: "UNPAID" | "PAID";
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  createdBy: {
    name: string;
    employeeCode: string | null;
  };
};

type ManagerView = "current-report" | "transactions" | "staff";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function orderType(order: TransactionOrder) {
  if (order.type === "DINE_IN") return `Dine-In${order.tableNumber ? ` / Table ${order.tableNumber}` : ""}`;
  return order.type === "TAKEOUT" ? "Takeout" : "Delivery";
}

function viewFromHash(hash: string): ManagerView {
  const view = hash.replace("#", "");
  if (view === "transactions" || view === "staff") return view;
  return "current-report";
}

export default function ManagerReportsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const managerAccessToken = useAuthStore((s) => s.managerAccessToken);
  const clearManagerAccess = useAuthStore((s) => s.clearManagerAccess);
  const isLoggedInManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  const managerToken = isLoggedInManager ? token : managerAccessToken;
  const isManagerAuthorized = isLoggedInManager || Boolean(managerAccessToken);

  const [shift, setShift] = useState<CurrentShift | null>(null);
  const [orders, setOrders] = useState<TransactionOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clockingOutId, setClockingOutId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ManagerView>("current-report");

  async function loadReport() {
    if (!managerToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [shiftRes, transactionsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/current`, {
          headers: { Authorization: `Bearer ${managerToken}` },
          cache: "no-store",
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/shifts/current/transactions`, {
          headers: { Authorization: `Bearer ${managerToken}` },
          cache: "no-store",
        }),
      ]);

      if (!shiftRes.ok || !transactionsRes.ok) {
        throw new Error("Could not load manager report.");
      }

      const shiftData = await shiftRes.json();
      const transactionData = await transactionsRes.json();
      setShift(shiftData.shift ?? null);
      setOrders(transactionData.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load manager report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerToken]);

  useEffect(() => {
    const syncView = () => setActiveView(viewFromHash(window.location.hash));
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  async function clockOutEmployee(session: StaffSession) {
    if (!managerToken) return;
    const confirmed = window.confirm(`Clock out ${session.employee.name} now?`);
    if (!confirmed) return;

    setClockingOutId(session.id);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shifts/sessions/${session.id}/clock-out`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${managerToken}` },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to clock out employee.");
      }

      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clock out employee.");
    } finally {
      setClockingOutId(null);
    }
  }

  function returnToPos() {
    clearManagerAccess();
    router.push("/pos");
  }

  function selectView(view: ManagerView) {
    setActiveView(view);
    window.history.replaceState(null, "", `#${view}`);
  }

  if (!isManagerAuthorized) {
    return (
      <main className="reportShell">
        <div className="reportError">Manager authorization is required.</div>
        <button className="reportBackBtn" onClick={returnToPos}>Back to POS</button>
      </main>
    );
  }

  return (
    <main className="reportShell">
      <header className="reportHeader">
        <div>
          <div className="reportKicker">MANAGER</div>
          <h1>Current Operations</h1>
          <p>View current-shift totals, order transactions, and clocked-in employees.</p>
        </div>
        <div className="reportHeaderActions">
          <button className="reportBackBtn" onClick={returnToPos}>Back to POS</button>
          <button className="reportRefreshBtn" onClick={loadReport}>Refresh</button>
        </div>
      </header>

      {error && <div className="reportError">{error}</div>}
      {loading && <div className="reportLoading">Loading current report...</div>}

      {!loading && !shift && <div className="reportEmpty">No shift is currently open.</div>}

      {!loading && shift && (
        <div className="reportWorkspace">
          <aside className="reportSidebar" aria-label="Manager sections">
            <div className="sidebarLabel">Controls</div>
            <button
              className={`sidebarOption ${activeView === "current-report" ? "active" : ""}`}
              onClick={() => selectView("current-report")}
              type="button"
            >
              <strong>Current Report</strong>
              <span>Live totals and payments</span>
            </button>
            <button
              className={`sidebarOption ${activeView === "transactions" ? "active" : ""}`}
              onClick={() => selectView("transactions")}
              type="button"
            >
              <strong>Transaction Viewer</strong>
              <span>{orders.length} orders in this shift</span>
            </button>
            <button
              className={`sidebarOption ${activeView === "staff" ? "active" : ""}`}
              onClick={() => selectView("staff")}
              type="button"
            >
              <strong>Clock Out Employee</strong>
              <span>{shift.staffClockedIn.length} clocked in</span>
            </button>
          </aside>

          <div className="reportMainPanel">
          {activeView === "current-report" && (
          <section className="reportSection">
            <div className="sectionHeading">
              <h2>Current Report</h2>
              <span>Opened {new Date(shift.openedAt).toLocaleString()}</span>
            </div>
            <div className="metricGrid">
              <div className="metricCard"><span>Sales</span><strong>{money(shift.grossSalesCents)}</strong></div>
              <div className="metricCard"><span>Orders Paid</span><strong>{shift.orderCount}</strong></div>
              <div className="metricCard"><span>Tax</span><strong>{money(shift.taxCents)}</strong></div>
              <div className="metricCard"><span>Tips</span><strong>{money(shift.tipCents)}</strong></div>
              <div className="metricCard"><span>Cash</span><strong>{money(shift.cashSalesCents)}</strong></div>
              <div className="metricCard"><span>Card</span><strong>{money(shift.cardSalesCents)}</strong></div>
            </div>
          </section>
          )}

          {activeView === "staff" && (
          <section className="reportSection">
            <div className="sectionHeading">
              <h2>Clock Out Employee</h2>
              <span>{shift.staffClockedIn.length} currently clocked in</span>
            </div>
            {shift.staffClockedIn.length === 0 ? (
              <div className="reportEmpty compact">No employees are clocked in.</div>
            ) : (
              <div className="staffList">
                {shift.staffClockedIn.map((session) => (
                  <div className="staffRow" key={session.id}>
                    <div>
                      <strong>{session.employee.name}</strong>
                      <div className="rowMeta">
                        ID {session.employee.employeeCode ?? "-"} / Clocked in {new Date(session.loginAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      className="clockOutBtn"
                      disabled={clockingOutId === session.id}
                      onClick={() => clockOutEmployee(session)}
                    >
                      {clockingOutId === session.id ? "Clocking Out..." : "Clock Out"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {activeView === "transactions" && (
          <section className="reportSection">
            <div className="sectionHeading">
              <h2>Transaction Viewer</h2>
              <span>{orders.length} orders in this shift</span>
            </div>
            {orders.length === 0 ? (
              <div className="reportEmpty compact">No transactions in this shift.</div>
            ) : (
              <div className="transactionList">
                {orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const paidCents = order.payments.reduce((sum, payment) => sum + payment.amountCents, 0);

                  return (
                    <article className="transactionCard" key={order.id}>
                      <button
                        className="transactionSummary"
                        onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                      >
                        <span className="transactionName">
                          <strong>#{order.orderNumber}</strong> {orderType(order)}
                          <small>{new Date(order.createdAt).toLocaleString()} / {order.createdBy.name}</small>
                        </span>
                        <span className={`transactionStatus status-${order.paymentStatus.toLowerCase()}`}>
                          {order.paymentStatus}
                        </span>
                        <strong>{money(order.totalCents)}</strong>
                        <span className="detailsLink">{expanded ? "Hide" : "Details"}</span>
                      </button>

                      {expanded && (
                        <div className="transactionDetails">
                          {order.items.map((item) => (
                            <div className="detailRow" key={item.id}>
                              <span>{item.qty} x {item.nameSnapshot}{item.notes ? ` (${item.notes})` : ""}</span>
                              <strong>{money(item.basePriceCents * item.qty)}</strong>
                            </div>
                          ))}
                          <div className="detailTotals">
                            <div><span>Subtotal</span><strong>{money(order.subtotalCents)}</strong></div>
                            <div><span>Tax</span><strong>{money(order.taxCents)}</strong></div>
                            <div><span>Tip</span><strong>{money(order.tipCents)}</strong></div>
                            <div><span>Paid</span><strong>{money(paidCents)}</strong></div>
                            <div className="detailGrand"><span>Total</span><strong>{money(order.totalCents)}</strong></div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          )}
          </div>
        </div>
      )}
    </main>
  );
}
