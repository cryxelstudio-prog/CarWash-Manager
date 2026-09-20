let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (token) localStorage.setItem("csrf", token);
  else localStorage.removeItem("csrf");
}

export function getCsrfToken() {
  return csrfToken || localStorage.getItem("csrf");
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const res = await fetch(path.startsWith("/api") || path.startsWith("/health") ? path : `/api/v1${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = typeof data === "object" && data?.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : res.statusText;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const money = (n: number | string | null | undefined, symbol = "R") => {
  const v = Number(n || 0);
  return `${symbol} ${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

export const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
};

export const WASH_STAGES = [
  "BOOKED", "ARRIVED", "CHECK_IN", "WAITING", "PRE_WASH", "WASHING",
  "INTERIOR", "DETAILING", "QUALITY_CHECK", "READY", "COLLECTED",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  ARRIVED: "Arrived",
  CHECK_IN: "Check-in",
  WAITING: "Waiting",
  PRE_WASH: "Pre-wash",
  WASHING: "Washing",
  INTERIOR: "Interior",
  DETAILING: "Detailing",
  QUALITY_CHECK: "Quality check",
  READY: "Ready",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const formatMoney = money;
