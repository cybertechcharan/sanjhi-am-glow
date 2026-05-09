import { type Database } from "@/lib/rtdbPb";
import { getToken } from "@/lib/apiClient";
import { fetchMe } from "@/lib/authPb";

/**
 * Session is JWT-based now. The token (issued by /api/auth/verify-totp[-enroll])
 * is stored in localStorage and sent as Authorization: Bearer on every API call.
 * The legacy random-UUID session_token + RTDB session/* tracking has been
 * removed because the RTDB endpoint no longer accepts writes to session/*.
 *
 * These helpers are kept (with new behaviour) for backward compatibility with
 * the rest of the app that imports them.
 */

const LEGACY_SESSION_TOKEN_KEY = "session_token";

export const generateSessionToken = (): string => {
  return crypto.randomUUID();
};

export const saveSessionTokenLocally = (_token: string) => {
  // No-op. The real token is the JWT from apiClient.
};

export const getLocalSessionToken = (): string | null => {
  return getToken();
};

export const clearLocalSessionToken = () => {
  try {
    localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

export const fetchClientIP = async (): Promise<string> => {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "Unknown";
  } catch {
    return "Unknown";
  }
};

/** Backwards-compat shim. Real session creation happens server-side on TOTP verify. */
export const createSession = async (_database?: Database) => {
  return getToken();
};

export type SessionValidationResult = "valid" | "invalid" | "unavailable";

/**
 * Validate by hitting /api/auth/me with the stored JWT.
 * - 200 → valid (and refresh user info)
 * - 401 → invalid (apiFetch already cleared the session)
 * - network error → unavailable (don't kick the user offline)
 */
export const validateSession = async (): Promise<SessionValidationResult> => {
  if (!getToken()) return "unavailable";
  try {
    const me = await fetchMe();
    return me ? "valid" : "invalid";
  } catch {
    return "unavailable";
  }
};
