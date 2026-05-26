"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./checkout.css";

type Modifier = {
  id: string;
  nameSnapshot: string;
  priceDeltaCents: number;
};

type OrderItem = {
  id: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: number;
  notes?: string | null;
  modifiers?: Modifier[];
};

type StoredPayment = {
  id: string;
  method: "CASH" | "CARD";
  amountCents: number;
  amountReceivedCents?: number | null;
  changeGivenCents?: number | null;
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
  payments?: StoredPayment[];
};

type NewPaymentMethod = "CASH" | "VISA" | "DEBIT" | "MASTERCARD" | "AMEX" | "GIFTCARD";
type PaymentMethod = NewPaymentMethod | "CARD";
type SplitMode = "NONE" | "CUSTOM" | "EQUAL";

type AppliedPayment = {
  method: PaymentMethod;
  amountCents: number;
  tenderedCents: number;
  changeCents: number;
  saved?: boolean;
};

const METHODS: { key: NewPaymentMethod; label: string; icon: string }[] = [
  { key: "CASH", label: "Cash", icon: "$" },
  { key: "VISA", label: "Visa", icon: "V" },
  { key: "DEBIT", label: "Debit", icon: "D" },
  { key: "MASTERCARD", label: "Mastercard", icon: "M" },
  { key: "AMEX", label: "Amex", icon: "A" },
  { key: "GIFTCARD", label: "Gift Card", icon: "G" },
];

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function itemTotalCents(item: OrderItem) {
  const modifierTotal = (item.modifiers ?? []).reduce(
    (sum, modifier) => sum + modifier.priceDeltaCents,
    0
  );
  return (item.basePriceCents + modifierTotal) * item.qty;
}

