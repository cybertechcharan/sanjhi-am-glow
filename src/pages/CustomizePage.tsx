import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Palette, ImageIcon, Check, Moon, Blend, Pipette, ChevronDown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useBgImageUrl,
  useAccentHex,
  useGradientSettings,
  useThemeMode,
  setBgImageUrl,
  hexToHSL,
  setAccentColor,
  setGradient,
  setThemeMode,
  THEME_MODES,
  type ThemeMode,
} from "@/hooks/useCustomization";

const ACCENT_PRESETS = [
  { name: "Purple", hex: "#7c3aed" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Orange", hex: "#f97316" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Fuchsia", hex: "#d946ef" },
  { name: "Red", hex: "#ef4444" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Gold", hex: "#eab308" },
  { name: "Coral", hex: "#fb7185" },
  { name: "Mint", hex: "#34d399" },
  { name: "Slate", hex: "#64748b" },
  { name: "Crimson", hex: "#dc2626" },
];

const GRADIENT_PRESETS = [
  { name: "Purple → Pink", from: "#7c3aed", to: "#ec4899" },
  { name: "Cyan → Blue", from: "#06b6d4", to: "#3b82f6" },
  { name: "Orange → Yellow", from: "#f97316", to: "#eab308" },
  { name: "Green → Cyan", from: "#10b981", to: "#06b6d4" },
  { name: "Rose → Orange", from: "#f43f5e", to: "#f97316" },
  { name: "Indigo → Violet", from: "#6366f1", to: "#8b5cf6" },
  { name: "Fuchsia → Pink", from: "#d946ef", to: "#fb7185" },
  { name: "Blue → Emerald", from: "#3b82f6", to: "#10b981" },
];

// Free background images from picsum.photos
const BG_IMAGE_GALLERY = [
  { id: "1", label: "Dark Abstract", url: "https://picsum.photos/id/984/1080/1920" },
  { id: "2", label: "Night Sky", url: "https://picsum.photos/id/1025/1080/1920" },
  { id: "3", label: "Mountain", url: "https://picsum.photos/id/29/1080/1920" },
  { id: "4", label: "Ocean", url: "https://picsum.photos/id/1015/1080/1920" },
  { id: "5", label: "Forest", url: "https://picsum.photos/id/15/1080/1920" },
  { id: "6", label: "City Night", url: "https://picsum.photos/id/1044/1080/1920" },
  { id: "7", label: "Sunset", url: "https://picsum.photos/id/1033/1080/1920" },
  { id: "8", label: "Galaxy", url: "https://picsum.photos/id/631/1080/1920" },
  { id: "9", label: "Clouds", url: "https://picsum.photos/id/1039/1080/1920" },
  { id: "10", label: "Desert", url: "https://picsum.photos/id/247/1080/1920" },
  { id: "11", label: "Snow", url: "https://picsum.photos/id/1036/1080/1920" },
  { id: "12", label: "Waterfall", url: "https://picsum.photos/id/1024/1080/1920" },
];

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

const CollapsibleSection = ({ icon, title, subtitle, defaultOpen = false, badge, children }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary/40 transition-colors"
      >
        <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">{title}</p>
            {badge}
          </div>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          open ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
};

const CustomizePage = () => {
  const navigate = useNavigate();
  const savedBgUrl = useBgImageUrl();
  const activeHex = useAccentHex();
  const gradient = useGradientSettings();
  const themeMode = useThemeMode();

  const [bgUrl, setBgUrl] = useState(savedBgUrl);
  const [customHex, setCustomHex] = useState("");
  const [savingBg, setSavingBg] = useState(false);
  const [gradFrom, setGradFrom] = useState(gradient.from);
  const [gradTo, setGradTo] = useState(gradient.to);
  const [pickerHex, setPickerHex] = useState(activeHex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setBgUrl(savedBgUrl); }, [savedBgUrl]);
  useEffect(() => { setGradFrom(gradient.from); setGradTo(gradient.to); }, [gradient.from, gradient.to]);

  const pickColor = async (hex: string) => {
    const hsl = hexToHSL(hex);
    if (!hsl) return toast.error("Invalid color");
    try {
      await setAccentColor(hex, hsl);
      toast.success("Accent color updated!");
    } catch {
      toast.error("Failed to save accent color");
    }
  };

  const applyCustomHex = async () => {
    const hex = customHex.startsWith("#") ? customHex : `#${customHex}`;
    if (!hexToHSL(hex)) return toast.error("Invalid hex code");
    await pickColor(hex);
    setCustomHex("");
  };

  const saveBg = async (url?: string) => {
    const trimmed = (url ?? bgUrl).trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) return toast.error("Use a valid image URL");
    try {
      setSavingBg(true);
      await setBgImageUrl(trimmed);
      setBgUrl(trimmed);
      toast.success(trimmed ? "Background image set!" : "Background reset to default");
    } catch {
      toast.error("Failed to save background image");
    } finally {
      setSavingBg(false);
    }
  };

  const handleGradientPreset = async (from: string, to: string) => {
    try {
      await setGradient(from, to, true);
      toast.success("Gradient applied!");
    } catch {
      toast.error("Failed to save gradient");
    }
  };

  const handleGradientCustom = async () => {
    if (!hexToHSL(gradFrom) || !hexToHSL(gradTo)) return toast.error("Invalid hex codes");
    try {
      await setGradient(gradFrom, gradTo, true);
      toast.success("Custom gradient applied!");
    } catch {
      toast.error("Failed to save gradient");
    }
  };

  const toggleGradient = async () => {
    try {
      await setGradient(gradient.from, gradient.to, !gradient.enabled);
      toast.success(gradient.enabled ? "Gradient disabled" : "Gradient enabled");
    } catch {
      toast.error("Failed to toggle gradient");
    }
  };

  const handleThemeChange = async (mode: ThemeMode) => {
    try {
      await setThemeMode(mode);
      toast.success("Theme updated!");
    } catch {
      toast.error("Failed to save theme");
    }
  };

  const handleNativePicker = () => {
    setPickerHex(activeHex);
    setPickerOpen(true);
    colorPickerRef.current?.click();
  };

  const handleNativePickerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickerHex(e.target.value);
  };

  const handleNativePickerSave = async () => {
    await pickColor(pickerHex);
    setPickerOpen(false);
  };

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-8">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Customize</h1>
            <p className="text-[10px] text-muted-foreground">Personalize your panel look & feel</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-3xl mx-auto lg:px-8">
        {/* Theme Mode */}
        <CollapsibleSection
          icon={<Moon className="h-4 w-4 text-primary" />}
          title="Theme Mode"
          subtitle="Pick your dark theme vibe"
          defaultOpen
          badge={
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-semibold">
              {THEME_MODES.find(t => t.id === themeMode)?.name}
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            {THEME_MODES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`relative rounded-xl p-3 border-2 transition-all text-left ${
                  themeMode === t.id
                    ? "border-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-5 w-5 rounded-md border border-border"
                    style={{ backgroundColor: `hsl(${t.background})` }}
                  />
                  <span className="text-xs font-bold text-foreground">{t.name}</span>
                </div>
                <div className="flex gap-1">
                  <div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: `hsl(${t.card})` }} />
                  <div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: `hsl(${t.secondary})` }} />
                  <div className="h-2 flex-1 rounded-sm" style={{ backgroundColor: `hsl(${t.border})` }} />
                </div>
                {themeMode === t.id && (
                  <Check className="h-3 w-3 text-primary absolute top-2 right-2" />
                )}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Accent Color */}
        <CollapsibleSection
          icon={<Palette className="h-4 w-4 text-primary" />}
          title="Accent Color"
          subtitle="Choose your highlight color"
          badge={
            <div className="h-4 w-4 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: activeHex }} />
          }
        >
          <div className="flex flex-wrap gap-2.5 mb-3">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => pickColor(c.hex)}
                className="h-9 w-9 rounded-full border-2 transition-all hover:scale-110 relative flex-shrink-0"
                style={{
                  backgroundColor: c.hex,
                  borderColor: activeHex === c.hex ? "hsl(var(--foreground))" : "transparent",
                  boxShadow: activeHex === c.hex ? `0 0 14px ${c.hex}80` : "none",
                }}
              >
                {activeHex === c.hex && <Check className="h-3.5 w-3.5 text-white absolute inset-0 m-auto drop-shadow" />}
              </button>
            ))}
            <button
              onClick={handleNativePicker}
              className="h-9 w-9 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:scale-110 hover:border-primary/60 transition-all"
              title="Pick any color"
            >
              <Pipette className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <input
              ref={colorPickerRef}
              type="color"
              value={pickerHex}
              onChange={handleNativePickerInput}
              className="sr-only"
            />
          </div>

          {pickerOpen && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-secondary border border-border">
              <div className="h-10 w-10 rounded-xl border border-border flex-shrink-0" style={{ backgroundColor: pickerHex }} />
              <span className="text-xs font-mono text-foreground flex-1">{pickerHex}</span>
              <button
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNativePickerSave}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Save
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
              placeholder="#hex color code"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCustomHex()}
              maxLength={7}
            />
            <button onClick={applyCustomHex} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
              Apply
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="h-6 w-6 rounded-lg" style={{ backgroundColor: activeHex }} />
            <span className="text-xs font-mono text-muted-foreground">{activeHex}</span>
          </div>
        </CollapsibleSection>

        {/* Gradient Accents */}
        <CollapsibleSection
          icon={<Blend className="h-4 w-4 text-primary" />}
          title="Gradient Accent"
          subtitle="Apply gradient to buttons & highlights"
          badge={
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
              gradient.enabled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
            }`}>
              {gradient.enabled ? "ON" : "OFF"}
            </span>
          }
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-muted-foreground">Enable gradient</p>
            <button
              onClick={toggleGradient}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                gradient.enabled
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {gradient.enabled ? "ON" : "OFF"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g.name}
                onClick={() => handleGradientPreset(g.from, g.to)}
                className={`rounded-xl p-2.5 border-2 transition-all ${
                  gradient.enabled && gradient.from === g.from && gradient.to === g.to
                    ? "border-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div
                  className="h-6 rounded-lg mb-1.5"
                  style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                />
                <span className="text-[10px] font-semibold text-muted-foreground">{g.name}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
              placeholder="#from"
              value={gradFrom}
              onChange={(e) => setGradFrom(e.target.value)}
              maxLength={7}
            />
            <input
              className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
              placeholder="#to"
              value={gradTo}
              onChange={(e) => setGradTo(e.target.value)}
              maxLength={7}
            />
            <button
              onClick={handleGradientCustom}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Set
            </button>
          </div>

          {gradient.enabled && (
            <div className="flex items-center gap-2 mt-3">
              <div
                className="h-6 w-16 rounded-lg"
                style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
              />
              <span className="text-[10px] font-mono text-muted-foreground">{gradient.from} → {gradient.to}</span>
            </div>
          )}
        </CollapsibleSection>

        {/* Background Image */}
        <CollapsibleSection
          icon={<ImageIcon className="h-4 w-4 text-primary" />}
          title="Background Image"
          subtitle="Set a custom background or pick from gallery"
          badge={
            savedBgUrl ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary font-semibold">Custom</span>
            ) : null
          }
        >
          {/* Image Gallery */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <p className="text-[11px] font-semibold text-foreground">Quick Pick</p>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
              {BG_IMAGE_GALLERY.map((img) => (
                <button
                  key={img.id}
                  onClick={() => saveBg(img.url)}
                  disabled={savingBg}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[9/16] group ${
                    savedBgUrl === img.url
                      ? "border-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <span className="text-[8px] font-bold text-white">{img.label}</span>
                  </div>
                  {savedBgUrl === img.url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-5 w-5 text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reset button */}
          {savedBgUrl && (
            <button
              onClick={() => saveBg("")}
              disabled={savingBg}
              className="w-full mb-3 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Remove Background
            </button>
          )}

          {/* Custom URL */}
          <p className="text-[11px] text-muted-foreground mb-2">Or paste a custom image URL</p>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
              value={bgUrl}
              onChange={(e) => setBgUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <button
              onClick={() => saveBg()}
              disabled={savingBg}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              Save
            </button>
          </div>
          {bgUrl.trim() && (
            <div className="mt-3 rounded-xl overflow-hidden border border-border h-24">
              <img
                src={bgUrl}
                alt="Background preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default CustomizePage;
