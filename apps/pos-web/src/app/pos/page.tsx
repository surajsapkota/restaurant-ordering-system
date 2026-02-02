"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./pos.css";

type Summary = { open: number; kitchen: number; ready: number };

export default function PosHomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

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

  return (
    <div className="posWrap">
      <section className="summaryCard">
        <div className="summaryHeader">
          <div className="summaryTitle">Order Summary</div>
        </div>

        {loadingSummary && <div className="summaryLoading">Loading…</div>}

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

      <section className="posActions">
        <button className="primaryAction" onClick={() => router.push("/pos/new-order")}>
        <div className="actionRow">
            <div>
              <span className="actionTitle">New Order</span>
              <span className="actionDesc">
                Start dine-in, takeout, or delivery
              </span>
            </div>
          </div>
        </button>

        <button className="secondaryAction" onClick={() => router.push("/pos/orders")}>
          <span className="actionTitle">Active Orders</span>
          <span className="actionDesc">View orders currently in progress</span>
        </button>
      </section>
    </div>
  );
}
