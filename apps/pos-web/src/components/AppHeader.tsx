"use client";

/**
 * AppHeader shows:
 * - Who is logged in
 * - Logout button
 *
 * We reuse this on POS + Admin pages.
 */

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";

export default function AppHeader({ title }: { title: string }) {
  const router = useRouter();

  // Get user + logout function from store
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function logout() {
    // Clear token/user from store + localStorage
    clearAuth();

    // Go back to login screen
    router.push("/login");
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ margin: 0, opacity: 0.75, fontSize: 13 }}>
          Logged in as: {user?.name ?? "User"} ({user?.role})
        </p>
      </div>

      <button
        onClick={logout}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Logout
      </button>
    </header>
  );
}
