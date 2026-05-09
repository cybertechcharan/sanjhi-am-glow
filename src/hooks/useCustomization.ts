import { useSyncExternalStore } from "react";
import { onValue, ref, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

export type ThemeMode = "amoled" | "dark_gray" | "midnight" | "charcoal" | "deep_ocean" | "light" | "warm_yellow" | "forest_green";

export interface ThemeModeConfig {
  id: ThemeMode;
  name: string;
  background: string;
  card: string;
  secondary: string;
  muted: string;
  border: string;
  popover: string;
  sidebar_bg: string;
  foreground?: string;
  card_foreground?: string;
  muted_foreground?: string;
  secondary_foreground?: string;
  popover_foreground?: string;
  sidebar_foreground?: string;
  sidebar_accent_foreground?: string;
}

export const THEME_MODES: ThemeModeConfig[] = [
  {
    id: "amoled",
    name: "AMOLED Black",
    background: "0 0% 0%",
    card: "0 0% 4%",
    secondary: "240 8% 12%",
    muted: "240 6% 12%",
    border: "240 6% 14%",
    popover: "240 6% 9%",
    sidebar_bg: "240 6% 5%",
  },
  {
    id: "dark_gray",
    name: "Dark Gray",
    background: "0 0% 7%",
    card: "0 0% 10%",
    secondary: "0 0% 14%",
    muted: "0 0% 14%",
    border: "0 0% 18%",
    popover: "0 0% 11%",
    sidebar_bg: "0 0% 8%",
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    background: "230 25% 5%",
    card: "230 25% 8%",
    secondary: "230 20% 14%",
    muted: "230 15% 14%",
    border: "230 15% 18%",
    popover: "230 20% 10%",
    sidebar_bg: "230 25% 6%",
  },
  {
    id: "charcoal",
    name: "Charcoal",
    background: "220 10% 4%",
    card: "220 10% 8%",
    secondary: "220 8% 14%",
    muted: "220 6% 13%",
    border: "220 8% 17%",
    popover: "220 10% 10%",
    sidebar_bg: "220 10% 5%",
  },
  {
    id: "deep_ocean",
    name: "Deep Ocean",
    background: "210 30% 3%",
    card: "210 28% 7%",
    secondary: "210 22% 13%",
    muted: "210 18% 12%",
    border: "210 18% 16%",
    popover: "210 25% 9%",
    sidebar_bg: "210 28% 4%",
  },
  {
    id: "light",
    name: "Clean White",
    background: "0 0% 100%",
    card: "0 0% 97%",
    secondary: "0 0% 93%",
    muted: "0 0% 93%",
    border: "0 0% 85%",
    popover: "0 0% 98%",
    sidebar_bg: "0 0% 96%",
    foreground: "0 0% 8%",
    card_foreground: "0 0% 8%",
    muted_foreground: "0 0% 40%",
    secondary_foreground: "0 0% 20%",
    popover_foreground: "0 0% 8%",
    sidebar_foreground: "0 0% 20%",
    sidebar_accent_foreground: "0 0% 8%",
  },
  {
    id: "warm_yellow",
    name: "Warm Yellow",
    background: "45 40% 96%",
    card: "45 35% 92%",
    secondary: "45 30% 87%",
    muted: "45 25% 88%",
    border: "45 20% 80%",
    popover: "45 35% 94%",
    sidebar_bg: "45 35% 93%",
    foreground: "30 20% 12%",
    card_foreground: "30 20% 12%",
    muted_foreground: "30 15% 40%",
    secondary_foreground: "30 18% 20%",
    popover_foreground: "30 20% 12%",
    sidebar_foreground: "30 18% 20%",
    sidebar_accent_foreground: "30 20% 12%",
  },
  {
    id: "forest_green",
    name: "Forest Green",
    background: "150 20% 4%",
    card: "150 18% 8%",
    secondary: "150 14% 14%",
    muted: "150 12% 13%",
    border: "150 12% 18%",
    popover: "150 16% 10%",
    sidebar_bg: "150 18% 5%",
  },
];

export interface CustomizationSettings {
  panel_name: string;
  bg_image_url: string;
  accent_hex: string;
  gradient_from?: string;
  gradient_to?: string;
  gradient_enabled?: boolean;
  theme_mode?: ThemeMode;
}

const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  panel_name: "Cyber Panel",
  bg_image_url: "",
  accent_hex: "#7c3aed",
  gradient_from: "#7c3aed",
  gradient_to: "#ec4899",
  gradient_enabled: false,
  theme_mode: "amoled",
};

