import { ref, get, set, push, remove } from "@/lib/rtdbPb";
import { defaultDb } from "@/lib/firebase";
import { saveSwitchedPbConfig, clearSwitchedPbConfig } from "@/lib/pocketbase";

export interface LinkedAccount {
  id: string;
  label: string;
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  fcmClientEmail: string;
  fcmPrivateKey: string;
  addedAt: string;
}

const ACTIVE_ACCOUNT_KEY = "dxp_active_account";
const SWITCHED_CREDS_KEY = "dxp_switched_creds";

// Get which account is currently active (null = default)
export function getActiveAccountId(): string | null {
  return sessionStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function setActiveAccountId(id: string | null) {
  if (id) {
    sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  } else {
    sessionStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

/** Persist PocketBase URL for switched-account reload (`databaseURL` field holds PB origin). */
function saveSwitchedConfig(account: LinkedAccount) {
  const baseUrl = (account.databaseURL || "").replace(/\/+$/, "");
  if (baseUrl) saveSwitchedPbConfig({ baseUrl });
  if (account.fcmClientEmail && account.fcmPrivateKey) {
    sessionStorage.setItem(
      "dxp_switched_fcm",
      JSON.stringify({
        project_id: account.projectId,
        client_email: account.fcmClientEmail,
        private_key: account.fcmPrivateKey,
      })
    );
  }
}

function clearSwitchedConfig() {
  clearSwitchedPbConfig();
  sessionStorage.removeItem(SWITCHED_CREDS_KEY);
  sessionStorage.removeItem("dxp_switched_fcm");
}

// Switch to account — saves config to localStorage and triggers reload
export async function switchToAccount(account: LinkedAccount, password?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get stored email & password from linked_accounts
    const accSnap = await get(ref(defaultDb, `security_settings/linked_accounts/${account.id}`));
    const accData = accSnap.val();
    const loginEmail = accData?.email;
    const storedPass = accData?.password;
    const loginPass = storedPass || password;

    if (!loginEmail || !loginPass) {
      return { success: false, error: "No credentials found for this account" };
    }

    // Save config and creds to localStorage so firebase.ts uses them on reload
    saveSwitchedConfig(account);
    sessionStorage.setItem(SWITCHED_CREDS_KEY, JSON.stringify({ email: loginEmail, password: loginPass }));
    setActiveAccountId(account.id);

    return { success: true };
  } catch (err: any) {
    clearSwitchedConfig();
    setActiveAccountId(null);
    return { success: false, error: err.message || "Failed to switch" };
  }
}

export async function switchToDefault() {
  clearSwitchedConfig();
  setActiveAccountId(null);
}

// Get stored creds for auto-login after reload
export function getSwitchedCreds(): { email: string; password: string } | null {
  try {
    const stored = sessionStorage.getItem(SWITCHED_CREDS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.email && parsed?.password) return parsed;
    }
  } catch {}
  return null;
}

// CRUD for linked accounts — stored under security_settings/linked_accounts
export async function addLinkedAccount(account: Omit<LinkedAccount, "id" | "addedAt">, email: string, password: string): Promise<string> {
  const newRef = push(ref(defaultDb, "security_settings/linked_accounts"));
  const id = newRef.key!;
  await set(newRef, {
    ...account,
    email,
    password,
    addedAt: new Date().toISOString(),
  });
  return id;
}

export async function removeLinkedAccount(id: string) {
  await remove(ref(defaultDb, `security_settings/linked_accounts/${id}`));
  if (getActiveAccountId() === id) {
    await switchToDefault();
  }
}

export async function updateLinkedAccount(id: string, account: Omit<LinkedAccount, "id" | "addedAt">, email: string, password: string) {
  const snap = await get(ref(defaultDb, `security_settings/linked_accounts/${id}`));
  const existing = snap.val();
  await set(ref(defaultDb, `security_settings/linked_accounts/${id}`), {
    ...account,
    email,
    password,
    addedAt: existing?.addedAt || new Date().toISOString(),
  });
}

export async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  const snap = await get(ref(defaultDb, "security_settings/linked_accounts"));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, val]: [string, any]) => ({
    id,
    label: val.label || val.projectId || "Unknown",
    apiKey: val.apiKey,
    authDomain: val.authDomain,
    databaseURL: val.databaseURL,
    projectId: val.projectId,
    storageBucket: val.storageBucket,
    messagingSenderId: val.messagingSenderId,
    appId: val.appId,
    measurementId: val.measurementId,
    fcmClientEmail: val.fcmClientEmail || "",
    fcmPrivateKey: val.fcmPrivateKey || "",
    addedAt: val.addedAt,
  }));
}

// Sync settings across linked accounts is disabled in backend mode.
export async function syncSettingsToAllAccounts(
  onProgress?: (current: number, total: number, label: string) => void
): Promise<{ synced: number; failed: string[] }> {
  const accounts = await getLinkedAccounts();
  accounts.forEach((acc, idx) => onProgress?.(idx + 1, accounts.length, acc.label));
  return { synced: 0, failed: accounts.map((a) => a.label) };
}

// Validate access key or payment
export const FREE_ACCESS_KEY = "DXSD";
export const ACCOUNT_PRICE_USD = 12;

export function validateAccessKey(key: string): boolean {
  return key.trim().toUpperCase() === FREE_ACCESS_KEY;
}
