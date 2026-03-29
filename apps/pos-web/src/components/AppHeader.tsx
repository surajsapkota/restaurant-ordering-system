// apps/pos-web/src/components/AppHeader.tsx
"use client";

/**
 * AppHeader shows:
 * - Restaurant / page title
 * - Who is logged in
 * - Local time
 * - Manager / Admin buttons (role-based)
 * - Logout
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

type AuthUser = {
  name?: string | null;
  role?: Role | string | null;
};

export default function AppHeader({ title }: { title: string }) {
  const router = useRouter();

  const user = useAuthStore((s) => s.user) as AuthUser | null;
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const role = (user?.role ?? "") as string;

  const canSeeManager = role === "ADMIN" || role === "MANAGER";
  const canSeeAdmin = role === "ADMIN";

  // Local time (updates every second)
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = useMemo(() => {
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [now]);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const gradientBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "0",
    background: "linear-gradient(90deg, #ff8a00 0%, #ff2d7a 100%)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(255, 78, 122, 0.18)",
    whiteSpace: "nowrap",
  };

  const ghostBtn: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.85)",
    color: "#111",
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(10px)",
        borderRadius: 14,
        margin: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{title}</div>

        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
          Logged in as: <strong style={{ color: "#111" }}>{user?.name ?? "User"}</strong>{" "}
          <span style={{ color: "rgba(0,0,0,0.55)" }}>
            ({user?.role ?? "UNKNOWN"})
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Local time */}
        <div style={{ textAlign: "right", marginRight: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "rgba(0,0,0,0.55)" }}>
            LOCAL TIME
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>{timeStr}</div>
        </div>

        {/* Manager */}
        {canSeeManager && (
          <button
            style={ghostBtn}
            onClick={() => router.push("/pos/manager")}
            title="Manager tools"
          >
            Manager
          </button>
        )}

        {/* Admin */}
        {canSeeAdmin && (
          <button
            style={ghostBtn}
            onClick={() => router.push("/admin")}
            title="Admin dashboard"
          >
            Admin
          </button>
        )}

        {/* Logout */}
        <button onClick={logout} style={gradientBtn}>
          Logout
        </button>
      </div>
    </header>
  );
}
