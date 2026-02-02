"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";
import PosHeader from "@/components/pos/PosHeader";
import "./posLayout.css";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, hydrated, loadFromStorage, validateSession } =
    useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.push("/login");
    } else {
      validateSession();
    }
  }, [hydrated, token, router, validateSession]);

  if (!hydrated) return null;
  if (!token) return null;

  return (
    <div className="posShell">
      <PosHeader />
      <main className="posContent">{children}</main>
    </div>
  );
}
