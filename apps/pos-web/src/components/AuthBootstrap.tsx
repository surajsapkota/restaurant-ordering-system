"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth/authstore";

export default function AuthBootstrap() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    // 1) load token/user from localStorage
    loadFromStorage();

    // 2) validate with backend (if token exists)
    useAuthStore.getState().validateSession();
  }, [loadFromStorage]);

  return null;
}
