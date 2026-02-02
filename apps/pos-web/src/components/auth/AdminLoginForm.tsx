"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithEmailPassword } from "@/lib/auth/authApi";
import { useAuthStore } from "@/lib/auth/authstore";

export default function AdminLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      setIsLoading(true);

      if (!email.trim() || !password.trim()) {
        setError("Please enter email and password.");
        return;
      }

      const data = await loginWithEmailPassword(email, password);

      // ✅ same logic
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
      <form className="form" onSubmit={onSubmit}>
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

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primaryBtn" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in as Admin"}
        </button>

        <div className="helper">Tip: Admin uses password for higher security.</div>
      </form>
    </div>
  );
}
