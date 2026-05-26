"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import "./sales.css";

type ReportPreset = "today" | "yesterday" | "week" | "custom";
type OrderType = "DINE_IN" | "TAKEOUT" | "DELIVERY";

type Modifier = {
  id: string;
  nameSnapshot: string;
  priceDeltaCents: number;
};

type ReportItem = {
  id: string;
  nameSnapshot: string;
  basePriceCents: number;
  qty: number;
  notes: string | null;
  modifiers: Modifier[];
};

type ReportPayment = {
  id: string;
  method: "CASH" | "CARD";
  amountCents: number;
};

type ReportOrder = {
  id: string;
  orderNumber: number;
  type: OrderType;
  tableNumber: string | null;
  closedAt: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  createdBy: {
    name: string;
    employeeCode: string | null;
  };
  items: ReportItem[];
  payments: ReportPayment[];
};

type SalesReport = {
  range: { from: string; to: string };
  summary: {
    totalCents: number;
    netSalesCents: number;
    discountCents: number;
    taxCents: number;
    tipCents: number;
    orderCount: number;
    averageOrderCents: number;
    cancelledCount: number;
  };
  paymentBreakdown: {
    cashCents: number;
    cardCents: number;
  };
  orderTypeBreakdown: Record<OrderType, { count: number; salesCents: number }>;
  orders: ReportOrder[];
};

function asInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForPreset(preset: Exclude<ReportPreset, "custom">) {
  const today = new Date();
  const from = new Date(today);
  const to = new Date(today);

  if (preset === "yesterday") {
    from.setDate(today.getDate() - 1);
    to.setDate(today.getDate() - 1);
  }

  if (preset === "week") {
    from.setDate(today.getDate() - today.getDay());
  }

  return { from: asInputDate(from), to: asInputDate(to) };
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function typeLabel(type: OrderType) {
  if (type === "DINE_IN") return "Dine-In";
  return type === "TAKEOUT" ? "Takeout" : "Delivery";
}

export default function AdminSalesPage() {
  const token = useAuthStore((s) => s.token);
  const initialRange = rangeForPreset("today");

  const [preset, setPreset] = useState<ReportPreset>("today");
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (from: string, to: string) => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/sales?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Could not load sales report.");
      }

      setReport(data as SalesReport);
      setExpandedOrderId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sales report.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadReport(initialRange.from, initialRange.to);
    // Load the opening Today view once for the authenticated admin session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReport]);

  function selectPreset(nextPreset: Exclude<ReportPreset, "custom">) {
    const range = rangeForPreset(nextPreset);
    setPreset(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
    loadReport(range.from, range.to);
  }

  function applyCustomRange() {
    setPreset("custom");
    loadReport(fromDate, toDate);
  }

  return (
    <div className="salesPage">
      <div className="adminPageHeader">
        <div>
          <div className="adminPageTitle">Sales &amp; Reports</div>
          <p className="adminPageSubtitle">Completed sales, payment mix, order types, and transaction details.</p>
        </div>
        <button className="adminPrimaryBtn" onClick={() => loadReport(fromDate, toDate)} type="button">
          Refresh
        </button>
      </div>

      <section className="salesFilterCard">
        <div className="salesPresetGroup">
          <button className={`adminFilterBtn ${preset === "today" ? "active" : ""}`} onClick={() => selectPreset("today")} type="button">Today</button>
          <button className={`adminFilterBtn ${preset === "yesterday" ? "active" : ""}`} onClick={() => selectPreset("yesterday")} type="button">Yesterday</button>
          <button className={`adminFilterBtn ${preset === "week" ? "active" : ""}`} onClick={() => selectPreset("week")} type="button">This Week</button>
        </div>
        <div className="salesCustomRange">
          <label>
            <span>From</span>
            <input className="adminInput" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label>
            <span>To</span>
            <input className="adminInput" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <button className={`salesApplyBtn ${preset === "custom" ? "selected" : ""}`} onClick={applyCustomRange} type="button">
            Apply Dates
          </button>
        </div>
      </section>

      {error && <div className="salesError">{error}</div>}
      {loading && <div className="salesLoading">Loading sales report...</div>}

      {!loading && report && (
        <>
          <div className="salesMetrics">
            <div className="adminMetricCard"><div className="adminMetricLabel">Total Collected</div><div className="adminMetricValue">{money(report.summary.totalCents)}</div><div className="adminMetricSub">{report.summary.orderCount} paid orders</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Net Sales</div><div className="adminMetricValue">{money(report.summary.netSalesCents)}</div><div className="adminMetricSub">Before tax and tips</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Tax</div><div className="adminMetricValue">{money(report.summary.taxCents)}</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Tips</div><div className="adminMetricValue">{money(report.summary.tipCents)}</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Discounts</div><div className="adminMetricValue">{money(report.summary.discountCents)}</div></div>
            <div className="adminMetricCard"><div className="adminMetricLabel">Average Order</div><div className="adminMetricValue">{money(report.summary.averageOrderCents)}</div><div className="adminMetricSub">{report.summary.cancelledCount} cancelled</div></div>
          </div>

          <div className="salesBreakdownGrid">
            <section className="salesCard">
              <div className="salesCardTitle">Payment Breakdown</div>
              <div className="salesBreakdownRow"><span>Cash</span><strong>{money(report.paymentBreakdown.cashCents)}</strong></div>
              <div className="salesBar"><span style={{ width: `${report.summary.totalCents ? (report.paymentBreakdown.cashCents / report.summary.totalCents) * 100 : 0}%` }} /></div>
              <div className="salesBreakdownRow"><span>Card</span><strong>{money(report.paymentBreakdown.cardCents)}</strong></div>
              <div className="salesBar card"><span style={{ width: `${report.summary.totalCents ? (report.paymentBreakdown.cardCents / report.summary.totalCents) * 100 : 0}%` }} /></div>
            </section>

            <section className="salesCard">
              <div className="salesCardTitle">Order Type Breakdown</div>
              {(["DINE_IN", "TAKEOUT", "DELIVERY"] as OrderType[]).map((type) => (
                <div className="salesTypeRow" key={type}>
                  <span>{typeLabel(type)}</span>
                  <small>{report.orderTypeBreakdown[type].count} orders</small>
                  <strong>{money(report.orderTypeBreakdown[type].salesCents)}</strong>
                </div>
              ))}
            </section>
          </div>

          <section className="salesCard transactionsCard">
            <div className="salesCardHeading">
              <div className="salesCardTitle">Transactions</div>
              <span>{report.range.from} to {report.range.to}</span>
            </div>

            {report.orders.length === 0 ? (
              <div className="salesEmpty">No paid transactions found in this date range.</div>
            ) : (
              <div className="salesTransactions">
                {report.orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  return (
                    <article className="salesTransaction" key={order.id}>
                      <button className="salesTransactionSummary" onClick={() => setExpandedOrderId(expanded ? null : order.id)} type="button">
                        <span>
                          <strong>#{order.orderNumber}</strong> {typeLabel(order.type)}
                          {order.tableNumber ? ` / Table ${order.tableNumber}` : ""}
                          <small>{new Date(order.closedAt).toLocaleString()} / {order.createdBy.name}</small>
                        </span>
                        <span className="paidBadge">Paid</span>
                        <strong>{money(order.totalCents)}</strong>
                        <span className="salesDetailsLink">{expanded ? "Hide" : "Details"}</span>
                      </button>
                      {expanded && (
                        <div className="salesDetails">
                          {order.items.map((item) => {
                            const modifiersCents = item.modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaCents, 0);
                            return (
                              <div className="salesLine" key={item.id}>
                                <span>
                                  {item.qty} x {item.nameSnapshot}
                                  {item.modifiers.map((modifier) => ` + ${modifier.nameSnapshot}`).join("")}
                                </span>
                                <strong>{money((item.basePriceCents + modifiersCents) * item.qty)}</strong>
                              </div>
                            );
                          })}
                          <div className="salesDetailTotals">
                            <div><span>Subtotal</span><strong>{money(order.subtotalCents)}</strong></div>
                            <div><span>Discount</span><strong>-{money(order.discountCents)}</strong></div>
                            <div><span>Tax</span><strong>{money(order.taxCents)}</strong></div>
                            <div><span>Tip</span><strong>{money(order.tipCents)}</strong></div>
                            <div className="salesTotal"><span>Total</span><strong>{money(order.totalCents)}</strong></div>
                          </div>
                          <div className="salesPayments">
                            {order.payments.map((payment) => (
                              <span key={payment.id}>{payment.method}: {money(payment.amountCents)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
