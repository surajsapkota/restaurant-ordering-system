"use client";

import RequireAuth from "@/components/RequireAuth";
import { useAuthStore } from "@/lib/auth/authstore";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function AdminPage() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const user = useAuthStore((s) => s.user);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <RequireAuth allowedRoles={["ADMIN"]} requirePassword>
      <div>
        <AppHeader title="Admin Dashboard" />

        <main style={{ padding: 24 }}>
          <p>Next: Phase 3 (menu, employees, reports)</p>
        </main>
      </div>
    </RequireAuth>
  );
}
