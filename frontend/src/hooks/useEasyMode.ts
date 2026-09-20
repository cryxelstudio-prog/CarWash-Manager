import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import type { Session } from "../types";

const LS_KEY = "cwm_easy_mode";
const LS_HC_KEY = "cwm_high_contrast";
const LS_LOGIN_KEY = "cwm_easy_mode_login";

function roleKey(roleName?: string | null): string {
  return (roleName || "").toLowerCase().replace(/\s+/g, "_");
}

/** Frontline roles seed Easy when preference is unset. */
function staffDefaultsEasy(roleName?: string | null): boolean {
  const r = roleKey(roleName);
  return ["reception", "operator", "washer", "staff", "detailer", "cashier"].some((k) => r.includes(k));
}

export function readLoginEasyPref(defaultChecked = true): boolean {
  try {
    const v = localStorage.getItem(LS_LOGIN_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return defaultChecked;
}

export function writeLoginEasyPref(value: boolean) {
  try {
    localStorage.setItem(LS_LOGIN_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function resolveEasy(
  stored: boolean | null | undefined,
  roleName: string | null | undefined,
  mobileLean: boolean
): boolean {
  if (stored === true) return true;
  if (stored === false) return false;
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls === "1") return true;
    if (ls === "0") return false;
  } catch {
    /* ignore */
  }
  if (mobileLean) return true;
  if (staffDefaultsEasy(roleName)) return true;
  return true;
}

export function useEasyMode() {
  const { user, patchUser, has } = useAuth();
  const mobileLean =
    typeof window !== "undefined" &&
    (window.location.pathname === "/m" || window.location.pathname.startsWith("/m/"));

  const [highContrast, setHighContrastState] = useState(() => {
    try {
      return localStorage.getItem(LS_HC_KEY) === "1";
    } catch {
      return false;
    }
  });

  const easyMode = useMemo(
    () => resolveEasy(user?.easy_mode, user?.role_name, mobileLean),
    [user?.easy_mode, user?.role_name, mobileLean]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("easy-mode", easyMode);
    root.classList.toggle("high-contrast", highContrast && easyMode);
    try {
      localStorage.setItem(LS_KEY, easyMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [easyMode, highContrast]);

  const setEasyMode = useCallback(
    async (value: boolean) => {
      try {
        localStorage.setItem(LS_KEY, value ? "1" : "0");
        writeLoginEasyPref(value);
      } catch {
        /* ignore */
      }
      document.documentElement.classList.toggle("easy-mode", value);
      if (!user) return;
      patchUser({ easy_mode: value });
      try {
        const session = await api<Session>("/api/v1/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ easy_mode: value }),
        });
        patchUser({ easy_mode: session.user.easy_mode });
      } catch {
        // keep optimistic local value
      }
    },
    [user, patchUser]
  );

  const setHighContrast = useCallback((value: boolean) => {
    setHighContrastState(value);
    try {
      localStorage.setItem(LS_HC_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const r = roleKey(user?.role_name);
  const isSuper = !!(user?.is_super_admin || user?.permissions?.includes("*"));

  const isManagerLike = useMemo(() => {
    if (!user) return false;
    if (isSuper) return true;
    if (has("settings.manage") || has("users.manage") || has("admin.manage")) return true;
    return ["owner", "manager", "admin", "senior_tech", "supervisor"].some((k) => r.includes(k));
  }, [user, isSuper, has, r]);

  /** Settings / Launch / Integrations / Branding / Diagnostics */
  const canAccessSettings = useMemo(() => {
    if (!user) return false;
    if (isSuper) return true;
    return has("settings.manage") || has("admin.manage");
  }, [user, isSuper, has]);

  /** User management panel */
  const canManageUsers = useMemo(() => {
    if (!user) return false;
    if (isSuper) return true;
    return has("users.manage") || has("admin.manage");
  }, [user, isSuper, has]);

  const canViewReports = useMemo(() => {
    if (!user) return false;
    if (isSuper) return true;
    return has("reports.view") || has("reports.export");
  }, [user, isSuper, has]);

  /** Frontline wash staff — ops-only nav */
  const isFrontlineStaff = useMemo(() => {
    if (!user) return false;
    if (isSuper || canAccessSettings || canManageUsers) return false;
    return ["reception", "operator", "detailer", "cashier", "washer", "staff"].some((k) => r.includes(k));
  }, [user, isSuper, canAccessSettings, canManageUsers, r]);

  return {
    easyMode,
    setEasyMode,
    highContrast,
    setHighContrast,
    isManagerLike,
    canAccessSettings,
    canManageUsers,
    canViewReports,
    isFrontlineStaff,
  };
}
