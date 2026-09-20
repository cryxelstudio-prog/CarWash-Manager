import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export type Branding = {
  "app.name"?: string | null;
  "company.name"?: string | null;
  "app.accent_colour"?: string | null;
  "app.logo_url"?: string | null;
  "app.login_background_url"?: string | null;
  "app.theme_default"?: string | null;
  "app.version"?: string | null;
  "locale.currency_symbol"?: string | null;
  [key: string]: string | null | undefined;
};

let cached: Branding | null = null;

export function applyAccent(colour?: string | null) {
  const c = (colour || "#0ea5e9").trim() || "#0ea5e9";
  document.documentElement.style.setProperty("--brand-accent", c);
  // derive a slightly darker hover
  document.documentElement.style.setProperty("--brand-accent-hover", c);
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(cached || {});
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Branding>("/api/v1/branding");
      cached = data;
      setBranding(data);
      applyAccent(data["app.accent_colour"]);
    } catch {
      /* public branding may fail before setup — ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    branding,
    loading,
    refresh,
    appName: branding["app.name"] || "Car Wash Manager",
    logoUrl: branding["app.logo_url"] || "",
    accent: branding["app.accent_colour"] || "#0ea5e9",
    version: branding["app.version"] || "0.6.0",
  };
}
