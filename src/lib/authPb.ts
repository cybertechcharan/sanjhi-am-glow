import {
  apiFetch,
  clearSession,
  getStoredUser,
  onAuthEvent,
  setStoredUser,
  setToken,
  type AuthUser,
} from "@/lib/apiClient";

/** ---- Public types kept compatible with the old Firebase shape ---- */
export type User = {
  uid: string;
  email: string | null;
  delete: () => Promise<void>;
};

export type Auth = { currentUser: User | null };

const LINK_USERS_KEY = "cyp_link_users";

function fromAuthUser(u: AuthUser | null): User | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    delete: async () => {},
  };
}

export const auth: Auth = {
  get currentUser() {
    return fromAuthUser(getStoredUser());
  },
};

/** Marker for public-share link viewers — completely client-side. */
export const publicAuth = { __linkViewerAuth: true } as unknown as Auth;

function isLinkViewerAuth(a: Auth): boolean {
  return !!(a as { __linkViewerAuth?: boolean }).__linkViewerAuth;
}

export function onAuthStateChanged(_auth: Auth, cb: (user: User | null) => void) {
  cb(fromAuthUser(getStoredUser()));
  return onAuthEvent(() => cb(fromAuthUser(getStoredUser())));
}

/** ---- Two-step login flow ---- */

export type LoginStartResult =
  | {
      step: "enroll";
      challenge: string;
      totp: { secret: string; otpauth: string; qr: string; issuer: string; label: string };
    }
  | { step: "verify"; challenge: string };

export async function loginStart(email: string, password: string): Promise<LoginStartResult> {
  const json = await apiFetch<
    { ok: true; step: "enroll"; challenge: string; totp: { secret: string; otpauth: string; qr: string; issuer: string; label: string } }
    | { ok: true; step: "verify"; challenge: string }
  >("/api/auth/login", {
    method: "POST",
    body: { email, password },
    token: null,
    noAutoLogout: true,
  });
  if (json.step === "enroll") {
    return { step: "enroll", challenge: json.challenge, totp: json.totp };
  }
  return { step: "verify", challenge: json.challenge };
}

async function finalizeLogin(path: "/api/auth/verify-totp" | "/api/auth/verify-totp-enroll", challenge: string, code: string) {
  const json = await apiFetch<{ ok: true; token: string; user: AuthUser }>(path, {
    method: "POST",
    body: { code },
    token: challenge,
    noAutoLogout: true,
  });
  setToken(json.token);
  setStoredUser(json.user);
  return json.user;
}

export function loginVerifyTotp(challenge: string, code: string) {
  return finalizeLogin("/api/auth/verify-totp", challenge, code);
}

export function loginVerifyTotpEnroll(challenge: string, code: string) {
  return finalizeLogin("/api/auth/verify-totp-enroll", challenge, code);
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const json = await apiFetch<{ ok: true; user: AuthUser }>("/api/auth/me");
    setStoredUser(json.user);
    return json.user;
  } catch {
    return null;
  }
}

/** Legacy compatibility for callers that still expect a one-shot signIn. */
export async function signInWithEmailAndPassword(authArg: Auth, email: string, password: string) {
  if (isLinkViewerAuth(authArg)) {
    const raw = localStorage.getItem(LINK_USERS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
    const rec = map[email];
    if (!rec || rec.password !== password) throw new Error("Auth failed");
    return { user: { uid: rec.uid, email, delete: async () => {} } as User };
  }
  // Real flow requires TOTP; this helper is only retained to avoid breaking old call sites
  // (e.g. password-reverify modals). Throw to make sure unmigrated paths surface.
  throw new Error("TOTP_REQUIRED");
}

export async function signOut(authArg: Auth) {
  if (isLinkViewerAuth(authArg)) return;
  clearSession();
}

export async function updatePassword(_user: User, newPassword: string) {
  const oldPassword = localStorage.getItem("cyp_login_pass") || "";
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: { oldPassword, newPassword },
  });
  localStorage.setItem("cyp_login_pass", newPassword);
}

export async function resetTotp(password: string) {
  await apiFetch("/api/auth/reset-totp", { method: "POST", body: { password } });
}

export async function createUserWithEmailAndPassword(authArg: Auth, email: string, password: string) {
  if (isLinkViewerAuth(authArg)) {
    const raw = localStorage.getItem(LINK_USERS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
    const uid = `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    map[email] = { uid, password };
    localStorage.setItem(LINK_USERS_KEY, JSON.stringify(map));
    return { user: { uid, email, delete: async () => {} } as User };
  }
  throw new Error("Panel signup is disabled");
}

export async function deleteUser(user: User) {
  const raw = localStorage.getItem(LINK_USERS_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
  const next = Object.fromEntries(Object.entries(map).filter(([, v]) => v.uid !== user.uid));
  localStorage.setItem(LINK_USERS_KEY, JSON.stringify(next));
}
