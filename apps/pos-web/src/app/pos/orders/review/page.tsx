"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import { useOrderDraftStore } from "@/lib/pos/orderDraftStore";
import "./review.css";

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

const TAX_RATE = 0.13;

type UiType = "dine-in" | "takeout" | "delivery";

export default function ReviewPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAuthStore((s) => s.token);

  const cart = useOrderDraftStore((s) => s.getActiveCart());
  const meta = useOrderDraftStore((s) => s.getActiveMeta());
  const clearActiveCart = useOrderDraftStore((s) => s.clearActiveCart);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftNotOpen, setShiftNotOpen] = useState(false);

  // These come from URL (fallback if meta missing)
  const type = (params.get("type") ?? meta?.type ?? "dine-in") as UiType;
  const table = params.get("table") ?? meta?.table ?? "";
  const guests = Number(params.get("guests") ?? meta?.guests ?? "1");
  const orderId = params.get("orderId") ?? meta?.orderId ?? null;
  const draftId = params.get("draftId") ?? meta?.draftId ?? "";
  const customerName = params.get("customerName") ?? meta?.customerName ?? "";
  const customerPhone = params.get("customerPhone") ?? meta?.customerPhone ?? "";
  const orderNote = params.get("orderNote") ?? meta?.orderNote ?? "";
  const deliveryAddr = params.get("deliveryAddr") ?? meta?.deliveryAddr ?? "";

  const subtotalCents = useMemo(() => {
    return cart.reduce((sum, l) => sum + (l.basePriceCents + l.extraCents) * l.qty, 0);
  }, [cart]);

  const taxCents = Math.round(subtotalCents * TAX_RATE);
  const totalCents = subtotalCents + taxCents;

  function goBackToEdit() {
    const qp = new URLSearchParams();
    qp.set("type", type);

    if (type === "dine-in") {
      qp.set("table", table);
      qp.set("guests", String(guests));
    }

    if (orderId) qp.set("orderId", orderId);
    if (draftId) qp.set("draftId", draftId);
    if (type !== "dine-in") {
      qp.set("customerName", customerName);
      qp.set("customerPhone", customerPhone);
      if (orderNote) qp.set("orderNote", orderNote);
      if (deliveryAddr) qp.set("deliveryAddr", deliveryAddr);
    }

    router.push(`/pos/orders/new?${qp.toString()}`);
  }

  async function confirmAndSend() {
    if (!token) {
      setError("Token missing. Please login again.");
      return;
    }

    if (cart.length === 0) {
      setError("Cart is empty.");
      return;
    }

    setSending(true);
    setError(null);
    setShiftNotOpen(false);

    try {
      // ✅ CASE 1: Adding items to an existing order
      if (orderId) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: cart.map((l) => ({
              menuItemId: l.menuItemId,
              qty: l.qty,
              notes: l.note ?? null,
              sideChoice: l.sideChoice,
              spiceLevel: l.spiceLevel,
              extraCents: l.extraCents,
              modifiers: (l.modifiers ?? []).map((modifier) => ({ id: modifier.id })),
            })),
            sendToKitchen: true,
          }),
        });

        if (!res.ok) {
          let msg = "Failed to add items to existing order";
          try {
            const body = await res.json();
            if (body?.code === "SHIFT_NOT_OPEN") {
              setShiftNotOpen(true);
              return;
            }
            msg = body?.error ?? msg;
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(msg);
        }

        clearActiveCart();
        router.push("/pos/orders");
        return;
      }

      // ✅ CASE 2: Creating a NEW order
      const payload = {
        type: type === "dine-in" ? "DINE_IN" : type.toUpperCase(), // TAKEOUT / DELIVERY
        tableNumber: type === "dine-in" ? table : null,
        customerName: type !== "dine-in" ? customerName : null,
        customerPhone: type !== "dine-in" ? customerPhone : null,
        customerNote: type !== "dine-in" ? orderNote : null,
        deliveryAddr: type === "delivery" ? deliveryAddr : null,
        terminalCode: "TABLET-1",
        sendToKitchen: true,
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          qty: l.qty,
          modifiers: (l.modifiers ?? []).map((modifier) => ({ id: modifier.id })),
          sideChoice: l.sideChoice,
          spiceLevel: l.spiceLevel,
          notes:
            (l.note?.trim() ? `Note: ${l.note.trim()}\n` : "") +
            (l.sideChoice ? `Side: ${l.sideChoice}\n` : "") +
            (l.spiceLevel ? `Spice: ${l.spiceLevel}\n` : "") +
            (l.extraCents ? `Extra: $${(l.extraCents / 100).toFixed(2)}` : ""),
        })),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "Failed to create order";
        try {
          const body = await res.json();
          if (body?.code === "SHIFT_NOT_OPEN") {
            setShiftNotOpen(true);
            return;
          }
          msg = body?.error ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data = await res.json();

      const createdId: string | undefined = data?.order?.id;
      if (!createdId) throw new Error("Order created but no order id returned from API.");

      clearActiveCart();
      router.push("/pos/orders");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="reviewShell">
      <div className="reviewWrap">
        <h1 className="reviewTitle">Review Order</h1>
        <div className="reviewMeta">
          Type: {type} {type === "dine-in" ? `| Table: ${table} | Guests: ${guests}` : ""}
          {type !== "dine-in" ? ` | ${customerName} | ${customerPhone}` : ""}
          {orderId ? " | Existing order" : ""}
        </div>

        <div className="reviewCard">
          {cart.map((l) => (
            <div key={l.lineId} className="reviewLine">
              <div>
                <div className="reviewName">
                  {l.qty}× {l.name}
                </div>
                <div className="reviewSub">
                  {l.sideChoice} • {l.spiceLevel}
                  {(l.modifiers ?? []).map((modifier) => ` • ${modifier.name}`).join("")}
                  {l.note?.trim() ? ` • Note: ${l.note.trim()}` : ""}
                </div>
              </div>

              <div className="reviewPrice">
                ${(((l.basePriceCents + l.extraCents) * l.qty) / 100).toFixed(2)}
              </div>
            </div>
          ))}

          <hr className="reviewHr" />

          <div className="reviewTotals">
            <div className="row">
              <span>Subtotal</span>
              <strong>${centsToDollars(subtotalCents)}</strong>
            </div>
            <div className="row">
              <span>Tax</span>
              <strong>${centsToDollars(taxCents)}</strong>
            </div>
            <div className="row">
              <span>Total</span>
              <strong>${centsToDollars(totalCents)}</strong>
            </div>
          </div>
        </div>

        {shiftNotOpen && (
          <div className="reviewWarning">
            ⚠️ Shift is not open. Please ask a manager to open the shift.
          </div>
        )}

        {error && <div className="reviewError">{error}</div>}

        <div className="reviewActions">
          <button className="secondaryBtn" onClick={goBackToEdit} disabled={sending}>
            Back to Edit
          </button>

          <button
            className="primaryBtn"
            onClick={confirmAndSend}
            disabled={sending || shiftNotOpen}
          >
            {sending ? "Sending…" : "Confirm & Send to Kitchen"}
          </button>
        </div>
      </div>
    </main>
  );
}
