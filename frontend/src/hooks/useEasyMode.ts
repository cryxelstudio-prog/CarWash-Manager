import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import type { Session } from "../types";

const LS_KEY = "cwm_easy_mode";
const LS_HC_KEY = "cwm_high_contrast";
const LS_LOGIN_KEY = "cwm_easy_mode_login";

function roleKey(roleName?: string | null): string {
  return (roleName || "").toLowerCase();
}

/** Frontline roles seed Easy when preference is unset. */
function staffDefaultsEasy(roleName?: string | null): boolean {
  const r = roleKey(roleName);
  return ["reception", "operator", "washer", "staff"].some((k) => r.includes(k));
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

/**
 * Resolve effective Easy Mode.
 * Accessibility-first: unset preference leans Easy for every role (including managers).
 * Explicit false always means Full Mode.
 */
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
  return true; // accessibility-first for Owner/Manager/Admin when unset
}

export function useEasyMode() {
  const { user, patchUser } = useAuth();
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
        // keep optimistic local value; localStorage already set
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

  const isManagerLike = useMemo(() => {
    if (!user) return false;
    if (user.is_super_admin || user.permissions.includes("*")) return true;
    const r = roleKey(user.role_name);
    return ["owner", "manager", "admin"].some((k) => r.includes(k));
  }, [user]);

  return {
    easyMode,
    setEasyMode,
    highContrast,
    setHighContrast,
    isManagerLike,
  };
}
