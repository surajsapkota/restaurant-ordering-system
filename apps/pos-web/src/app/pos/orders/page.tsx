"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./order.css";

type OrderItem = {
  id: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: number;
  notes?: string | null;
};

type OrderStatus = "NEW" | "IN_KITCHEN" | "READY" | "CLOSED" | "CANCELLED";
type OrderType = "DINE_IN" | "TAKEOUT" | "DELIVERY";
type PaymentStatus = "UNPAID" | "PAID";
type PaymentMethod = "CASH" | "CARD";

type Order = {
  id: string;
  orderNumber: number;
  type: OrderType;
  tableNumber: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};
const STATUS_OPTIONS = ["NEW", "IN_KITCHEN", "READY", "CLOSED", "CANCELLED"] as const;
const TYPE_OPTIONS = ["DINE_IN", "TAKEOUT", "DELIVERY"] as const;
const PAYMENT_OPTIONS = ["UNPAID", "PAID"] as const;

function isOneOf<T extends readonly string[]>(arr: T, v: string): v is T[number] {
  return (arr as readonly string[]).includes(v);
}

function centsToDollars(c: number) {
  return (c / 100).toFixed(2);
}

function formatType(t: OrderType) {
  return t === "DINE_IN" ? "Dine-In" : t === "TAKEOUT" ? "Takeout" : "Delivery";
}