function methodName(method: PaymentMethod) {
  if (method === "CARD") return "Card";
  return METHODS.find((item) => item.key === method)?.label ?? method;
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const token = useAuthStore((state) => state.token);
  const orderId = String(params.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [confirmedCents, setConfirmedCents] = useState<number | null>(null);
  const [applied, setApplied] = useState<AppliedPayment[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("NONE");
  const [splitCount, setSplitCount] = useState(2);
  const [combineOpen, setCombineOpen] = useState(false);
  const [combineOrders, setCombineOrders] = useState<Order[]>([]);
  const [selectedCombineIds, setSelectedCombineIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load order");
        return response.json();
      })
      .then((data) => {
        const loadedOrder: Order | null = data.order ?? null;
        setOrder(loadedOrder);
        setApplied(
          (loadedOrder?.payments ?? []).map((payment) => ({
            method: payment.method,
            amountCents: payment.amountCents,
            tenderedCents: payment.amountReceivedCents ?? payment.amountCents,
            changeCents: payment.changeGivenCents ?? 0,
            saved: true,
          }))
        );
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load order");
      })
      .finally(() => setLoading(false));
  }, [token, orderId]);

  const subtotalCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.subtotalCents === "number") return order.subtotalCents;
    return order.items.reduce((sum, item) => sum + itemTotalCents(item), 0);
  }, [order]);

  const taxCents = useMemo(() => {
    if (!order) return 0;
    if (typeof order.taxCents === "number") return order.taxCents;
    return Math.round(subtotalCents * 0.13);
  }, [order, subtotalCents]);

  const totalCents = order?.totalCents ?? subtotalCents + taxCents;
  const appliedTotal = applied.reduce((sum, payment) => sum + payment.amountCents, 0);
  const remainingCents = Math.max(0, totalCents - appliedTotal);
  const changeCents = applied.reduce((sum, payment) => sum + payment.changeCents, 0);
  const isPaid = remainingCents === 0 && applied.length > 0;
  const inputCents = Math.round(parseFloat(input || "0") * 100);
  const equalShares = Array.from({ length: splitCount }, (_, index) => {
    const base = Math.floor(totalCents / splitCount);
    return base + (index < totalCents % splitCount ? 1 : 0);
  });
  const nextShareCents = Math.min(
    remainingCents,
    equalShares[Math.min(applied.length, equalShares.length - 1)] ?? remainingCents
  );

  function handleNumpad(key: string) {
    if (key === "back") {
      setInput((previous) => previous.slice(0, -1));
      return;
    }
    if (key === "." && input.includes(".")) return;
    setInput((previous) => previous + key);
  }

  function confirmAmount() {
    setError(null);
    const cents = inputCents > 0 ? inputCents : remainingCents;
    if (cents <= 0) {
      setError("Please enter an amount first.");
      return;
    }
    setConfirmedCents(cents);
  }

  function applyMethod(method: NewPaymentMethod) {
    if (confirmedCents === null) {
      setError("Please confirm an amount first.");
      return;
    }

    if (method !== "CASH" && confirmedCents > remainingCents) {
      setError("A card or gift payment cannot be higher than the remaining bill.");
      return;
    }

    const amountCents = method === "CASH"
      ? Math.min(confirmedCents, remainingCents)
      : confirmedCents;
    const tenderedCents = method === "CASH" ? confirmedCents : amountCents;

    setApplied((previous) => [
      ...previous,
      {
        method,
        amountCents,
        tenderedCents,
        changeCents: method === "CASH" ? tenderedCents - amountCents : 0,
      },
    ]);
    setConfirmedCents(null);
    setInput("");
    setError(null);
  }

  function removePayment(index: number) {
    if (applied[index]?.saved) return;
    setApplied((previous) => previous.filter((_, paymentIndex) => paymentIndex !== index));
    setConfirmedCents(null);
    setError(null);
  }

  async function printBill(orderIds: string[] = [orderId]) {
    if (!token) return;
    try {
      setPrinting(true);
      setError(null);
      setNotice(null);
      const isCombined = orderIds.length > 1;
      const url = isCombined
        ? `${process.env.NEXT_PUBLIC_API_URL}/printer/cashier-combined-receipt`
        : `${process.env.NEXT_PUBLIC_API_URL}/printer/cashier-receipt/${orderId}`;
      const body = isCombined ? { orderIds } : { copy: "check" };
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Bill print failed");
      }
      setNotice(isCombined ? "Combined customer bill printed." : "Customer bill sent to front counter printer.");
      setCombineOpen(false);
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "Could not print bill");
    } finally {
      setPrinting(false);
    }
  }

  async function openCombineSelection() {
    if (!token) return;
    try {
      setError(null);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/orders?paymentStatus=UNPAID`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!response.ok) throw new Error("Could not load open orders");
      const data = await response.json();
      const available = ((data.orders ?? []) as Order[]).filter(
        (candidate) =>
          candidate.id !== orderId &&
          candidate.status !== "CLOSED" &&
          candidate.status !== "CANCELLED"
      );
      setCombineOrders(available);
      setSelectedCombineIds([]);
      setCombineOpen(true);
    } catch (combineError) {
      setError(combineError instanceof Error ? combineError.message : "Could not load open orders");
    }
  }

  async function completePayment() {
    if (!token || !order || !isPaid) return;
    try {
      setPaying(true);
      setError(null);
      for (const payment of applied.filter((item) => !item.saved)) {
        const body: Record<string, string> = {
          method: payment.method === "CASH" ? "CASH" : "CARD",
          amountDollars: centsToDollars(payment.amountCents),
        };
        if (payment.method === "CASH") {
          body.amountReceivedDollars = centsToDollars(payment.tenderedCents);
        }
        const response = await fetch(
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
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || "Payment failed");
        }
      }
      router.push(
        `/pos/orders/${order.id}/receipt?paymentMethod=SPLIT&paidAt=${encodeURIComponent(new Date().toISOString())}`
      );
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <div className="co-loading">Loading...</div>;
  if (!order) return <div className="co-loading">Order not found.</div>;

  const stage: "typing" | "pickMethod" | "done" =
    isPaid ? "done" : confirmedCents !== null ? "pickMethod" : "typing";

  return (
    <div className="co-shell">
      <aside className="co-sidebar">
        <button className="co-back" onClick={() => router.push("/pos/orders")}>
          Back
        </button>

        <div className="co-order-info">
          <div className="co-order-num">Order #{order.orderNumber}</div>
          <div className="co-order-meta">
            {order.type === "DINE_IN" ? "Dine-In" : order.type}
            {order.tableNumber ? ` - Table ${order.tableNumber}` : ""}
          </div>
        </div>

        <button className="co-print-btn" onClick={() => printBill()} disabled={printing}>
          {printing ? "Printing..." : "Print Customer Bill"}
        </button>

        <div className={`co-remaining ${isPaid ? "co-remaining-paid" : ""}`}>
          <div className="co-remaining-label">{isPaid ? "Fully Paid" : "Remaining"}</div>
          <div className="co-remaining-amount">${centsToDollars(remainingCents)}</div>
        </div>

        <div className="co-step-hint">
          {stage === "typing" && "1. Type tender and confirm"}
          {stage === "pickMethod" && "2. Select payment method"}
          {stage === "done" && "3. Complete payment"}
        </div>

        <div className="co-methods">
          {METHODS.map((method) => (
            <button
              key={method.key}
              className={`co-method-btn ${stage === "pickMethod" ? "co-method-ready" : ""}`}
              disabled={stage !== "pickMethod"}
              onClick={() => applyMethod(method.key)}
            >
              <span className="co-method-icon">{method.icon}</span>
              <span className="co-method-label">{method.label}</span>
              {stage === "pickMethod" && (
                <span className="co-method-amount">${centsToDollars(confirmedCents!)}</span>
              )}
            </button>
          ))}
        </div>

        <div className="co-bill">
          <div className="co-bill-row"><span>Subtotal</span><span>${centsToDollars(subtotalCents)}</span></div>
          <div className="co-bill-row"><span>HST (13%)</span><span>${centsToDollars(taxCents)}</span></div>
          <div className="co-bill-row co-bill-total"><span>Total</span><span>${centsToDollars(totalCents)}</span></div>
        </div>

        <section className="co-tools">
          <div className="co-sidebar-label">Bill Tools</div>
          <button className="co-tool-btn" onClick={() => setSplitMode("CUSTOM")}>Split Payment</button>
          <button className="co-tool-btn" onClick={() => setSplitMode("EQUAL")}>Split Equally</button>
          <button className="co-tool-btn" onClick={openCombineSelection}>Combined Bill Print</button>
        </section>
      </aside>

      <main className="co-main">
        <div className="co-items-card">
          <div className="co-card-label">Items</div>
          {order.items.map((item) => (
            <div key={item.id} className="co-item-row">
              <div>
                <div className="co-item-name">{item.qty}x {item.nameSnapshot}</div>
                {(item.modifiers ?? []).map((modifier) => (
                  <div key={modifier.id} className="co-item-modifier">
                    + {modifier.nameSnapshot}
                  </div>
                ))}
                {item.notes && <div className="co-item-note">{item.notes}</div>}
              </div>
              <div className="co-item-price">${centsToDollars(itemTotalCents(item))}</div>
            </div>
          ))}
        </div>

        {splitMode !== "NONE" && !isPaid && (
          <section className="co-tool-panel">
            <div className="co-tool-panel-head">
              <strong>{splitMode === "EQUAL" ? "Split equally" : "Split payment"}</strong>
              <button type="button" onClick={() => setSplitMode("NONE")}>Close</button>
            </div>
            {splitMode === "CUSTOM" ? (
              <p>Enter each guest&apos;s amount below, confirm it, and select how that part is paid.</p>
            ) : (
              <>
                <div className="co-split-controls">
                  <button onClick={() => setSplitCount((count) => Math.max(2, count - 1))}>-</button>
                  <span>{splitCount} payments</span>
                  <button onClick={() => setSplitCount((count) => Math.min(20, count + 1))}>+</button>
                </div>
                <p>Next equal share: <strong>${centsToDollars(nextShareCents)}</strong></p>
                <button
                  className="co-load-share-btn"
                  onClick={() => {
                    setInput(centsToDollars(nextShareCents));
                    setConfirmedCents(null);
                  }}
                >
                  Load Next Share
                </button>
              </>
            )}
          </section>
        )}

        {stage !== "done" && (
          <div className="co-numpad-card">
            <div className="co-card-label">
              {stage === "typing"
                ? "Enter amount received (cash may be more than balance)"
                : `$${centsToDollars(confirmedCents!)} received - now choose payment method`}
            </div>
            <div className={`co-amount-display ${stage === "pickMethod" ? "co-display-confirmed" : ""}`}>
              {stage === "pickMethod"
                ? `$${centsToDollars(confirmedCents!)}`
                : input === ""
                  ? <span className="co-display-placeholder">${centsToDollars(remainingCents)}</span>
                  : `$${parseFloat(input).toFixed(2)}`}
            </div>
            {stage === "typing" && (
              <>
                <div className="co-presets">
                  {[5, 10, 20, 50, 100].map((amount) => (
                    <button key={amount} className="co-preset-btn" onClick={() => setInput(amount.toFixed(2))}>
                      ${amount}
                    </button>
                  ))}
                  <button className="co-preset-btn co-preset-exact" onClick={() => setInput(centsToDollars(remainingCents))}>
                    Exact
                  </button>
                </div>
                <div className="co-numpad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
                    <button key={key} className="co-num-btn" onClick={() => handleNumpad(key)}>
                      {key === "back" ? "Delete" : key}
                    </button>
                  ))}
                </div>
                <button className="co-confirm-btn" onClick={confirmAmount}>
                  Confirm ${inputCents > 0 ? centsToDollars(inputCents) : centsToDollars(remainingCents)}
                </button>
              </>
            )}
            {stage === "pickMethod" && (
              <button className="co-cancel-confirm-btn" onClick={() => { setConfirmedCents(null); setInput(""); }}>
                Change amount
              </button>
            )}
          </div>
        )}

        {applied.length > 0 && (
          <div className="co-applied-card">
            <div className="co-card-label">Payments</div>
            {applied.map((payment, index) => (
              <div key={`${payment.method}-${index}`} className="co-applied-row">
                <span className="co-applied-method">{methodName(payment.method)}</span>
                <span className="co-applied-amount">${centsToDollars(payment.amountCents)}</span>
                {payment.method === "CASH" && payment.tenderedCents !== payment.amountCents && (
                  <span className="co-received">Received ${centsToDollars(payment.tenderedCents)}</span>
                )}
                {!payment.saved && (
                  <button className="co-remove-btn" onClick={() => removePayment(index)} disabled={paying}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            {changeCents > 0 && (
              <div className="co-change-row">
                <span>Change to customer</span>
                <strong>${centsToDollars(changeCents)}</strong>
              </div>
            )}
          </div>
        )}

        {notice && <div className="co-notice">{notice}</div>}
        {error && <div className="co-err">{error}</div>}
        <button className="co-pay-btn" onClick={completePayment} disabled={!isPaid || paying}>
          {paying ? "Processing..." : isPaid ? "Complete Payment" : `$${centsToDollars(remainingCents)} still remaining`}
        </button>
      </main>

      {combineOpen && (
        <div className="co-modal-overlay" role="dialog" aria-modal="true">
          <div className="co-combine-modal">
            <h2>Print Combined Customer Bill</h2>
            <p>Current order #{order.orderNumber} is included. Select other unpaid orders to print together.</p>
            <div className="co-combine-list">
              {combineOrders.length === 0 && <div>No other unpaid orders available.</div>}
              {combineOrders.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="checkbox"
                    checked={selectedCombineIds.includes(candidate.id)}
                    onChange={(event) => {
                      setSelectedCombineIds((previous) =>
                        event.target.checked
                          ? [...previous, candidate.id]
                          : previous.filter((id) => id !== candidate.id)
                      );
                    }}
                  />
                  Order #{candidate.orderNumber}
                  {candidate.tableNumber ? ` - Table ${candidate.tableNumber}` : ""}
                  {" - "}${centsToDollars(candidate.totalCents)}
                </label>
              ))}
            </div>
            <div className="co-modal-actions">
              <button onClick={() => setCombineOpen(false)}>Cancel</button>
              <button
                className="co-modal-primary"
                disabled={selectedCombineIds.length === 0 || printing}
                onClick={() => printBill([orderId, ...selectedCombineIds])}
              >
                {printing ? "Printing..." : "Print Combined Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
