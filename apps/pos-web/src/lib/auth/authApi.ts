/**
 * This file contains functions that talk to the backend auth routes.
 * It keeps "fetch" code out of your UI components.
 */

export type UserRole = "ADMIN" | "EMPLOYEE";

export type LoginSuccessResponse = {
  token: string;
  user: {
    id: string;
    name: string | null;
    role: UserRole;
  };
};

/**
 * Login using email + password
 * Calls: POST /auth/login
 */
export async function loginWithEmailPassword(email: string, password: string) {
  // Read backend base URL from .env.local
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    // This error helps you immediately if env is missing
    throw new Error("NEXT_PUBLIC_API_URL is not set in .env.local");
  }

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // Backend expects { email, password }
    body: JSON.stringify({ email, password }),
  });

  // If login failed (401/400), backend returns { error: "..." }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.error ?? "Login failed";
    throw new Error(message);
  }

  // If ok, parse response: { token, user: { id, name, role } }
  const data = (await res.json()) as LoginSuccessResponse;
  return data;
}

/**
 * Login using PIN (employee)
 * Calls: POST /auth/pin
 */
export async function loginWithPin(pin: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set in .env.local");
  }

  const res = await fetch(`${baseUrl}/auth/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Backend expects { pin }
    body: JSON.stringify({ pin }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.error ?? "Invalid PIN";
    throw new Error(message);
  }

  // Same response shape: { token, user: { id, name, role } }
  return (await res.json()) as {
    token: string;
    user: { id: string; name: string | null; role: "ADMIN" | "EMPLOYEE" };
  };
}

/**
 * Fetch the currently logged in user (token must be valid)
 * Calls: GET /auth/me
 */
export async function fetchMe(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set in .env.local");
  }

  const res = await fetch(`${baseUrl}/auth/me`, {
    method: "GET",
    headers: {
      // Backend requireAuth middleware expects a Bearer token
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Session expired");
  }

  const data = (await res.json()) as { user: { id: string; name: string | null; role: "ADMIN" | "EMPLOYEE" } };
  return data.user;
}
