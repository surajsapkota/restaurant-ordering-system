"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authstore";

async function readLoginError(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return data?.error ?? "Login failed. Please try again.";
  }

  return "Could not reach the POS server. Check that the API is running.";
}

export default function EmployeeLoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!employeeCode.trim() || !pin.trim()) {
      setError("Please enter your employee code and PIN.");
      return;
    }

    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!baseUrl) {
        throw new Error("API URL is not set. Check the POS setup.");
      }

      const res = await fetch(`${baseUrl}/auth/employee-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: employeeCode.trim(), pin: pin.trim() }),
      });

      if (!res.ok) {
        throw new Error(await readLoginError(res));
      }

      const data = await res.json();

      setAuth(data.token, data.user, "PIN");
      router.push("/pos/shift");

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="loginBox">
      <form className="form" onSubmit={onSubmit}>
        <div className="formHeader">
          <h3>Quick staff sign-in</h3>
          <p>Enter your employee code and PIN.</p>
        </div>

        <label className="label">Employee Code</label>
        <input
          className="input"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          placeholder="e.g. 2001"
          inputMode="numeric"
        />

        <label className="label">PIN</label>
        <input
          className="input"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          inputMode="numeric"
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primaryBtn" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        <div className="helper">Tip: Ask your manager for your employee code.</div>
      </form>
    </div>
  );
}