function formatStatus(s: OrderStatus) {
  if (s === "IN_KITCHEN") return "In Kitchen";
  if (s === "CANCELLED") return "Cancelled";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function OrdersPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user as { role?: string } | null);
  const role = me?.role;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // UI controls
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | OrderType>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    if (!token) {
      setLoading(false);
      setErr("Token missing. Please login again.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to load orders");
      }

      const data = await res.json();
      setOrders((data.orders ?? []) as Order[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // auto refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, token]);

  /**
   * ✅ POS RULE:
   * Active orders screen shows ONLY:
   *  - status: NEW | IN_KITCHEN | READY
   *  - paymentStatus: UNPAID
   * PAID orders must be CLOSED and should not appear here.
   */
  const activeOrders = useMemo(() => {
    const base = orders.filter(
      (o) =>
        o.paymentStatus === "UNPAID" &&
        o.status !== "CLOSED" &&
        o.status !== "CANCELLED"
    );
  

    const filtered = base.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && o.type !== typeFilter) return false;
      if (paymentFilter !== "ALL" && o.paymentStatus !== paymentFilter) return false;

      if (q.trim()) {
        const s = q.trim().toLowerCase();
        const hay =
          `${o.orderNumber} ${o.type} ${o.tableNumber ?? ""} ${o.status} ${o.paymentStatus} ` +
          (o.items ?? []).map((it) => it.nameSnapshot).join(" ");
        if (!hay.toLowerCase().includes(s)) return false;
      }

      return true;
    });

    // NEW first, then IN_KITCHEN, then READY
    const rank = (s: OrderStatus) => (s === "NEW" ? 0 : s === "IN_KITCHEN" ? 1 : 2);
    return filtered.sort((a, b) => rank(a.status) - rank(b.status));
  }, [orders, q, statusFilter, typeFilter, paymentFilter]);

  const summary = useMemo(() => {
    const base = orders.filter(
      (o) =>
        o.status !== "CANCELLED" &&
        o.status !== "CLOSED" &&
        o.paymentStatus === "UNPAID"
    );

    return {
      open: base.filter((o) => o.status === "NEW").length,
      kitchen: base.filter((o) => o.status === "IN_KITCHEN").length,
      ready: base.filter((o) => o.status === "READY").length,
    };
  }, [orders]);

  async function setStatus(orderId: string, status: OrderStatus) {
    if (!token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  /**
   * ✅ POS RULE: Pay & Close
   * This calls backend PATCH /orders/:id/payment which sets:
   *  - paymentStatus = PAID
   *  - status = CLOSED
   * So it disappears from Active Orders.
  //  */
  // async function payAndClose(orderId: string, method: PaymentMethod) {
  //   if (!token) return;
  //   try {
  //     const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/payment`, {
  //       method: "PATCH",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${token}`,
  //       },
  //       body: JSON.stringify({ method }),
  //     });

  //     if (!res.ok) throw new Error(await res.text());

  //     // ✅ Reload so it disappears instantly
  //     await load();
  //   } catch (e) {
  //     setErr(e instanceof Error ? e.message : "Failed to update payment");
  //   }
  // }

  function openOrder(order: Order) {
    if (order.type === "DINE_IN" && order.tableNumber) {
      router.push(
        `/pos/orders/new?type=dine-in&table=${order.tableNumber}&guests=1&orderId=${order.id}`
      );
      return;
    }
    router.push(`/pos/orders/new?type=${order.type.toLowerCase()}&orderId=${order.id}`);
  }

  const canVoid = role === "ADMIN" || role === "MANAGER";

  return (
    <main className="ordersShell">
      <div className="ordersWrap">
        <header className="ordersHeader">
          <div className="ordersHeaderLeft">
            <button className="iconBtn" onClick={() => router.push("/pos")} title="Back to Tables">
              ←
            </button>

            <div>
              <div className="ordersKicker">ORDERS</div>
              <h1 className="ordersTitle">Active Orders</h1>
              <p className="ordersSub">
                Search, filter, open orders, send to kitchen, mark ready, and pay to close.
              </p>
            </div>
          </div>

          <div className="ordersHeaderRight">
            <button className="gradBtn" onClick={() => router.push("/pos")}>
              + New Order
            </button>
            <button className="softBtn" onClick={load}>
              Refresh
            </button>
          </div>
        </header>

        <section className="summaryRow">
          <div className="summaryCard">
            <div className="summaryLabel">New</div>
            <div className="summaryValue">{summary.open}</div>
          </div>
          <div className="summaryCard">
            <div className="summaryLabel">In Kitchen</div>
            <div className="summaryValue">{summary.kitchen}</div>
          </div>
          <div className="summaryCard">
            <div className="summaryLabel">Ready</div>
            <div className="summaryValue">{summary.ready}</div>
          </div>

          <label className="autoRefresh">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
        </section>

        <section className="controlsBar">
          <div className="searchBox">
            <span className="searchIcon">⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by table, order #, item name…" />
          </div>

          <div className="filters">
            <select
                value={statusFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "ALL") return setStatusFilter("ALL");
                  if (isOneOf(STATUS_OPTIONS, v)) setStatusFilter(v);
                }}
              >
                <option value="ALL">All Status</option>
                <option value="NEW">New</option>
                <option value="IN_KITCHEN">In Kitchen</option>
                <option value="READY">Ready</option>
            </select>


            <select
              value={typeFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "ALL") return setTypeFilter("ALL");
                if (isOneOf(TYPE_OPTIONS, v)) setTypeFilter(v);
              }}
            >
              <option value="ALL">All Types</option>
              <option value="DINE_IN">Dine-In</option>
              <option value="TAKEOUT">Takeout</option>
              <option value="DELIVERY">Delivery</option>
            </select>


            <select
              value={paymentFilter}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "ALL") return setPaymentFilter("ALL");
                if (isOneOf(PAYMENT_OPTIONS, v)) setPaymentFilter(v);
              }}
            >
              <option value="ALL">All Payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </select>

          </div>
        </section>

        {loading && <div className="panelNote">Loading orders…</div>}
        {!loading && err && <div className="panelError">{err}</div>}

        {!loading && !err && activeOrders.length === 0 && (
          <div className="panelNote">No active unpaid orders found.</div>
        )}

        {!loading && !err && activeOrders.length > 0 && (
          <section className="ordersGrid">
            {activeOrders.map((o) => {
              const itemCount = (o.items ?? []).reduce((sum, it) => sum + (it.qty ?? 0), 0);

              return (
                <div key={o.id} className="orderCard">
                  <div className="orderTop">
                    <div className="orderTitle">
                      <span className="orderNo">#{o.orderNumber}</span>
                      <span className="orderType">{formatType(o.type)}</span>
                      {o.tableNumber ? <span className="orderTable">• Table {o.tableNumber}</span> : null}
                    </div>

                    <div className={`badge status-${o.status.toLowerCase()}`}>{formatStatus(o.status)}</div>
                  </div>

                  <div className="orderMeta">
                    <div className="metaPill">
                      Items: <strong>{itemCount}</strong>
                    </div>
                    <div className="metaPill">
                      Total: <strong>${centsToDollars(o.totalCents ?? 0)}</strong>
                    </div>
                    <div className="metaPill pay-unpaid">Unpaid</div>
                  </div>

                  <div className="itemsPreview">
                    {(o.items ?? []).slice(0, 4).map((it) => (
                      <div key={it.id} className="itemLine">
                        <span className="itemQty">{it.qty}×</span>
                        <span className="itemName">{it.nameSnapshot}</span>
                      </div>
                    ))}
                    {(o.items?.length ?? 0) > 4 && <div className="moreLine">+ {o.items.length - 4} more…</div>}
                  </div>

                  <div className="orderActions">
                    <button className="gradBtn wide" onClick={() => openOrder(o)}>
                      Open / Add Items
                    </button>

                    <div className="actionRow">
                      <button
                        className="chipBtn"
                        disabled={o.status === "IN_KITCHEN"}
                        onClick={() => setStatus(o.id, "IN_KITCHEN")}
                      >
                        In Kitchen
                      </button>

                      <button
                        className="chipBtn"
                        disabled={o.status === "READY"}
                        onClick={() => setStatus(o.id, "READY")}
                      >
                        Ready
                      </button>

                      <button
                        className="chipBtn"
                        onClick={() => router.push(`/pos/orders/${o.id}/checkout`)}
                      >
                        Checkout
                      </button>

                      {canVoid && (
                        <button
                          className="dangerBtn"
                          onClick={() => {
                            const reason = prompt("Void reason (required):");
                            if (!reason || !reason.trim()) return;

                            fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${o.id}/void`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ reason: reason.trim() }),
                            })
                              .then(async (r) => {
                                if (!r.ok) throw new Error(await r.text());
                                await load();
                              })
                              .catch((e) => setErr(e instanceof Error ? e.message : "Failed to void"));
                          }}
                        >
                          Void
                        </button>
                      )}
                    </div>

                    <div className="hintRow">
                      <div className="hintText">
                        Tip: After “Pay & Close”, this order disappears and the table becomes available.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
