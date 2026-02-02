"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
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

type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;

  basePriceCents: number;
  extraCents: number;
  qty: number;

  sideChoice: string;
  spiceLevel: string;

  note?: string;
};

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

  // came from dine-in screen
  const type = params.get("type") ?? "dine-in";
  const table = params.get("table") ?? "";
  const guests = Number(params.get("guests") ?? "1");

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);

  // send to kitchen state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // modifiers popup
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [sideChoice, setSideChoice] = useState<(typeof SIDE_OPTIONS)[number] | null>(null);
  const [spiceLevel, setSpiceLevel] = useState<(typeof SPICE_OPTIONS)[number] | null>(null);

  // note popup
  const [noteLineId, setNoteLineId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // load menu
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
    setSideChoice(null); // nothing selected by default
    setSpiceLevel(null); // nothing selected by default
  }

  function addWithMods(item: MenuItem, side: string, spice: string) {
    const lineId = makeLineId();
    const extraCents = side === "Garlic Naan" ? 100 : 0; // +$1

    setCart((prev) => [
      ...prev,
      {
        lineId,
        menuItemId: item.id,
        name: item.name,
        basePriceCents: item.priceCents,
        extraCents,
        qty: 1,
        sideChoice: side,
        spiceLevel: spice,
        note: "",
      },
    ]);
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((x) => x.lineId !== lineId));
  }

  function decLine(lineId: string) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.lineId === lineId);
      if (idx < 0) return prev;

      const copy = [...prev];
      const nextQty = copy[idx].qty - 1;

      if (nextQty <= 0) return copy.filter((x) => x.lineId !== lineId);

      copy[idx] = { ...copy[idx], qty: nextQty };
      return copy;
    });
  }

  function incLine(lineId: string) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.lineId === lineId);
      if (idx < 0) return prev;

      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
      return copy;
    });
  }

  function openNote(line: CartLine) {
    setNoteLineId(line.lineId);
    setNoteText(line.note ?? "");
  }

  function saveNote() {
    if (!noteLineId) return;

    setCart((prev) =>
      prev.map((l) => (l.lineId === noteLineId ? { ...l, note: noteText.trim() } : l))
    );

    setNoteLineId(null);
    setNoteText("");
  }

  async function sendToKitchen() {
    if (!token) return;
  
    if (cart.length === 0) {
      setSendError("Cart is empty.");
      return;
    }
  
    setSending(true);
    setSendError(null);
  
    // map UI type -> backend enum
    const typeMap: Record<string, "DINE_IN" | "TAKEOUT" | "DELIVERY"> = {
      "dine-in": "DINE_IN",
      takeout: "TAKEOUT",
      delivery: "DELIVERY",
    };
  
    const apiType = typeMap[type] ?? "DINE_IN";
  
    try {
      const payload = {
        type: apiType,
        terminalCode: "TABLET-1", // TODO: later make this dynamic per device/login
        tableNumber: apiType === "DINE_IN" ? table : null,
  
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          qty: l.qty,
          notes: l.note?.trim() || null, // backend uses "notes"
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
        // backend returns JSON like { error: "..." }
        let msg = "Failed to send order";
        try {
          const data = await res.json();
          msg = data?.error || msg;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(msg);
      }
  
      setCart([]);
      router.push("/pos");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send order");
    } finally {
      setSending(false);
    }
  }
  
  const subtotalCents = useMemo(
    () => cart.reduce((sum, line) => sum + (line.basePriceCents + line.extraCents) * line.qty, 0),
    [cart]
  );

  return (
    <main className="builderShell">
      <header className="builderHeader">
        <div className="builderHeaderLeft">
          <div className="builderKicker">ORDER BUILDER</div>

          <div className="builderTitleRow">
            <h1 className="builderTitle">New Order</h1>
            <div className="builderMeta">
              <span className="pill">{type === "dine-in" ? `Dine-in • Table ${table}` : type}</span>
              {Number.isFinite(guests) && guests > 0 && <span className="pill">{guests} guests</span>}
            </div>
          </div>

          <p className="builderSub">Add items from the menu to build the order.</p>
        </div>

        <button className="builderBackBtn" onClick={() => router.back()}>
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

              {(activeCategory?.items?.length ?? 0) === 0 && <div className="panelNote">No items in this category.</div>}
            </div>
          )}
        </section>

        {/* Cart */}
        <aside className="cartPanel">
          <div className="panelTitle">Cart</div>

          {cart.length === 0 && <div className="panelNote">No items yet. Tap items to add.</div>}

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
                        <button type="button" className="qtyBtn" onClick={() => decLine(line.lineId)}>
                          −
                        </button>

                        <div className="qtyNum">{line.qty}</div>

                        <button type="button" className="qtyBtn" onClick={() => incLine(line.lineId)}>
                          +
                        </button>

                        <button type="button" className="noteBtn" onClick={() => openNote(line)} title="Special instruction">
                          📝
                        </button>

                        <button type="button" className="removeBtn" onClick={() => removeLine(line.lineId)} title="Remove item">
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cartTotals">
                <div className="totRow">
                  <span>Subtotal</span>
                  <strong>${centsToDollars(subtotalCents)}</strong>
                </div>

                <div className="totHint">Tax and tips are calculated at checkout.</div>

                {sendError && <div className="panelError">{sendError}</div>}

                <button className="placeBtn" type="button" disabled={sending || cart.length === 0} onClick={sendToKitchen}>
                  {sending ? "Sending..." : "Send to Kitchen"}
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

                const side = sideChoice ?? DEFAULT_SIDE;
                const spice = spiceLevel ?? DEFAULT_SPICE;

                addWithMods(selectedItem, side, spice);
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
