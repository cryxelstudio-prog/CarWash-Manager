import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrfToken } from "../lib/api";

export type PortalUser = {
  id: number;
  email?: string | null;
  full_name: string;
  phone?: string | null;
  customer_id?: number | null;
  customer?: any;
};

type PortalMe = {
  user: PortalUser;
  csrf_token: string;
  vehicles: any[];
  bookings: any[];
};

interface PortalCtx {
  loading: boolean;
  user: PortalUser | null;
  vehicles: any[];
  bookings: any[];
  refresh: () => Promise<void>;
  register: (payload: { name: string; phone: string; email: string; password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<PortalCtx | null>(null);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<PortalMe>("/api/v1/portal/me");
      setUser(me.user);
      setVehicles(me.vehicles || []);
      setBookings(me.bookings || []);
      setCsrfToken(me.csrf_token);
    } catch {
      setUser(null);
      setVehicles([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = async (payload: { name: string; phone: string; email: string; password: string }) => {
    const res = await api<{ user: PortalUser; csrf_token: string }>("/api/v1/portal/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setCsrfToken(res.csrf_token);
    setUser(res.user);
    await refresh();
  };

  const login = async (email: string, password: string) => {
    const res = await api<{ user: PortalUser; csrf_token: string }>("/api/v1/portal/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setCsrfToken(res.csrf_token);
    setUser(res.user);
    await refresh();
  };

  const logout = async () => {
    try {
      await api("/api/v1/portal/logout", { method: "POST" });
    } finally {
      setUser(null);
      setVehicles([]);
      setBookings([]);
    }
  };

  const value = useMemo(
    () => ({ loading, user, vehicles, bookings, refresh, register, login, logout }),
    [loading, user, vehicles, bookings, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortal outside provider");
  return ctx;
}
