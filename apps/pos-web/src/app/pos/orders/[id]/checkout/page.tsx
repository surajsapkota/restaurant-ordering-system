"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./checkout.css";

type OrderItem = {
  id: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: number;
  notes?: string | null;
};

type Order = {
  id: string;
  orderNumber: number;
  type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
  tableNumber: string | null;
  status: string;
  paymentStatus: "UNPAID" | "PAID";
  subtotalCents?: number;
  taxCents?: number;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

type PaymentMethod = "CASH" | "VISA" | "DEBIT" | "MASTERCARD" | "AMEX" | "GIFTCARD";

type AppliedPayment = {
  method: PaymentMethod;
  amountCents: number;
};

const METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "CASH",       label: "Cash",      icon: "💵" },
  { key: "VISA",       label: "Visa",      icon: "💳" },
  { key: "DEBIT",      label: "Debit",     icon: "🏦" },
  { key: "MASTERCARD", label: "Mastercard",icon: "💳" },
  { key: "AMEX",       label: "Amex",      icon: "💳" },
  { key: "GIFTCARD",   label: "Gift Card", icon: "🎁" },
];

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const token = useAuthStore((s) => s.token);
  const orderId = String(params.id);

  const [order, setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Step 1: cashier types an amount
  const [input, setInput] = useState("");

  // Step 2: cashier confirmed the amount — now pick a method
  const [confirmedCents, setConfirmedCents] = useState<number | null>(null);

  // All payments logged so far
  const [applied, setApplied] = useState<AppliedPayment[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setOrder(d.order ?? null))
      .catch(() => setError("Failed to load order"))
      .finally(() => setLoading(false));
  }, [token, orderId]);

  const subtotalCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.subtotalCents === "number") return order.subtotalCents;
    return (order.items ?? []).reduce((s, i) => s + i.basePriceCents * i.qty, 0);
  }, [order]);

  const taxCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.taxCents === "number") return order.taxCents;
    return Math.round(subtotalCents * 0.13);
  }, [order, subtotalCents]);

  const totalCents     = order?.totalCents ?? subtotalCents + taxCents;
  const appliedTotal   = applied.reduce((s, p) => s + p.amountCents, 0);
  const remainingCents = Math.max(0, totalCents - appliedTotal);
  const changeCents    = Math.max(0, appliedTotal - totalCents);
  const isPaid         = remainingCents === 0 && applied.length > 0;

  const inputCents = Math.round(parseFloat(input || "0") * 100);

  // ── Numpad ──
  function handleNumpad(key: string) {
    if (key === "⌫") {
      setInput((p) => p.slice(0, -1));
    } else if (key === "." && input.includes(".")) {
      return;
    } else {
      setInput((p) => p + key);
    }
  }

  function handlePreset(dollars: number) {
    setInput(dollars.toFixed(2));
    setConfirmedCents(null);
  }

  // ── Step 1: Confirm the typed amount ──
  function confirmAmount() {
    setError(null);
    const cents = inputCents > 0 ? inputCents : remainingCents;

    if (cents <= 0) {
      setError("Please enter an amount first.");
      return;
    }
    if (cents > remainingCents) {
      setError(`Amount cannot exceed remaining balance ($${centsToDollars(remainingCents)}).`);
      return;
    }

    setConfirmedCents(cents);
  }

  // ── Step 2: Pick a method for the confirmed amount ──
  function applyMethod(method: PaymentMethod) {
    if (confirmedCents === null) {
      setError("Please confirm an amount first.");
      return;
    }

    setApplied((prev) => [...prev, { method, amountCents: confirmedCents }]);
    setConfirmedCents(null);
    setInput("");
    setError(null);
  }

  function removePayment(index: number) {
    setApplied((prev) => prev.filter((_, i) => i !== index));
    setConfirmedCents(null);
    setError(null);
  }

  // ── Final: send all to backend ──
  async function completePayment() {
    if (!token || !order || !isPaid) return;

    try {
      setPaying(true);
      setError(null);

      for (const p of applied) {
        const backendMethod = p.method === "CASH" ? "CASH" : "CARD";
        const body: Record<string, unknown> = {
          method: backendMethod,
          amountDollars: centsToDollars(p.amountCents),
        };
        if (p.method === "CASH") {
          body.amountReceivedDollars = centsToDollars(p.amountCents);
        }

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/orders/${order.id}/payment`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Payment failed");
        }
      }

      router.push(
        `/pos/orders/${order.id}/receipt?paymentMethod=SPLIT&paidAt=${encodeURIComponent(
          new Date().toISOString()
        )}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="co-loading">Loading…</div>;
  if (!order)  return <div className="co-loading">Order not found.</div>;

  // What stage is the UI in?
  const stage: "typing" | "pickMethod" | "done" =
    isPaid ? "done" : confirmedCents !== null ? "pickMethod" : "typing";

  return (
    <div className="co-shell">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="co-sidebar">
        <button className="co-back" onClick={() => router.push("/pos/orders")}>
          ← Back
        </button>

        <div className="co-order-info">
          <div className="co-order-num">Order #{order.orderNumber}</div>
          <div className="co-order-meta">
            {order.type === "DINE_IN" ? "Dine-In" : order.type}
            {order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
          </div>
        </div>

        {/* Remaining balance */}
        <div className={`co-remaining ${isPaid ? "co-remaining-paid" : ""}`}>
          <div className="co-remaining-label">{isPaid ? "✓ Fully Paid" : "Remaining"}</div>
          <div className="co-remaining-amount">${centsToDollars(remainingCents)}</div>
        </div>

        {/* Step indicator */}
        <div className="co-step-hint">
          {stage === "typing"     && "① Type amount → Confirm"}
          {stage === "pickMethod" && "② Pick payment method"}
          {stage === "done"       && "③ Confirm payment below"}
        </div>

        {/* Method buttons — only active when amount is confirmed */}
        <div className="co-methods">
          {METHODS.map((m) => (
            <button
              key={m.key}
              className={`co-method-btn ${stage === "pickMethod" ? "co-method-ready" : ""}`}
              disabled={stage !== "pickMethod"}
              onClick={() => applyMethod(m.key)}
            >
              <span className="co-method-icon">{m.icon}</span>
              <span className="co-method-label">{m.label}</span>
              {stage === "pickMethod" && (
                <span className="co-method-amount">
                  ${centsToDollars(confirmedCents!)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bill summary */}
        <div className="co-bill">
          <div className="co-bill-row">
            <span>Subtotal</span><span>${centsToDollars(subtotalCents)}</span>
          </div>
          <div className="co-bill-row">
            <span>HST (13%)</span><span>${centsToDollars(taxCents)}</span>
          </div>
          <div className="co-bill-row co-bill-total">
            <span>Total</span><span>${centsToDollars(totalCents)}</span>
          </div>
        </div>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <main className="co-main">

        {/* Items */}
        <div className="co-items-card">
          <div className="co-card-label">Items</div>
          {order.items.map((item) => (
            <div key={item.id} className="co-item-row">
              <div>
                <div className="co-item-name">{item.qty}× {item.nameSnapshot}</div>
                {item.notes && <div className="co-item-note">{item.notes}</div>}
              </div>
              <div className="co-item-price">
                ${centsToDollars(item.basePriceCents * item.qty)}
              </div>
            </div>
          ))}
        </div>

        {/* Numpad — shown only when typing */}
        {stage !== "done" && (
          <div className="co-numpad-card">
            <div className="co-card-label">
              {stage === "typing"
                ? "Enter amount (or leave blank for full remaining balance)"
                : `$${centsToDollars(confirmedCents!)} confirmed — now pick a method on the left`}
            </div>

            {/* Big display */}
            <div className={`co-amount-display ${stage === "pickMethod" ? "co-display-confirmed" : ""}`}>
              {stage === "pickMethod" ? (
                `$${centsToDollars(confirmedCents!)}`
              ) : input === "" ? (
                <span className="co-display-placeholder">
                  ${centsToDollars(remainingCents)}
                </span>
              ) : (
                `$${parseFloat(input).toFixed(2)}`
              )}
            </div>

            {/* Presets — only when typing */}
            {stage === "typing" && (
              <div className="co-presets">
                {[5, 10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    className="co-preset-btn"
                    onClick={() => handlePreset(amt)}
                  >
                    ${amt}
                  </button>
                ))}
                <button
                  className="co-preset-btn co-preset-exact"
                  onClick={() => {
                    setInput(centsToDollars(remainingCents));
                    setConfirmedCents(null);
                  }}
                >
                  Exact
                </button>
              </div>
            )}

            {/* Numpad — only when typing */}
            {stage === "typing" && (
              <div className="co-numpad">
                {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k) => (
                  <button
                    key={k}
                    className="co-num-btn"
                    onClick={() => handleNumpad(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            {/* CONFIRM button */}
            {stage === "typing" && (
              <button className="co-confirm-btn" onClick={confirmAmount}>
                Confirm $
                {inputCents > 0
                  ? parseFloat(input).toFixed(2)
                  : centsToDollars(remainingCents)}
              </button>
            )}

            {/* Cancel confirmed amount — go back to typing */}
            {stage === "pickMethod" && (
              <button
                className="co-cancel-confirm-btn"
                onClick={() => { setConfirmedCents(null); setInput(""); }}
              >
                ← Change amount
              </button>
            )}
          </div>
        )}

        {/* Applied payments log */}
        {applied.length > 0 && (
          <div className="co-applied-card">
            <div className="co-card-label">Payments logged</div>
            {applied.map((p, i) => (
              <div key={i} className="co-applied-row">
                <span className="co-applied-method">
                  {METHODS.find((m) => m.key === p.method)?.icon}{" "}
                  {METHODS.find((m) => m.key === p.method)?.label}
                </span>
                <span className="co-applied-amount">
                  ${centsToDollars(p.amountCents)}
                </span>
                <button
                  className="co-remove-btn"
                  onClick={() => removePayment(i)}
                  disabled={paying}
                >
                  ✕
                </button>
              </div>
            ))}

            {changeCents > 0 && (
              <div className="co-change-row">
                <span>💰 Change to give back</span>
                <strong>${centsToDollars(changeCents)}</strong>
              </div>
            )}
          </div>
        )}

        {error && <div className="co-err">{error}</div>}

        {/* Final confirm */}
        <button
          className="co-pay-btn"
          onClick={completePayment}
          disabled={!isPaid || paying}
        >
          {paying
            ? "Processing…"
            : isPaid
            ? "✓ Complete Payment"
            : `$${centsToDollars(remainingCents)} still remaining`}
        </button>

      </main>
    </div>
  );
}