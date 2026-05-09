import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Smartphone, MessageSquare, Send, Lock, Bell, FileText,
  ScanSearch, Trash2, ArrowRightLeft, Globe, Palette, Shield, History,
  Download, Fingerprint, ImageIcon, Pin, Phone, Zap, Crown, RefreshCw,
  Users, KeyRound, BarChart3, Eye, Grid3X3
} from "lucide-react";

interface Feature {
  icon: React.ElementType;
  title: string;
  color: string;
  points: string[];
}

const FEATURES: Feature[] = [
  {
    icon: Smartphone,
    title: "Device Management",
    color: "text-cyan",
    points: [
      "View all connected devices with live Online/Offline status indicators",
      "See device details: model, battery level, SIM info, Android version",
      "Pin important devices to the top for quick access",
      "Add custom notes to any device for tracking purposes",
      "Tag devices with custom labels (kiskahai) to track ownership",
      "Delete devices with full cascading removal of all associated data",
      "Tab Mode on desktop for side-by-side device management",
      "Full-screen overlay on mobile for focused device control",
    ],
  },
  {
    icon: MessageSquare,
    title: "SMS Intelligence",
    color: "text-green",
    points: [
      "Read all incoming SMS from connected devices in real-time",
      "Auto-classify messages as Credit, Debit, OTP, or General",
      "Smart bank & fintech detection (supports FamPay, FAMX & more)",
      "Spam & promo filtering — only meaningful messages shown",
      "Cursor-based pagination with infinite scroll for massive SMS lists",
      "Sticky search header with sorting toggle across all views",
      "Real-time merge — new messages appear without resetting your scroll",
    ],
  },
  {
    icon: Eye,
    title: "Message Highlighting & Balances",
    color: "text-yellow",
    points: [
      "Click any SMS in global list → jumps to that exact message in device view",
      "3-second pulse animation highlights the targeted SMS",
      "Approx Balances extracted from bank SMS using smart regex parsing",
      "Click any balance pill → scrolls to the source SMS it was derived from",
      "Full traceability from balance → source message → device",
    ],
  },
  {
    icon: Send,
    title: "Send SMS & Make Calls",
    color: "text-blue-400",
    points: [
      "Send SMS remotely from any connected device",
      "Choose which SIM to send from — SIM 1 or SIM 2",
      "Chat Mode groups messages by sender into conversation threads",
      "Reply directly from chat threads with integrated reply interface",
      "Fullscreen chat view on mobile, tab-contained on desktop",
      "Initiate calls remotely from connected devices",
    ],
  },
  {
    icon: ArrowRightLeft,
    title: "SMS & Call Forwarding",
    color: "text-accent",
    points: [
      "Forward all incoming SMS to a phone number automatically",
      "OCR scanner to quickly capture forwarding numbers from screen",
      "Forward SMS to a separate Telegram bot for instant delivery",
      "Configure forwarding from Home page or Settings — stays synced",
      "Call forwarding support for redirecting incoming calls",
    ],
  },
  {
    icon: Bell,
    title: "Notifications",
    color: "text-orange",
    points: [
      "Real-time notification listener on all connected devices",
      "App branding with custom icons — WhatsApp, Telegram, Gmail, YouTube & more",
      "Color-coded badges for each recognized app via fuzzy matching",
      "Search & filter notifications by sender, body, or app name",
      "Individual or bulk 'Clear All' deletion",
      "Smart timestamps: HH:mm for today, MM-dd HH:mm for older",
      "100-entry limit with auto-trim for performance",
    ],
  },
  {
    icon: FileText,
    title: "Form Capture & Pinning",
    color: "text-yellow",
    points: [
      "Capture submitted forms from all devices in real-time",
      "View all forms in a centralized overlay across devices",
      "Pin important forms for quick reference",
      "Form count displayed on home dashboard",
    ],
  },
  {
    icon: ImageIcon,
    title: "Device Gallery",
    color: "text-pink",
    points: [
      "Browse photos from connected devices in a responsive grid",
      "3-column grid on mobile, 5-column on desktop",
      "Pin important images with All/Pinned filtering",
      "Fullscreen viewer with swipe navigation",
      "Cursor-based pagination — loads 40 images per batch with infinite scroll",
      "Individual image deletion support",
      "High-res viewing with animated loading spinners",
    ],
  },
  {
    icon: Zap,
    title: "Ping & Real-time Sync",
    color: "text-primary",
    points: [
      "Ping any device via FCM to check if the app is still active",
      "All data streams in real-time — SMS, notifications, forms, status",
      "Live Online/Offline indicators with green pulse animations",
      "New device connections trigger instant Telegram alerts",
      "No manual refresh needed — everything auto-updates",
    ],
  },
  {
    icon: ScanSearch,
    title: "Magic Scan",
    color: "text-primary",
    points: [
      "Scan all devices at once to find every credit transaction",
      "Device-centric summary with drill-down capabilities",
      "Search by sender, message, or amount across results",
      "Custom credit-range filters for targeted searches",
      "Multi-field sorting: Amount, Date, Device",
      "Pagination for large datasets with local caching",
    ],
  },
  {
    icon: Trash2,
    title: "Magic Clear",
    color: "text-destructive",
    points: [
      "Auto-detect devices with uninstalled apps via FCM ping",
      "Cascading deletion of all associated Firebase data for dead devices",
      "4-hour cooldown between scans to prevent abuse",
      "Cooldown timer synced via database",
    ],
  },
  {
    icon: Palette,
    title: "Full Customization",
    color: "text-pink",
    points: [
      "Theme Mode — switch between light and dark",
      "Accent Color picker to personalize the entire UI",
      "Custom backgrounds: Default, Image URL, Solid Color, or Gradient",
      "Two-point linear gradients with adjustable angles",
      "Image gallery for quick background selection",
      "Consistent rendering across all pages via AppBackground component",
    ],
  },
  {
    icon: Shield,
    title: "Security & Locks",
    color: "text-destructive",
    points: [
      "Pattern Lock — draw a pattern to secure panel access",
      "Biometric (Fingerprint) authentication via WebAuthn API",
      "AES-GCM 256-bit encryption for stored credentials",
      "Google Authenticator (TOTP) support as 2FA method",
      "OTP verification on login with configurable methods",
      "Mutually exclusive toggle: Telegram OTP vs Authenticator App",
      "Change password from settings at any time",
    ],
  },
  {
    icon: History,
    title: "Login History",
    color: "text-muted-foreground",
    points: [
      "Track every login attempt with timestamps",
      "View login device info and IP details",
      "Monitor for unauthorized access attempts",
    ],
  },
  {
    icon: Globe,
    title: "Public Device Links",
    color: "text-green",
    points: [
      "Generate shareable links for individual devices",
      "Restricted view — link users can only see assigned device",
      "Manage and revoke links from dedicated page",
      "Temporary accounts created for link-based access",
    ],
  },
  {
    icon: Crown,
    title: "Access & Plans",
    color: "text-yellow",
    points: [
      "Two plans: 1 Month ($250) and Lifetime ($999)",
      "Pay via USDT (BEP20) or contact on Telegram (@CyberMatrix_Admin)",
      "Auto-verification via BSCScan with unique transaction amounts",
      "Coupon codes for discounts (SAXJKL = 30% off) and free access (BEP20AD = 30 days)",
      "Auto-prompt when 7 or fewer days remain",
      "Reseller license available at $99 — earn 50% per sale",
    ],
  },
  {
    icon: Download,
    title: "Export Data",
    color: "text-cyan",
    points: [
      "Export SMS, forms, and device data for offline analysis",
      "Download records in structured format",
    ],
  },
  {
    icon: Fingerprint,
    title: "Biometric Auth",
    color: "text-primary",
    points: [
      "Fingerprint login as primary authentication method",
      "Uses WebAuthn API with AES-GCM 256-bit encryption",
      "Requires initial email/password login to set up",
      "Status-aware button with real-time verification feedback",
      "Pulsing animations during authentication flow",
    ],
  },
];

const HelpPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 lg:pb-8 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-sm font-black text-foreground tracking-tight">All Features</h1>
            <p className="text-[9px] text-muted-foreground font-semibold">{FEATURES.length} capabilities explained</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 max-w-3xl mx-auto space-y-3">
        {FEATURES.map((f, idx) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.3 }}
            className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            {/* Feature Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-secondary/20">
              <div className="h-9 w-9 rounded-xl bg-background/60 border border-border/30 flex items-center justify-center flex-shrink-0">
                <f.icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <h2 className="text-[13px] font-black text-foreground tracking-tight">{f.title}</h2>
            </div>

            {/* Feature Points */}
            <div className="px-4 py-3 space-y-2">
              {f.points.map((point, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-6"
        >
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-[0.3em]">
            Cyber Panel · By CyberMatrix
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default HelpPage;
