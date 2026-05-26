"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./receipt.css";

type OrderItem = {
  id: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: number;
  notes?: string | null;
  modifiers?: {
    id: string;
    nameSnapshot: string;
    priceDeltaCents: number;
  }[];
};

type Order = {
  id: string;
  orderNumber: number;
  type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
  tableNumber: string | null;
  status: "NEW" | "IN_KITCHEN" | "READY" | "CLOSED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PAID";
  paymentMethod?: "CASH" | "CARD" | null;
  subtotalCents?: number;
  taxCents?: number;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatType(type: Order["type"]) {
  if (type === "DINE_IN") return "Dine-In";
  if (type === "TAKEOUT") return "Takeout";
  return "Delivery";
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = useAuthStore((s) => s.token);

  const orderId = String(params.id);
  const paymentMethod = searchParams.get("paymentMethod") ?? "";
  const paidAt = searchParams.get("paidAt") ?? new Date().toISOString();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to load receipt");
      }

      const data = await res.json();
      setOrder(data.order ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load receipt");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const subtotalCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.subtotalCents === "number") return order.subtotalCents;
    return (order.items ?? []).reduce(
      (sum, item) => sum + item.basePriceCents * item.qty,
      0
    );
  }, [order]);

  const taxCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.taxCents === "number") return order.taxCents;
    return Math.round(subtotalCents * 0.13);
  }, [order, subtotalCents]);

  const totalCents = order?.totalCents ?? subtotalCents + taxCents;

  if (loading) {
    return <main className="receiptShell"><div className="receiptWrap">Loading receipt…</div></main>;
  }

  if (error) {
    return (
      <main className="receiptShell">
        <div className="receiptWrap">
          <div className="receiptError">{error}</div>
          <button className="softBtn" onClick={() => router.push("/pos/orders")}>
            Back to Orders
          </button>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="receiptShell">
        <div className="receiptWrap">
          <div className="receiptError">Receipt not found.</div>
          <button className="softBtn" onClick={() => router.push("/pos/orders")}>
            Back to Orders
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="receiptShell">
      <div className="receiptWrap">
        <div className="receiptActions noPrint">
        <button
          className="softBtn"
          onClick={async () => {
            try {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/printer/cashier-receipt/${orderId}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ copy: "receipt" }),
                }
              );

              const data = await res.json();

              if (!res.ok || !data.success) {
                alert(data.message || "Receipt print failed");
                return;
              }

              alert("Receipt printed");
            } catch (err) {
              console.error(err);
              alert("Could not connect to printer");
            }
          }}
        >
          Print Receipt
        </button>
          <button className="softBtn" onClick={() => router.push("/pos/orders")}>
            Back to Orders
          </button>
        </div>

        <section className="receiptCard">
          <div className="receiptBrand">
            <h1>Bombay to Mumbai</h1>
            <p>Paid Receipt</p>
          </div>

          <div className="receiptMeta">
            <div><strong>Order #:</strong> {order.orderNumber}</div>
            <div><strong>Type:</strong> {formatType(order.type)}</div>
            {order.tableNumber ? <div><strong>Table:</strong> {order.tableNumber}</div> : null}
            <div><strong>Created:</strong> {formatDateTime(order.createdAt)}</div>
            <div><strong>Paid:</strong> {formatDateTime(paidAt)}</div>
            <div><strong>Method:</strong> {paymentMethod}</div>
            <div><strong>Status:</strong> PAID</div>
          </div>

          <div className="receiptDivider" />

          <div className="receiptItems">
            {(order.items ?? []).map((item) => {
              const modifierTotal = (item.modifiers ?? []).reduce(
                (sum, modifier) => sum + modifier.priceDeltaCents,
                0
              );
              const lineTotal = (item.basePriceCents + modifierTotal) * item.qty;

              return (
                <div key={item.id} className="receiptLine">
                  <div className="receiptLineLeft">
                    <div className="receiptItemName">
                      {item.qty} × {item.nameSnapshot}
                    </div>
                    {(item.modifiers ?? []).map((modifier) => (
                      <div key={modifier.id} className="receiptItemModifier">
                        + {modifier.nameSnapshot}
                        {modifier.priceDeltaCents > 0
                          ? ` ($${centsToDollars(modifier.priceDeltaCents * item.qty)})`
                          : ""}
                      </div>
                    ))}
                    {item.notes ? <div className="receiptItemNote">{item.notes}</div> : null}
                  </div>
                  <div className="receiptLineRight">${centsToDollars(lineTotal)}</div>
                </div>
              );
            })}
          </div>

          <div className="receiptDivider" />

          <div className="receiptTotals">
            <div className="totRow">
              <span>Subtotal</span>
              <strong>${centsToDollars(subtotalCents)}</strong>
            </div>
            <div className="totRow">
              <span>HST (13%)</span>
              <strong>${centsToDollars(taxCents)}</strong>
            </div>
            <div className="totRow totalRow">
              <span>Total</span>
              <strong>${centsToDollars(totalCents)}</strong>
            </div>
          </div>

          <div className="receiptFooter">
            Thank you for dining with us.
          </div>
        </section>
      </div>
    </main>
  );
}
