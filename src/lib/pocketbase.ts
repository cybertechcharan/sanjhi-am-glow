const SWITCHED_PB_KEY = "dxp_switched_pb_config";
/** Short-lived override for public `/view/...` pages (query `db=`). Cleared on route unmount. */
const TEMP_PUBLIC_PB_KEY = "dxp_temp_public_pb_url";

export type PocketBaseAppConfig = {
  /** API origin, e.g. https://api.example.com (no trailing slash) */
  baseUrl: string;
};

function readSwitchedConfig(): PocketBaseAppConfig | null {
  try {
    const raw = sessionStorage.getItem(SWITCHED_PB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PocketBaseAppConfig;
    if (parsed?.baseUrl && typeof parsed.baseUrl === "string") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function getDefaultPocketBaseUrl(): string {
  const url = (import.meta.env.VITE_API_BASE_URL as string | undefined) || (import.meta.env.VITE_POCKETBASE_URL as string | undefined);
  return (url && url.replace(/\/+$/, "")) || "http://127.0.0.1:5050";
}

export function setTempPublicPbUrl(url: string | null) {
  try {
    if (url) sessionStorage.setItem(TEMP_PUBLIC_PB_KEY, url.replace(/\/+$/, ""));
    else sessionStorage.removeItem(TEMP_PUBLIC_PB_KEY);
  } catch {
    /* ignore */
  }
  resetPbClient();
}

export function getActivePocketBaseUrl(): string {
  try {
    const temp = sessionStorage.getItem(TEMP_PUBLIC_PB_KEY);
    if (temp) return temp.replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return readSwitchedConfig()?.baseUrl.replace(/\/+$/, "") || getDefaultPocketBaseUrl();
}

export function getPb() {
  const base = getActivePocketBaseUrl();
  return {
    baseUrl: base,
  };
}

/** Call after switching accounts so the singleton client matches sessionStorage. */
export function resetPbClient() {
  /* no-op in backend mode */
}

export function saveSwitchedPbConfig(cfg: PocketBaseAppConfig) {
  sessionStorage.setItem(SWITCHED_PB_KEY, JSON.stringify(cfg));
  resetPbClient();
}

export function clearSwitchedPbConfig() {
  sessionStorage.removeItem(SWITCHED_PB_KEY);
  resetPbClient();
}

export const pb = new Proxy({} as Record<string, unknown>, {
  get(_, prop) {
    return Reflect.get(getPb() as Record<string, unknown>, prop);
  },
});
