"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithEmailPassword, loginWithPin } from "@/lib/auth/authApi";
import { useAuthStore } from "@/lib/auth/authstore";

type Mode = "EMPLOYEE" | "ADMIN";

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("EMPLOYEE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      setIsLoading(true);

      if (mode === "EMPLOYEE") {
        if (!pin.trim()) {
          setError("Please enter your PIN.");
          return;
        }

        const data = await loginWithPin(pin);

        // ✅ logic stays the same
        setAuth(data.token, data.user, "PIN");
        router.push("/pos");
        return;
      }

      if (!email.trim() || !password.trim()) {
        setError("Please enter email and password.");
        return;
      }

      const data = await loginWithEmailPassword(email, password);

      // ✅ logic stays the same
      setAuth(data.token, data.user, "PASSWORD");
      router.push("/admin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="loginBox">
      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          onClick={() => setMode("EMPLOYEE")}
          className={`tab ${mode === "EMPLOYEE" ? "tabActive" : ""}`}
        >
          Employee PIN
        </button>

        <button
          type="button"
          onClick={() => setMode("ADMIN")}
          className={`tab ${mode === "ADMIN" ? "tabActive" : ""}`}
        >
          Admin Login
        </button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        {/* Employee PIN UI */}
        {mode === "EMPLOYEE" && (
          <>
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
          </>
        )}

        {/* Admin email/password UI */}
        {mode === "ADMIN" && (
          <>
            <div className="formHeader">
              <h3>Admin dashboard</h3>
              <p>Manage menu, employees, and reports securely.</p>
            </div>

            <label className="label">Email</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bombaytomumbai.ca"
              autoComplete="username"
            />

            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </>
        )}

        {/* Error */}
        {error && <div className="error">{error}</div>}

        {/* Submit */}
        <button type="submit" className="primaryBtn" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        <div className="helper">
          {mode === "EMPLOYEE"
            ? "Tip: PIN is for fast tablet login."
            : "Tip: Admin uses password for higher security."}
        </div>
      </form>
    </div>
  );
}
