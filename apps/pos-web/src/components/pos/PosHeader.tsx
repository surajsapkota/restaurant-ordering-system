"use client";

import { useAuthStore } from "@/lib/auth/authstore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PosHeader() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="posHeader">
      <div>
        <div className="posTitle">Bombay to Mumbai — POS</div>
        <div className="posUser">
          Logged in as <b>{user?.role}</b>
        </div>
      </div>

      <div className="posHeaderRight">
        <div className="posTime">
          <span>LOCAL TIME</span>
          <strong>{time}</strong>
        </div>

        <button
          className="logoutBtn"
          onClick={() => {
            clearAuth();
            router.push("/login");
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