const CUSTOMIZATION_PATH = "panel_customization";

let currentSettings: CustomizationSettings = { ...DEFAULT_CUSTOMIZATION };
let initialized = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function normalizeHex(hex: unknown): string {
  if (typeof hex !== "string") return DEFAULT_CUSTOMIZATION.accent_hex;
  const value = hex.startsWith("#") ? hex : `#${hex}`;
  return isValidHex(value) ? value.toLowerCase() : DEFAULT_CUSTOMIZATION.accent_hex;
}

function normalizeSettings(raw: unknown): CustomizationSettings {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const bgImageRaw = typeof value.bg_image_url === "string" ? value.bg_image_url.trim() : "";
  const accentHexRaw = normalizeHex(value.accent_hex);
  const gradientFrom = normalizeHex(value.gradient_from || value.accent_hex);
  const gradientTo = normalizeHex(value.gradient_to || "#ec4899");
  const gradientEnabled = value.gradient_enabled === true;
  const themeMode = typeof value.theme_mode === "string" && THEME_MODES.some(t => t.id === value.theme_mode)
    ? (value.theme_mode as ThemeMode)
    : "amoled";

  return {
    panel_name: DEFAULT_CUSTOMIZATION.panel_name,
    bg_image_url: bgImageRaw,
    accent_hex: accentHexRaw,
    gradient_from: gradientFrom,
    gradient_to: gradientTo,
    gradient_enabled: gradientEnabled,
    theme_mode: themeMode,
  };
}

function getAccentHslFromHex(hex: string): string {
  return hexToHSL(hex) || "262 83% 58%";
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  const customizationRef = ref(db, CUSTOMIZATION_PATH);
  onValue(customizationRef, (snapshot) => {
    currentSettings = normalizeSettings(snapshot.val());
    applyAccentColor(getAccentHslFromHex(currentSettings.accent_hex));
    applyThemeMode(currentSettings.theme_mode || "amoled");
    if (currentSettings.gradient_enabled) {
      applyGradient(currentSettings.gradient_from!, currentSettings.gradient_to!);
    } else {
      clearGradient();
    }
    emitChange();
  });
}

function getSnapshot() {
  ensureInitialized();
  return currentSettings;
}

async function persistSettings(next: CustomizationSettings) {
  const previous = currentSettings;

  currentSettings = next;
  applyAccentColor(getAccentHslFromHex(next.accent_hex));
  applyThemeMode(next.theme_mode || "amoled");
  if (next.gradient_enabled) {
    applyGradient(next.gradient_from!, next.gradient_to!);
  } else {
    clearGradient();
  }
  emitChange();

  try {
    await set(ref(db, CUSTOMIZATION_PATH), next);
  } catch (error) {
    currentSettings = previous;
    applyAccentColor(getAccentHslFromHex(previous.accent_hex));
    applyThemeMode(previous.theme_mode || "amoled");
    emitChange();
    throw error;
  }
}

export function usePanelName(): string {
  return useSyncExternalStore(subscribe, () => getSnapshot().panel_name);
}

export function useBgImageUrl(): string {
  return useSyncExternalStore(subscribe, () => getSnapshot().bg_image_url);
}

export function useAccentHex(): string {
  return useSyncExternalStore(subscribe, () => getSnapshot().accent_hex);
}

let cachedGradient = { from: "#7c3aed", to: "#ec4899", enabled: false };
let cachedGradientKey = "";

