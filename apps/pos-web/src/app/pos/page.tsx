"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, ClipboardList, Clock3, Delete, ShoppingBag, UtensilsCrossed } from "lucide-react";
import DineInTablePanel from "@/components/pos/DineInTablePanel";
import { useAuthStore } from "@/lib/auth/authstore";
import "./pos.css";
import "./new-order/dine-in/dineIn.css";

type Summary = { open: number; kitchen: number; ready: number };
type OffPremiseType = "takeout" | "delivery";

export default function PosHomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [orderType, setOrderType] = useState<OffPremiseType | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [showNumberPad, setShowNumberPad] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;

      try {
        setLoadingSummary(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/active/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        setSummary(await res.json());
      } catch {
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    }

    load();
  }, [token]);

  function openOffPremiseOrder(type: OffPremiseType) {
    setOrderType(type);
    setCustomerName("");
    setCustomerPhone("");
    setOrderNote("");
    setDeliveryAddr("");
    setShowNumberPad(false);
    setIntakeError(null);
  }

  function closeOffPremiseOrder() {
    setOrderType(null);
    setShowNumberPad(false);
    setIntakeError(null);
  }

  function appendPhoneKey(key: string) {
    setCustomerPhone((current) => `${current}${key}`.slice(0, 16));
  }

  function startOffPremiseOrder() {
    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (!name || !phone) {
      setIntakeError("Customer name and phone number are required.");
      return;
    }

    if (!orderType) return;

    const qp = new URLSearchParams({
      type: orderType,
      customerName: name,
      customerPhone: phone,
      orderNote: orderNote.trim(),
      deliveryAddr: deliveryAddr.trim(),
      draftId:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
    });

    router.push(`/pos/orders/new?${qp.toString()}`);
  }

  return (
    <div className="posWrap">
      <aside className="posSidebar">
        <div className="sidebarTitle">Order Types</div>
        <div className="sidebarNav">
          <button className="sidebarAction active" type="button">
            <UtensilsCrossed size={19} />
            <span>
              <strong>Dine-In</strong>
              <small>Tables</small>
            </span>
          </button>

          <button className="sidebarAction" type="button" onClick={() => openOffPremiseOrder("takeout")}>
            <ShoppingBag size={19} />
            <span>
              <strong>Takeout</strong>
              <small>New order</small>
            </span>
          </button>

          <button className="sidebarAction" type="button" onClick={() => openOffPremiseOrder("delivery")}>
            <Bike size={19} />
            <span>
              <strong>Delivery</strong>
              <small>New order</small>
            </span>
          </button>

          <button className="sidebarAction" type="button" onClick={() => router.push("/pos/orders")}>
            <ClipboardList size={19} />
            <span>
              <strong>Active Orders</strong>
              <small>In progress</small>
            </span>
          </button>

          <button className="sidebarAction timeClockAction" type="button" onClick={() => router.push("/time-clock")}>
            <Clock3 size={19} />
            <span>
              <strong>Clock In / Out</strong>
              <small>Staff time clock</small>
            </span>
          </button>
        </div>

        <section className="summaryCard">
          <div className="summaryTitle">Order Summary</div>

          {loadingSummary && <div className="summaryLoading">Loading...</div>}

          {!loadingSummary && summary && (
            <div className="summaryGrid">
              <div className="summaryItem">
                <div className="summaryNum">{summary.open}</div>
                <div className="summaryLbl">Open</div>
              </div>
              <div className="summaryItem">
                <div className="summaryNum">{summary.kitchen}</div>
                <div className="summaryLbl">Kitchen</div>
              </div>
              <div className="summaryItem">
                <div className="summaryNum">{summary.ready}</div>
                <div className="summaryLbl">Ready</div>
              </div>
            </div>
          )}

          {!loadingSummary && !summary && (
            <div className="summaryError">Could not load summary.</div>
          )}
        </section>
      </aside>

      <section className="posWorkspace">
        <header className="workspaceHeader">
          <div>
            <div className="workspaceKicker">Dine-In</div>
            <h1 className="workspaceTitle">Tables</h1>
            <p className="workspaceSub">Choose a table to start or continue an order.</p>
          </div>
        </header>

        <DineInTablePanel />
      </section>

      {orderType && (
        <div className="posModalOverlay" role="dialog" aria-modal="true" onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeOffPremiseOrder();
        }}>
          <div className="posModalCard orderIntakeCard">
            <div className="posModalHeader">
              <div>
                <div className="workspaceKicker">{orderType}</div>
                <div className="posModalTitle">New {orderType === "takeout" ? "Takeout" : "Delivery"} Order</div>
              </div>
              <button className="posModalClose" type="button" onClick={closeOffPremiseOrder}>x</button>
            </div>

            <p className="posModalText">Enter customer details before building the order.</p>

            <div className="orderIntakeFields">
              <label className="posModalField">
                <span>Customer Name *</span>
                <input className="posModalInput" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" autoFocus />
              </label>

              <label className="posModalField">
                <span>Phone Number *</span>
                <button className="phoneDisplay" type="button" onClick={() => setShowNumberPad(true)}>
                  {customerPhone || "Tap to enter number"}
                </button>
              </label>

              {orderType === "delivery" && (
                <label className="posModalField fullWidth">
                  <span>Delivery Address</span>
                  <input className="posModalInput" value={deliveryAddr} onChange={(e) => setDeliveryAddr(e.target.value)} placeholder="Optional delivery address" />
                </label>
              )}

              <label className="posModalField fullWidth">
                <span>Short Note</span>
                <textarea className="posModalInput intakeTextarea" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Optional note, e.g. call on arrival" maxLength={180} />
              </label>
            </div>

            {intakeError && <div className="posModalError">{intakeError}</div>}
            <div className="posModalActions">
              <button className="posModalBtnGhost" type="button" onClick={closeOffPremiseOrder}>Cancel</button>
              <button className="posModalBtnPrimary" type="button" onClick={startOffPremiseOrder}>Start Order</button>
            </div>
          </div>

          {showNumberPad && (
            <div className="numberPadCard" onMouseDown={(e) => e.stopPropagation()}>
              <div className="posModalHeader">
                <div className="posModalTitle">Phone Number</div>
                <button className="posModalClose" type="button" onClick={() => setShowNumberPad(false)}>x</button>
              </div>
              <div className="numberPadDisplay">{customerPhone || "Enter number"}</div>
              <div className="numberPadGrid">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0"].map((key) => (
                  <button key={key} type="button" onClick={() => appendPhoneKey(key)}>{key}</button>
                ))}
                <button type="button" onClick={() => setCustomerPhone((value) => value.slice(0, -1))} aria-label="Delete digit">
                  <Delete size={19} />
                </button>
              </div>
              <div className="numberPadActions">
                <button className="posModalBtnGhost" type="button" onClick={() => setCustomerPhone("")}>Clear</button>
                <button className="posModalBtnPrimary" type="button" onClick={() => setShowNumberPad(false)}>Done</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
