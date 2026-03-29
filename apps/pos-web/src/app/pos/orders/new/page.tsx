"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import { useOrderDraftStore } from "@/lib/pos/orderDraftStore";
import "./newOrderBuilder.css";

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  taxable: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

type MenuCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  items: MenuItem[];
};

type MenuResponse = { categories: MenuCategory[] };

type ExistingOrderItem = {
  id: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: number;
  notes?: string | null;
};

type ExistingOrder = {
  id: string;
  tableNumber: string | null;
  status?: "NEW" | "IN_KITCHEN" | "READY" | "CLOSED" | "CANCELLED";
  paymentStatus?: "UNPAID" | "PAID";
  items: ExistingOrderItem[];
};

// ✅ Fix the "any" error properly:
type MeUser = { role?: "ADMIN" | "MANAGER" | "EMPLOYEE" | string } | null;

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

const SIDE_OPTIONS = ["Rice", "Naan", "Tandoori Roti", "Garlic Naan", "No Side choice"] as const;
const SPICE_OPTIONS = ["Zero Spicy (Kids)", "Mild", "Medium", "Regular", "Hot", "Spicy", "Extra Spicy"] as const;

const DEFAULT_SIDE = "No Side choice";
const DEFAULT_SPICE = "Regular";

export default function NewOrderBuilderPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = useAuthStore((s) => s.token);

  // ✅ IMPORTANT: orderId exists when employee selected an OCCUPIED table
  const orderId = params.get("orderId"); // string | null

  const type = (params.get("type") ?? "dine-in") as "dine-in" | "takeout" | "delivery";
  const table = params.get("table") ?? "";
  const guests = Number(params.get("guests") ?? "1");

  // ✅ role check (no "any")
  const me = useAuthStore((s) => s.user) as MeUser;
  const role = me?.role;
  const canVoid = role === "ADMIN" || role === "MANAGER";

  // Draft store (per table)
  const openDraft = useOrderDraftStore((s) => s.openDraft);
  const cart = useOrderDraftStore((s) => s.getActiveCart());
  const addLine = useOrderDraftStore((s) => s.addLine);
  const incQty = useOrderDraftStore((s) => s.incQty);
  const decQty = useOrderDraftStore((s) => s.decQty);
  const removeLine = useOrderDraftStore((s) => s.removeLine);
  const setNote = useOrderDraftStore((s) => s.setNote);

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Existing order items (read-only display)
  const [existingOrder, setExistingOrder] = useState<ExistingOrder | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // UI errors
  const [actionError, setActionError] = useState<string | null>(null);

  // UI-only popups
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [sideChoice, setSideChoice] = useState<(typeof SIDE_OPTIONS)[number] | null>(null);
  const [spiceLevel, setSpiceLevel] = useState<(typeof SPICE_OPTIONS)[number] | null>(null);

  const [noteLineId, setNoteLineId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // ✅ Key idea: each table/order gets its own draft, so carts never leak.
  useEffect(() => {
    const key = type === "dine-in" ? `dine-in:${table || "unknown"}` : `${type}:single`;

    openDraft(key, {
      type,
      table: type === "dine-in" ? table : undefined,
      guests: type === "dine-in" ? guests : undefined,
      orderId: orderId ?? null,
    });
  }, [type, table, guests, orderId, openDraft]);

  // Load menu
  useEffect(() => {
    async function loadMenu() {
      if (!token) return;

      setLoadingMenu(true);
      setMenuError(null);

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menu`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load menu");

        const data: MenuResponse = await res.json();
        setCategories(data.categories ?? []);

        const first = data.categories?.[0]?.id ?? null;
        setActiveCatId((prev) => prev ?? first);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load menu";
        setMenuError(msg);
        setCategories([]);
        setActiveCatId(null);
      } finally {
        setLoadingMenu(false);
      }
    }

    loadMenu();
  }, [token]);

  // ✅ Fetch existing order (helper so we can reuse after void)
  async function loadExistingOrder() {
    if (!token) return;
    if (!orderId) {
      setExistingOrder(null);
      return;
    }

    setLoadingExisting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load existing order");
      const data = await res.json();
      setExistingOrder(data.order as ExistingOrder);
    } catch {
      setExistingOrder(null);
    } finally {
      setLoadingExisting(false);
    }
  }

  // ✅ If orderId is present, fetch existing order so we can show what was already sent
  useEffect(() => {
    loadExistingOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orderId]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCatId) ?? categories[0],
    [categories, activeCatId]
  );

  function makeLineId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  }

  function openModifiers(item: MenuItem) {
    setSelectedItem(item);
    setSideChoice(null);
    setSpiceLevel(null);
  }

  function addWithMods(item: MenuItem, side: string, spice: string) {
    const lineId = makeLineId();
    const extraCents = side === "Garlic Naan" ? 100 : 0;

    addLine({
      lineId,
      menuItemId: item.id,
      name: item.name,
      basePriceCents: item.priceCents,
      extraCents,
      qty: 1,
      sideChoice: side,
      spiceLevel: spice,
      note: "",
    });
  }

  function openNote(lineId: string, currentNote?: string) {
    setNoteLineId(lineId);
    setNoteText(currentNote ?? "");
  }

  function saveNote() {
    if (!noteLineId) return;
    setNote(noteLineId, noteText.trim());
    setNoteLineId(null);
    setNoteText("");
  }

  // ✅ Manager/Admin void single item (existing order only)
  async function voidExistingItem(orderItemId: string) {
    if (!token || !orderId) return;

    setActionError(null);

    const reason = window.prompt("Void reason (required):");
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/orders/${orderId}/items/${orderItemId}/void`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to void item");
      }

      // ✅ Always reload from backend so UI is correct
      await loadExistingOrder();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to void item");
    }
  }

  const newSubtotalCents = useMemo(
    () => cart.reduce((sum, line) => sum + (line.basePriceCents + line.extraCents) * line.qty, 0),
    [cart]
  );

  // Existing subtotal (display-only)
  const existingSubtotalCents = useMemo(() => {
    if (!existingOrder?.items) return 0;
    return existingOrder.items.reduce((sum, it) => sum + it.basePriceCents * it.qty, 0);
  }, [existingOrder]);

  return (
    <main className="builderShell">
      <header className="builderHeader">
        <div className="builderHeaderLeft">
          <div className="builderKicker">ORDER BUILDER</div>

          <div className="builderTitleRow">
            <h1 className="builderTitle">{orderId ? "Add Items" : "New Order"}</h1>

            <div className="builderMeta">
              <span className="pill">{type === "dine-in" ? `Dine-in • Table ${table}` : type}</span>
              {Number.isFinite(guests) && guests > 0 && <span className="pill">{guests} guests</span>}
              {orderId && <span className="pill">Existing order</span>}
            </div>
          </div>

          <p className="builderSub">
            {orderId
              ? "You can add more items. Existing items are shown below. Manager/Admin can void items."
              : "Add items from the menu to build the order."}
          </p>
        </div>

        <button className="builderBackBtn" onClick={() => router.push("/pos/new-order/dine-in")}>
          Back
        </button>
      </header>

      <div className="builderGrid">
        {/* Categories */}
        <aside className="catPanel">
          <div className="panelTitle">Categories</div>

          {loadingMenu && <div className="panelNote">Loading menu…</div>}
          {!loadingMenu && menuError && <div className="panelError">{menuError}</div>}

          {!loadingMenu && !menuError && (
            <div className="catList">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`catBtn ${c.id === (activeCategory?.id ?? activeCatId) ? "active" : ""}`}
                  onClick={() => setActiveCatId(c.id)}
                >
                  <div className="catName">{c.name}</div>
                  <div className="catCount">{c.items?.length ?? 0}</div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Items */}
        <section className="itemsPanel">
          <div className="panelTitle">{activeCategory?.name ?? "Items"}</div>

          {!loadingMenu && !menuError && (
            <div className="itemsGrid">
              {(activeCategory?.items ?? []).map((it) => (
                <button key={it.id} type="button" className="itemCard" onClick={() => openModifiers(it)}>
                  <div className="itemTop">
                    <div className="itemName">{it.name}</div>
                    <div className="itemPrice">${centsToDollars(it.priceCents)}</div>
                  </div>
                  {it.description && <div className="itemDesc">{it.description}</div>}
                  <div className="itemHint">Tap to add</div>
                </button>
              ))}

              {(activeCategory?.items?.length ?? 0) === 0 && (
                <div className="panelNote">No items in this category.</div>
              )}
            </div>
          )}
        </section>

        {/* Cart */}
        <aside className="cartPanel">
          <div className="panelTitle">Cart</div>

          {actionError && <div className="panelError" style={{ marginBottom: 10 }}>{actionError}</div>}

          {/* Existing items (now: void item support) */}
          {orderId && (
            <div style={{ marginBottom: 12 }}>
              <div className="panelTitle" style={{ fontSize: 13, opacity: 0.8 }}>
                Existing items
              </div>

              {loadingExisting && <div className="panelNote">Loading existing order…</div>}

              {!loadingExisting && existingOrder?.items?.length ? (
                <div className="cartList">
                  {existingOrder.items.map((it) => (
                    <div key={it.id} className="cartRow" style={{ opacity: 0.95 }}>
                      <div className="cartRowLeft">
                        <div className="cartItemName">
                          {it.qty}× {it.nameSnapshot}
                        </div>
                        <div className="cartItemSub">${centsToDollars(it.basePriceCents)} each</div>
                        {it.notes && <div className="cartNote">Note: {it.notes}</div>}
                      </div>

                      <div className="cartRowRight">
                        <button
                          type="button"
                          className={`voidBtn ${canVoid ? "" : "disabled"}`}
                          disabled={!canVoid}
                          title={canVoid ? "Void this item" : "Manager/Admin only"}
                          onClick={() => voidExistingItem(it.id)}
                        >
                          Void
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !loadingExisting && <div className="panelNote">No existing items found.</div>
              )}

              <div className="totRow" style={{ marginTop: 8 }}>
                <span>Existing subtotal</span>
                <strong>${centsToDollars(existingSubtotalCents)}</strong>
              </div>

              <hr style={{ margin: "12px 0", opacity: 0.25 }} />
            </div>
          )}

          {/* New items draft */}
          <div className="panelTitle" style={{ fontSize: 13, opacity: 0.8 }}>
            New items (to send now)
          </div>

          {cart.length === 0 && <div className="panelNote">No new items yet. Tap items to add.</div>}

          {cart.length > 0 && (
            <>
              <div className="cartList">
                {cart.map((line) => {
                  const unitCents = line.basePriceCents + line.extraCents;

                  return (
                    <div key={line.lineId} className="cartRow">
                      <div className="cartRowLeft">
                        <div className="cartItemName">{line.name}</div>

                        <div className="cartItemSub">
                          {line.sideChoice}
                          {line.extraCents > 0 ? ` (+$${centsToDollars(line.extraCents)})` : ""}
                          {" • "}
                          {line.spiceLevel}
                          {" • $"}
                          {centsToDollars(unitCents)} each
                        </div>

                        {line.note && line.note.trim() !== "" && <div className="cartNote">Note: {line.note}</div>}
                      </div>

                      <div className="cartRowRight">
                        <button type="button" className="qtyBtn" onClick={() => decQty(line.lineId)}>
                          −
                        </button>

                        <div className="qtyNum">{line.qty}</div>

                        <button type="button" className="qtyBtn" onClick={() => incQty(line.lineId)}>
                          +
                        </button>

                        <button
                          type="button"
                          className="noteBtn"
                          onClick={() => openNote(line.lineId, line.note)}
                          title="Special instruction"
                        >
                          📝
                        </button>

                        <button
                          type="button"
                          className="removeBtn"
                          onClick={() => removeLine(line.lineId)}
                          title="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cartTotals">
                <div className="totRow">
                  <span>New subtotal</span>
                  <strong>${centsToDollars(newSubtotalCents)}</strong>
                </div>

                <div className="totHint">Tax and tips are calculated at checkout.</div>

                <button
                  className="placeBtn"
                  type="button"
                  onClick={() => {
                    const qp = new URLSearchParams();
                    qp.set("type", type);
                    if (type === "dine-in") {
                      qp.set("table", table);
                      qp.set("guests", String(guests));
                    }
                    if (orderId) qp.set("orderId", orderId);

                    router.push(`/pos/orders/review?${qp.toString()}`);
                  }}
                >
                  Review Order
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* MODIFIERS POPUP */}
      {selectedItem && (
        <div className="popupOverlay" onClick={() => setSelectedItem(null)}>
          <div className="popupCard" onClick={(e) => e.stopPropagation()}>
            <div className="popupHeader">
              <div className="popupTitle">{selectedItem.name}</div>
              <button className="popupClose" type="button" onClick={() => setSelectedItem(null)}>
                ×
              </button>
            </div>

            <div className="popupSection">
              <div className="popupLabel">Side choice (optional)</div>
              <div className="popupRow">
                {SIDE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`popupOption ${sideChoice === opt ? "active" : ""}`}
                    onClick={() => setSideChoice(opt)}
                  >
                    {opt === "Garlic Naan" ? "Garlic Naan (+$1)" : opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="popupSection">
              <div className="popupLabel">Spice level (optional)</div>
              <div className="popupRow">
                {SPICE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`popupOption ${spiceLevel === opt ? "active" : ""}`}
                    onClick={() => setSpiceLevel(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="popupAddBtn"
              type="button"
              onClick={() => {
                if (!selectedItem) return;
                addWithMods(selectedItem, sideChoice ?? DEFAULT_SIDE, spiceLevel ?? DEFAULT_SPICE);
                setSelectedItem(null);
              }}
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}

      {/* NOTE POPUP */}
      {noteLineId && (
        <div className="popupOverlay" onClick={() => setNoteLineId(null)}>
          <div className="popupCard" onClick={(e) => e.stopPropagation()}>
            <div className="popupHeader">
              <div className="popupTitle">Special Instruction</div>
              <button className="popupClose" type="button" onClick={() => setNoteLineId(null)}>
                ×
              </button>
            </div>

            <textarea
              className="noteTextarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g., no onion, allergy peanuts, extra sauce..."
            />

            <button className="popupAddBtn" type="button" onClick={saveNote}>
              Save Note
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
