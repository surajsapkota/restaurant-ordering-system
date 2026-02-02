"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import "./dineIn.css";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { io as socketIOClient } from "socket.io-client";


type TableStatus = "available" | "occupied" | "locked" | "needs_payment";

type TableRow = {
  tableNumber: number;
  status: TableStatus;
  orderId?: string;
  lockedById?: string;
  lockedByName?: string | null;
  lockedByMe?: boolean;
  lockExpiresAt?: string;
};

type TablesStatusResponse = {
  count: number;
  tables: TableRow[];
};

export default function DineInPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const TOTAL_TABLES = 60;

  const tables = useMemo(
    () => Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1),
    [TOTAL_TABLES]
  );

  const [guests, setGuests] = useState(2);

  const [statusByTable, setStatusByTable] = useState<Record<number, TableRow>>({});
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const selectedTableRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // keep ref in sync
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  async function fetchStatuses() {
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tables/status?count=${TOTAL_TABLES}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to load table statuses");

      const data: TablesStatusResponse = await res.json();

      const map: Record<number, TableRow> = {};
      for (const t of data.tables) map[t.tableNumber] = t;

      setStatusByTable(map);
    } catch (e) {
      // keep it quiet unless you want to show it
      const msg = e instanceof Error ? e.message : "Failed to load table statuses";
      setErrorMsg(msg);
    }
  }

  async function lockTable(tableNo: number) {
    if (!token) return false;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/tables/${tableNo}/lock`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.status === 409) {
      setErrorMsg("This table is currently in progress by another employee.");
      await fetchStatuses(); // ✅ refresh to show who locked it
      return false;
    }

    if (!res.ok) {
      setErrorMsg("Failed to lock table.");
      return false;
    }

    return true;
  }

  async function unlockTable(tableNo: number) {
    if (!token) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tables/${tableNo}/lock`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Initial fetch + polling (Option A: stop refreshing while a table is selected)
  useEffect(() => {
    if (!token) return;
  
    // first load
    fetchStatuses();
  
    // connect socket to backend
    const socket = socketIOClient(process.env.NEXT_PUBLIC_API_URL as string, {
      transports: ["websocket"],
    });
  
    // when backend says tables changed, refresh once
    const handler = () => {
      fetchStatuses();
    };
  
    socket.on("tables:changed", handler);
  
    return () => {
      socket.off("tables:changed", handler);
      socket.disconnect();
    };
  }, [token]);
  

  // Keep alive: refresh lock expiry while table selected
  useEffect(() => {
    if (!token) return;
    if (!selectedTable) return;

    const interval = setInterval(() => {
      lockTable(selectedTable);
    }, 45000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedTable]);

  // Cleanup on leaving page: unlock selected table
  useEffect(() => {
    return () => {
      const t = selectedTableRef.current;
      if (t) unlockTable(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedRow = selectedTable ? statusByTable[selectedTable] : undefined;
  const selectedStatus = selectedRow?.status ?? (selectedTable ? "available" : null);

  const isLockedByMe = selectedRow?.status === "locked" && selectedRow?.lockedByMe;
  const canContinue = !!selectedTable && (selectedStatus !== "locked" || isLockedByMe);

  async function onSelectTable(t: number) {
    setErrorMsg(null);

    const row = statusByTable[t];
    const status = row?.status ?? "available";

    // Locked by someone else => block
    if (status === "locked" && !row?.lockedByMe) {
      setErrorMsg(
        `Table ${t} is currently in progress by ${row?.lockedByName ?? "another employee"}.`
      );
      return;
    }

    // Unlock previous table if switching
    if (selectedTable && selectedTable !== t) {
      await unlockTable(selectedTable);
    }

    // Lock chosen table (refresh lock even if it was already locked by me)
    const ok = await lockTable(t);
    if (!ok) return;

    setSelectedTable(t);

    // optional: refresh statuses once so UI shows "lockedByMe"
    if (mountedRef.current) fetchStatuses();
  }

  async function onNext() {
    if (!selectedTable) return;

    const row = statusByTable[selectedTable];
    const status = row?.status ?? "available";

    // If occupied / needs payment => open existing order
    if ((status === "occupied" || status === "needs_payment") && row?.orderId) {
      router.push(`/pos/orders/${row.orderId}`);
      return;
    }

    // New order builder
    router.push(`/pos/orders/new?type=dine-in&table=${selectedTable}&guests=${guests}`);
  }

  return (
    <main className="dineShell">
      <div className="dineWrap">
        <header className="dineHeader">
          <div>
            <div className="dineKicker">DINE-IN</div>
            <h1 className="dineTitle">Select Table</h1>
            <p className="dineSub">Choose a table and guest count to continue</p>
          </div>

          <button className="dineBackBtn" onClick={() => router.push("/pos/new-order")}>
            <ArrowLeft size={16} />
            Back
          </button>
        </header>

        <section className="legendCard">
          <div className="legendItem"><span className="dot available" />Available</div>
          <div className="legendItem"><span className="dot occupied" />Occupied</div>
          <div className="legendItem"><span className="dot locked" />In progress</div>
          <div className="legendItem"><span className="dot needs_payment" />Needs payment</div>
        </section>

        {errorMsg && <div className="tableNote">{errorMsg}</div>}

        <section className="guestCard">
          <div className="guestLeft">
            <div className="guestLabel">Guests</div>
            <div className="guestValue">{guests}</div>
          </div>

          <div className="guestControls">
            <button className="guestBtn" onClick={() => setGuests((g) => Math.max(1, g - 1))}>
              −
            </button>
            <button className="guestBtn" onClick={() => setGuests((g) => Math.min(12, g + 1))}>
              +
            </button>
          </div>
        </section>

        <section className="tableCard">
          <div className="tableHeader">
            <div className="tableHeaderTitle">Tables</div>
            <div className="tableHeaderHint">
              Selected:{" "}
              {selectedTable ? (
                <>
                  Table {selectedTable}
                  {selectedRow?.status === "locked"
                    ? selectedRow.lockedByMe
                      ? " • In progress (you)"
                      : ` • Locked by ${selectedRow.lockedByName ?? "employee"}`
                    : selectedRow?.status
                    ? ` • ${selectedRow.status.replace("_", " ")}`
                    : ""}
                </>
              ) : (
                "None"
              )}
            </div>
          </div>

          <div className="tableGrid">
            {tables.map((t) => {
              const row = statusByTable[t];
              const st: TableStatus = row?.status ?? "available";
              const isSelected = selectedTable === t;

              const lockedByMe = st === "locked" && row?.lockedByMe;
              const disabled = st === "locked" && !row?.lockedByMe;

              return (
                <button
                  key={t}
                  type="button"
                  className={`tableBtn status-${st} ${isSelected ? "selected" : ""} ${
                    disabled ? "disabled" : ""
                  }`}
                  disabled={disabled}
                  onClick={() => onSelectTable(t)}
                  title={
                    st === "locked"
                      ? lockedByMe
                        ? "In progress (you)"
                        : `In progress${row?.lockedByName ? ` by ${row.lockedByName}` : ""}`
                      : st
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="tableFooter">
            <button
              className={`nextBtn ${!canContinue ? "disabled" : ""}`}
              disabled={!canContinue}
              onClick={onNext}
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
