import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DraftType = "dine-in" | "takeout" | "delivery";

export type DraftMeta = {
  type: DraftType;
  table?: string;
  guests?: number;
  orderId?: string | null; // existing order
  terminalCode?: string;
  draftId?: string;
  customerName?: string;
  customerPhone?: string;
  orderNote?: string;
  deliveryAddr?: string;
};

export type DraftModifier = {
  id: string;
  name: string;
  priceDeltaCents: number;
};

export type DraftLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  basePriceCents: number;
  extraCents: number;
  qty: number;
  sideChoice: string;
  spiceLevel: string;
  modifiers: DraftModifier[];
  note?: string;
};

type Draft = {
  meta: DraftMeta;
  cart: DraftLine[];
  hydratedFromServer?: boolean;
};

type State = {
  activeKey: string;
  drafts: Record<string, Draft>;

  // ✅ used by your Builder
  openDraft: (key: string, meta: DraftMeta) => void;

  // ✅ used by Builder/Review
  getActiveCart: () => DraftLine[];
  getActiveMeta: () => DraftMeta | null;

  // actions used by Builder
  addLine: (line: DraftLine) => void;
  incQty: (lineId: string) => void;
  decQty: (lineId: string) => void;
  removeLine: (lineId: string) => void;
  setNote: (lineId: string, note: string) => void;

  // ✅ used by Review
  clearActiveCart: () => void;

  // (optional helpers)
  replaceCart: (lines: DraftLine[]) => void;
  markHydrated: () => void;
};

function ensureDraft(drafts: Record<string, Draft>, key: string): Draft {
  if (!drafts[key]) {
    drafts[key] = {
      meta: { type: "dine-in", orderId: null },
      cart: [],
      hydratedFromServer: false,
    };
  }
  return drafts[key];
}

export const useOrderDraftStore = create<State>()(
  persist(
    (set, get) => ({
      activeKey: "default",
      drafts: {
        default: { meta: { type: "dine-in", orderId: null }, cart: [], hydratedFromServer: false },
      },

      openDraft: (key, meta) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, key);

          drafts[key] = {
            ...d,
            meta: { ...d.meta, ...meta },
          };

          return { activeKey: key, drafts };
        }),

      getActiveCart: () => {
        const { activeKey, drafts } = get();
        return drafts[activeKey]?.cart ?? [];
      },

      getActiveMeta: () => {
        const { activeKey, drafts } = get();
        return drafts[activeKey]?.meta ?? null;
      },

      addLine: (line) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = { ...d, cart: [...d.cart, line] };
          return { drafts };
        }),

      incQty: (lineId) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = {
            ...d,
            cart: d.cart.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l)),
          };
          return { drafts };
        }),

      decQty: (lineId) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = {
            ...d,
            cart: d.cart.map((l) =>
              l.lineId === lineId ? { ...l, qty: Math.max(1, l.qty - 1) } : l
            ),
          };
          return { drafts };
        }),

      removeLine: (lineId) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = { ...d, cart: d.cart.filter((l) => l.lineId !== lineId) };
          return { drafts };
        }),

      setNote: (lineId, note) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = {
            ...d,
            cart: d.cart.map((l) => (l.lineId === lineId ? { ...l, note } : l)),
          };
          return { drafts };
        }),

      clearActiveCart: () =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = { ...d, cart: [], hydratedFromServer: false };
          return { drafts };
        }),

      replaceCart: (lines) =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = { ...d, cart: lines };
          return { drafts };
        }),

      markHydrated: () =>
        set((state) => {
          const drafts = { ...state.drafts };
          const d = ensureDraft(drafts, state.activeKey);
          drafts[state.activeKey] = { ...d, hydratedFromServer: true };
          return { drafts };
        }),
    }),
    { name: "pos-order-drafts" }
  )
);
