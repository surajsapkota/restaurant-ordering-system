"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPin } from "@/lib/auth/authApi";
import { useAuthStore } from "@/lib/auth/authstore";

export default function EmployeeLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      setIsLoading(true);

      if (!pin.trim()) {
        setError("Please enter your PIN.");
        return;
      }

      const data = await loginWithPin(pin);

      // ✅ same logic
      setAuth(data.token, data.user, "PIN");
      router.push("/pos");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="loginBox">
      <form className="form" onSubmit={onSubmit}>
        <div className="formHeader">
          <h3>Quick staff sign-in</h3>
          <p>Use your 4-digit PIN to start taking orders.</p>
        </div>

        <label className="label">PIN</label>
        <input
          className="input"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="e.g. 1234"
          inputMode="numeric"
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primaryBtn" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        <div className="helper">Tip: PIN is for fast tablet login.</div>
      </form>
    </div>
  );
}
