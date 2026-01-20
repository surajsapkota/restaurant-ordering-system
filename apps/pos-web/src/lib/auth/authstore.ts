"use client";

/**
 * Auth store with:
 * - token + user stored in Zustand
 * - localStorage persistence (stay logged in after refresh)
 * - hydrated flag (prevents redirect before localStorage loads)
 * - validateSession() calls backend /auth/me to confirm token is valid
 * - loginMethod (PIN vs PASSWORD) so we can secure /admin
 */

import { create } from "zustand";
import type { UserRole } from "./authApi";
import { fetchMe } from "./authApi";

// Basic user info we keep in frontend state
type AuthUser = {
  id: string;
  name: string | null;
  role: UserRole;
};

// How the user logged in
export type LoginMethod = "PIN" | "PASSWORD";

type AuthState = {
  token: string | null;
  user: AuthUser | null;

  // When true, it means we finished loading from localStorage
  hydrated: boolean;

  // NEW: remember how user logged in
  loginMethod: LoginMethod | null;

  // Save auth info (token + user + method)
  setAuth: (token: string, user: AuthUser, method: LoginMethod) => void;

  // Clear auth info
  clearAuth: () => void;

  // Load auth info from localStorage
  loadFromStorage: () => void;

  // Confirm token is still valid by calling backend /auth/me
  validateSession: () => Promise<void>;
};

const STORAGE_KEY = "pos_auth_v1";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  loginMethod: null,

  setAuth: (token, user, method) => {
    // Save to Zustand state
    set({ token, user, loginMethod: method });

    // Save to localStorage so refresh keeps you logged in
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token, user, loginMethod: method })
    );
  },

  clearAuth: () => {
    // Clear Zustand state
    set({ token: null, user: null, loginMethod: null });

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
  },

  loadFromStorage: () => {
    const raw = localStorage.getItem(STORAGE_KEY);

    // Nothing stored -> we are still "done loading"
    if (!raw) {
      set({ hydrated: true, loginMethod: null });
      return;
    }

    try {
      // Parse stored auth
      const parsed = JSON.parse(raw) as {
        token: string;
        user: AuthUser;
        loginMethod?: LoginMethod;
      };

      set({
        token: parsed.token,
        user: parsed.user,
        // If old storage doesn't have loginMethod, default to PIN
        loginMethod: parsed.loginMethod ?? "PIN",
        hydrated: true,
      });
    } catch {
      // If storage is corrupted, wipe it
      localStorage.removeItem(STORAGE_KEY);
      set({ hydrated: true, loginMethod: null });
    }
  },

  validateSession: async () => {
    // Read token from Zustand state
    const { token } = useAuthStore.getState();

    if (!token) return;

    try {
      // Ask backend: "who am I?"
      const user = await fetchMe(token);

      // Update user info with fresh data from backend
      useAuthStore.setState({ user });
    } catch {
      // Token invalid/expired -> logout
      localStorage.removeItem(STORAGE_KEY);
      useAuthStore.setState({ token: null, user: null, loginMethod: null });
    }
  },
}));
