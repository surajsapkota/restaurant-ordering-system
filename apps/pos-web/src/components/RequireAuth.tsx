"use client";

/**
 * RequireAuth = Route Guard
 *
 * What it protects:
 * - If user is not logged in -> redirect to /login
 * - If user's role is not allowed -> redirect to correct home (/pos or /admin)
 * - If page requires PASSWORD login (admin dashboard) but user logged in via PIN -> redirect to /login
 *
 * Why we need requirePassword:
 * - We want POS to be fast: PIN login allowed
 * - But admin dashboard is sensitive: requires email/password login
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore"; 
import type { UserRole } from "@/lib/auth/authApi";

export default function RequireAuth({
  allowedRoles,
  requirePassword = false,
  children,
}: {
  allowedRoles: UserRole[];          // Roles that can view this page
  requirePassword?: boolean;         // If true, must be logged in with PASSWORD
  children: React.ReactNode;         // Protected page content
}) {
  const router = useRouter();

  // Get auth info from Zustand store
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const loginMethod = useAuthStore((s) => s.loginMethod);

  useEffect(() => {
    // 1) Do nothing until we loaded localStorage
    if (!hydrated) return;

    // 2) Not logged in -> go to login
    if (!token || !user) {
      router.replace("/login");
      return;
    }

    // 3) If this page requires PASSWORD, but user logged in with PIN -> force login
    if (requirePassword && loginMethod !== "PASSWORD") {
      router.replace("/login");
      return;
    }

    // 4) Role mismatch -> send to correct "home"
    if (!allowedRoles.includes(user.role)) {
      router.replace(user.role === "EMPLOYEE" ? "/pos" : "/admin");
    }
  }, [hydrated, token, user, loginMethod, allowedRoles, requirePassword, router]);

  // While loading localStorage, show a loading screen (prevents flicker)
  if (!hydrated) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  // After hydration:
  // If not logged in -> block content (redirect will happen)
  if (!token || !user) return null;

  // If page requires PASSWORD but loginMethod is PIN -> block content
  if (requirePassword && loginMethod !== "PASSWORD") return null;

  // If role mismatch -> block content
  if (!allowedRoles.includes(user.role)) return null;

  // ✅ Authorized -> show page
  return <>{children}</>;
}
