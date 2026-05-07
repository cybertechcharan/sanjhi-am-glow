import { getActivePocketBaseUrl } from "@/lib/pocketbase";

export type User = {
  uid: string;
  email: string | null;
  delete: () => Promise<void>;
};

function makeUser(uid: string, email: string | null): User {
  return {
    uid,
    email,
    delete: async () => {},
  };
}

export type Auth = { currentUser: User | null };
const AUTH_KEY = "dxp_auth_user";
const LINK_USERS_KEY = "dxp_link_users";
const AUTH_EVENT = "dxp-auth-changed";

function readMainUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: string; email?: string | null };
    if (!parsed?.uid) return null;
    return makeUser(parsed.uid, parsed.email ?? null);
  } catch {
    return null;
  }
}

function writeMainUser(user: User | null) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify({ uid: user.uid, email: user.email }));
  else localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** Panel login auth (singleton PocketBase client). */
export const auth: Auth = {
  get currentUser() {
    return readMainUser();
  },
};

/** Marker for public-share link viewers — creates PocketBase users without switching panel session. */
export const publicAuth = { __linkViewerAuth: true } as unknown as Auth;

function isLinkViewerAuth(a: Auth): boolean {
  return !!(a as { __linkViewerAuth?: boolean }).__linkViewerAuth;
}

export function onAuthStateChanged(_auth: Auth, cb: (user: User | null) => void) {
  cb(readMainUser());
  const handler = () => cb(readMainUser());
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

export async function signInWithEmailAndPassword(authArg: Auth, email: string, password: string) {
  if (isLinkViewerAuth(authArg)) {
    const raw = localStorage.getItem(LINK_USERS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
    const rec = map[email];
    if (!rec || rec.password !== password) throw new Error("Auth failed");
    return { user: makeUser(rec.uid, email) };
  }
  const res = await fetch(`${getActivePocketBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; user?: { uid: string; email: string | null }; error?: string };
  if (!res.ok || !json.ok || !json.user?.uid) throw new Error(json.error || "Auth failed");
  const user = makeUser(json.user.uid, json.user.email ?? email);
  writeMainUser(user);
  return { user };
}

export async function signOut(authArg: Auth) {
  if (isLinkViewerAuth(authArg)) return;
  writeMainUser(null);
}

export async function updatePassword(user: User, newPassword: string) {
  const oldPassword = localStorage.getItem("dxp_login_pass") || "";
  const res = await fetch(`${getActivePocketBaseUrl()}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, oldPassword, newPassword }),
  });
  if (!res.ok) throw new Error("Password update failed");
  localStorage.setItem("dxp_login_pass", newPassword);
}

export async function createUserWithEmailAndPassword(authArg: Auth, email: string, password: string) {
  if (isLinkViewerAuth(authArg)) {
    const raw = localStorage.getItem(LINK_USERS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
    const uid = `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    map[email] = { uid, password };
    localStorage.setItem(LINK_USERS_KEY, JSON.stringify(map));
    return { user: makeUser(uid, email) };
  }
  throw new Error("Panel signup is disabled");
}

export async function deleteUser(user: User) {
  const raw = localStorage.getItem(LINK_USERS_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, { uid: string; password: string }>) : {};
  const next = Object.fromEntries(Object.entries(map).filter(([, v]) => v.uid !== user.uid));
  localStorage.setItem(LINK_USERS_KEY, JSON.stringify(next));
}
