import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrfToken } from "../lib/api";
import type { AuthStatus, Session, User } from "../types";

interface AuthCtx {
  loading: boolean;
  setupRequired: boolean;
  user: User | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  completeSetup: (payload: any) => Promise<void>;
  has: (perm: string) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    const status = await api<AuthStatus>("/api/v1/auth/status");
    setSetupRequired(!!status.setup_required);
    setUser(status.user);
    setCsrfToken(status.csrf_token);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const session = await api<Session>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setCsrfToken(session.csrf_token);
    setUser(session.user);
    setSetupRequired(false);
  };

  const logout = async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } finally {
      setCsrfToken(null);
      setUser(null);
    }
  };

  const completeSetup = async (payload: any) => {
    const session = await api<Session>("/api/v1/auth/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setCsrfToken(session.csrf_token);
    setUser(session.user);
    setSetupRequired(false);
  };

  const has = (perm: string) => {
    if (!user) return false;
    if (user.is_super_admin || user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const value = useMemo(
    () => ({ loading, setupRequired, user, refresh, login, logout, completeSetup, has }),
    [loading, setupRequired, user, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
