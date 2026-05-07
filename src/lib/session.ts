import { ref, set, push, get, type Database } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

export const generateSessionToken = (): string => {
  return crypto.randomUUID();
};

const SESSION_TOKEN_KEY = "session_token";

export const saveSessionTokenLocally = (token: string) => {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
};

export const getLocalSessionToken = (): string | null => {
  return localStorage.getItem(SESSION_TOKEN_KEY);
};

export const clearLocalSessionToken = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY);
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

export const createSession = async (database: Database = db) => {
  const token = generateSessionToken();
  const ip = await fetchClientIP();
  const hostname = window.location.hostname;
  const timestamp = new Date().toISOString();
  const userAgent = navigator.userAgent;

  try {
    // Save current active session token
    await set(ref(database, "session/current"), {
      token,
      ip,
      hostname,
      userAgent,
      loginAt: timestamp,
    });

    // Push to login history
    await push(ref(database, "login_history"), {
      ip,
      hostname,
      userAgent,
      loginAt: timestamp,
    });
    saveSessionTokenLocally(token);
    return token;
  } catch (err) {
    console.warn("Session write failed (check Firebase DB rules for session/ and login_history/):", err);
    // Still allow login, just skip session enforcement
    return null;
  }
};

export type SessionValidationResult = "valid" | "invalid" | "unavailable";

export const validateSession = async (): Promise<SessionValidationResult> => {
  const localToken = getLocalSessionToken();
  if (!localToken) return "unavailable";

  try {
    const snap = await get(ref(db, "session/current/token"));
    if (!snap.exists()) return "unavailable";

    const remoteToken = snap.val();
    return localToken === remoteToken ? "valid" : "invalid";
  } catch {
    return "unavailable";
  }
};
