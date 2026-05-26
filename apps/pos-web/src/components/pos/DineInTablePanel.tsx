"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io as socketIOClient } from "socket.io-client";
import { useAuthStore } from "@/lib/auth/authstore";

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

type TableSocket = {
  on(event: "tables:changed", handler: () => void): void;
  off(event: "tables:changed", handler: () => void): void;
  disconnect(): void;
};

const TOTAL_TABLES = 60;

export default function DineInTablePanel() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const tables = useMemo(() => Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1), []);

  const [guests, setGuests] = useState(2);
  const [statusByTable, setStatusByTable] = useState<Record<number, TableRow>>({});
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const selectedTableRef = useRef<number | null>(null);

  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  async function fetchStatuses() {
    if (!token) return null;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tables/status?count=${TOTAL_TABLES}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to load table statuses");

      const data: TablesStatusResponse = await res.json();
      const map: Record<number, TableRow> = {};
      for (const table of data.tables) map[table.tableNumber] = table;

      setStatusByTable(map);
      return map;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load table statuses");
      return null;
    }
  }

  async function lockTable(tableNo: number) {
    if (!token) return false;

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tables/${tableNo}/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 409) {
      setErrorMsg("This table is currently in progress by another employee.");
      await fetchStatuses();
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

  useEffect(() => {
    if (!token) return;

    fetchStatuses();
    const socket = socketIOClient(process.env.NEXT_PUBLIC_API_URL as string, {
      transports: ["websocket"],
    }) as unknown as TableSocket;

    const handler = () => {
      fetchStatuses();
    };
    socket.on("tables:changed", handler);

    return () => {
      socket.off("tables:changed", handler);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !selectedTable) return;

    const interval = setInterval(() => {
      lockTable(selectedTable);
    }, 45000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedTable]);

  useEffect(() => {
    return () => {
      const table = selectedTableRef.current;
      if (table) unlockTable(table);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSelectTable(tableNo: number) {
    setErrorMsg(null);

    const row = statusByTable[tableNo];
    const status = row?.status ?? "available";

    if (status === "locked" && !row?.lockedByMe) {
      setErrorMsg(
        `Table ${tableNo} is currently in progress by ${row?.lockedByName ?? "another employee"}.`
      );
      return;
    }

    if (selectedTable && selectedTable !== tableNo) {
      await unlockTable(selectedTable);
    }

    const locked = await lockTable(tableNo);
    if (!locked) return;

    setSelectedTable(tableNo);
    const latestMap = await fetchStatuses();
    const latestRow = latestMap?.[tableNo] ?? row;
    const query = `type=dine-in&table=${tableNo}&guests=${guests}`;

    if (latestRow?.orderId) {
      router.push(`/pos/orders/new?${query}&orderId=${latestRow.orderId}`);
      return;
    }

    router.push(`/pos/orders/new?${query}`);
  }

  const selectedRow = selectedTable ? statusByTable[selectedTable] : undefined;

  return (
    <>
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
            -
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
                    ? " - In progress (you)"
                    : ` - Locked by ${selectedRow.lockedByName ?? "employee"}`
                  : selectedRow?.status
                  ? ` - ${selectedRow.status.replace("_", " ")}`
                  : ""}
              </>
            ) : (
              "None"
            )}
          </div>
        </div>

        <div className="tableGrid">
          {tables.map((tableNo) => {
            const row = statusByTable[tableNo];
            const status: TableStatus = row?.status ?? "available";
            const lockedByMe = status === "locked" && row?.lockedByMe;
            const disabled = status === "locked" && !row?.lockedByMe;

            return (
              <button
                key={tableNo}
                type="button"
                className={`tableBtn status-${status} ${
                  selectedTable === tableNo ? "selected" : ""
                } ${disabled ? "disabled" : ""}`}
                disabled={disabled}
                onClick={() => onSelectTable(tableNo)}
                title={
                  status === "locked"
                    ? lockedByMe
                      ? "In progress (you)"
                      : `In progress${row?.lockedByName ? ` by ${row.lockedByName}` : ""}`
                    : status
                }
              >
                {tableNo}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
