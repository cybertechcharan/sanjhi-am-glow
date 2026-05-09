import { getActivePocketBaseUrl } from "@/lib/pocketbase";

/**
 * Tiny fetch wrapper that:
 *  - Prefixes the active backend base URL.
 *  - Injects the panel JWT (Bearer) when present.
 *  - Auto-handles 401 by clearing the session.
 *
 * All RTDB / device / auth-protected calls go through here.
 */

const TOKEN_KEY = "cyp_jwt";
const AUTH_KEY = "cyp_auth_user";
const AUTH_EVENT = "cyp-auth-changed";

export type AuthUser = {
  uid: string;
  email: string;
  role: "admin" | "superadmin";
  tenantId: string;
  totp_enrolled?: boolean;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.uid || !parsed?.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthEvent(cb: () => void): () => void {
  window.addEventListener(AUTH_EVENT, cb);
  return () => window.removeEventListener(AUTH_EVENT, cb);
}

export function clearSession() {
  setToken(null);
  setStoredUser(null);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Init = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Use this token instead of the stored one (for the TOTP-challenge flow). */
  token?: string | null;
  /** Skip auto-clear on 401 (used by login itself). */
  noAutoLogout?: boolean;
};

export async function apiFetch<T = unknown>(path: string, init: Init = {}): Promise<T> {
  const base = getActivePocketBaseUrl();
  const headers = new Headers(init.headers || {});
  const useToken = init.token === undefined ? getToken() : init.token;
  if (useToken) headers.set("Authorization", `Bearer ${useToken}`);

  let body: BodyInit | undefined;
  if (init.body !== undefined && init.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData || init.body instanceof Blob) {
      body = init.body as BodyInit;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.body);
    }
  }

  const res = await fetch(`${base}${path}`, { ...init, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    if (res.status === 401 && !init.noAutoLogout) {
      clearSession();
    }
    const errMsg =
      (json && typeof json === "object" && "error" in (json as Record<string, unknown>) && typeof (json as Record<string, unknown>).error === "string"
        ? ((json as Record<string, unknown>).error as string)
        : `HTTP ${res.status}`) || `HTTP ${res.status}`;
    throw new ApiError(res.status, errMsg, json);
  }
  return json as T;
}
