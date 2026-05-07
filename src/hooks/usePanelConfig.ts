import { useSyncExternalStore } from "react";
import { ref, onValue, set, get } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

export interface PanelConfig {
  admin_name: string;
  expiry_date: string;
}

interface PanelConfigSnapshot {
  config: PanelConfig;
  loading: boolean;
  isConfigured: boolean;
}

const DEFAULT_CONFIG: PanelConfig = {
  admin_name: "",
  expiry_date: "",
};

const DEFAULT_SNAPSHOT: PanelConfigSnapshot = {
  config: DEFAULT_CONFIG,
  loading: true,
  isConfigured: false,
};

let currentSnapshot = DEFAULT_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  const configRef = ref(db, "panel_config");
  onValue(
    configRef,
    (snapshot) => {
      const data = snapshot.val();

      if (data && data.admin_name && data.expiry_date) {
        currentSnapshot = {
          config: {
            admin_name: data.admin_name,
            expiry_date: data.expiry_date,
          },
          loading: false,
          isConfigured: true,
        };
      } else {
        currentSnapshot = {
          config: DEFAULT_CONFIG,
          loading: false,
          isConfigured: false,
        };
      }

      emitChange();
    },
    () => {
      currentSnapshot = {
        ...currentSnapshot,
        loading: false,
      };
      emitChange();
    }
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentSnapshot;
}

export function usePanelConfig() {
  ensureInitialized();

  const { config, loading, isConfigured } = useSyncExternalStore(subscribe, getSnapshot);

  const isExpired = (() => {
    if (!config.expiry_date) return false;
    const expiry = new Date(config.expiry_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return now > expiry;
  })();

  const daysRemaining = (() => {
    if (!config.expiry_date) return null;
    const expiry = new Date(config.expiry_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  return { config, loading, isExpired, daysRemaining, isConfigured };
}

export async function savePanelConfig(adminName: string, expiryDate: string): Promise<boolean> {
  const snapshot = await get(ref(db, "panel_config"));
  const existing = snapshot.val();

  if (existing && existing.admin_name && existing.expiry_date) {
    return false;
  }

  const nextConfig = {
    admin_name: adminName.trim(),
    expiry_date: expiryDate,
  };

  await set(ref(db, "panel_config"), nextConfig);

  currentSnapshot = {
    config: nextConfig,
    loading: false,
    isConfigured: true,
  };
  emitChange();

  return true;
}

export async function updateAdminName(name: string): Promise<void> {
  await set(ref(db, "panel_config/admin_name"), name.trim());
}

export async function updateExpiryDate(newDate: string): Promise<void> {
  await set(ref(db, "panel_config/expiry_date"), newDate);
}