function getGradientSnapshot() {
  const s = getSnapshot();
  const key = `${s.gradient_from}|${s.gradient_to}|${s.gradient_enabled}`;
  if (key !== cachedGradientKey) {
    cachedGradientKey = key;
    cachedGradient = {
      from: s.gradient_from || "#7c3aed",
      to: s.gradient_to || "#ec4899",
      enabled: s.gradient_enabled || false,
    };
  }
  return cachedGradient;
}

export function useGradientSettings() {
  return useSyncExternalStore(subscribe, getGradientSnapshot);
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, () => getSnapshot().theme_mode || "amoled");
}

export function getPanelName(): string {
  return getSnapshot().panel_name;
}

export function getBgImageUrl(): string {
  return getSnapshot().bg_image_url;
}

export function getAccentHex(): string {
  return getSnapshot().accent_hex;
}

// Panel name is hardcoded to "Cyber Panel" and cannot be changed

export async function setBgImageUrl(url: string) {
  const bg_image_url = url.trim();
  await persistSettings({ ...currentSettings, bg_image_url });
}

export async function setAccentColor(hex: string, hsl?: string) {
  const accent_hex = normalizeHex(hex);
  await persistSettings({ ...currentSettings, accent_hex });

  if (hsl) {
    applyAccentColor(hsl);
  }
}

export async function setGradient(from: string, to: string, enabled: boolean) {
  const gradient_from = normalizeHex(from);
  const gradient_to = normalizeHex(to);
  await persistSettings({ ...currentSettings, gradient_from, gradient_to, gradient_enabled: enabled });
}

export async function setThemeMode(mode: ThemeMode) {
  await persistSettings({ ...currentSettings, theme_mode: mode });
}

export function hexToHSL(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyAccentColor(hsl: string) {
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
  document.documentElement.style.setProperty("--sidebar-primary", hsl);
  document.documentElement.style.setProperty("--sidebar-ring", hsl);
}

export function applyThemeMode(mode: ThemeMode) {
  const theme = THEME_MODES.find(t => t.id === mode) || THEME_MODES[0];
  const root = document.documentElement;
  const isLight = !!theme.foreground;

  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--foreground", theme.foreground || "0 0% 95%");
  root.style.setProperty("--card-foreground", theme.card_foreground || "0 0% 95%");
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--secondary-foreground", theme.secondary_foreground || "0 0% 85%");
  root.style.setProperty("--muted", theme.muted);
  root.style.setProperty("--muted-foreground", theme.muted_foreground || "240 5% 50%");
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--input", theme.border);
  root.style.setProperty("--popover", theme.popover);
  root.style.setProperty("--popover-foreground", theme.popover_foreground || "0 0% 95%");
  root.style.setProperty("--sidebar-background", theme.sidebar_bg);
  root.style.setProperty("--sidebar-border", theme.border);
  root.style.setProperty("--sidebar-accent", theme.secondary);
  root.style.setProperty("--sidebar-foreground", theme.sidebar_foreground || "0 0% 85%");
  root.style.setProperty("--sidebar-accent-foreground", theme.sidebar_accent_foreground || "0 0% 95%");
  root.style.setProperty("--destructive-foreground", isLight ? "0 0% 100%" : "0 0% 100%");
  root.style.setProperty("--primary-foreground", isLight ? "0 0% 100%" : "0 0% 100%");
  root.style.setProperty("--accent-foreground", isLight ? "0 0% 100%" : "0 0% 100%");
}

export function applyGradient(from: string, to: string) {
  const fromHsl = hexToHSL(from);
  const toHsl = hexToHSL(to);
  if (fromHsl && toHsl) {
    document.documentElement.style.setProperty("--gradient-from", fromHsl);
    document.documentElement.style.setProperty("--gradient-to", toHsl);
    document.documentElement.style.setProperty("--gradient-active", "1");
  }
}

export function clearGradient() {
  document.documentElement.style.removeProperty("--gradient-from");
  document.documentElement.style.removeProperty("--gradient-to");
  document.documentElement.style.setProperty("--gradient-active", "0");
}

export function initCustomization() {
  applyAccentColor(getAccentHslFromHex(currentSettings.accent_hex));
  applyThemeMode(currentSettings.theme_mode || "amoled");
  ensureInitialized();
}
