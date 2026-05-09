import { useState, useEffect, useCallback } from "react";
import { useTelegramSettings, useForwardingSettings } from "@/hooks/useFirebaseData";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import { ref, set, onValue } from "@/lib/rtdbPb";
import { db, auth } from "@/lib/firebase";
import { updatePassword, resetTotp } from "@/lib/authPb";
import {
  Settings,
  Bot,
  Hash,
  Bell,
  Loader2,
  Save,
  Eye,
  EyeOff,
  PhoneForwarded,
  Phone,
  MessageSquareShare,
  Lock,
  LogOut,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  X,
  ExternalLink,
  Play,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { clearTelegramConfigCache, loadTelegramConfig } from "@/lib/telegram";
import OtpDialog from "@/components/OtpDialog";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import FeatureIntro from "@/components/FeatureIntro";

interface SettingsPageProps {
  onLogout?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Stable sub-components — defined OUTSIDE SettingsPage so React doesn't      */
/*  unmount and remount the inputs on every keystroke (that was the cause of  */
/*  the "settings page blinking and text reverts" bug).                        */
/* -------------------------------------------------------------------------- */

interface ToggleSwitchProps {
  value: boolean;
  onChange: () => void;
}
const ToggleSwitch = ({ value, onChange }: ToggleSwitchProps) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative h-7 w-12 rounded-full transition-all duration-300 shrink-0 ${
      value ? "bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : "bg-muted"
    }`}
  >
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`absolute top-0.5 h-6 w-6 rounded-full bg-foreground shadow-md ${value ? "left-[22px]" : "left-0.5"}`}
    />
  </button>
);

interface SectionHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  title: string;
  gradient: string;
  badge?: string;
}
const SectionHeader = ({ icon: Icon, title, gradient, badge }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`h-9 w-9 rounded-xl ${gradient} flex items-center justify-center shadow-lg`}>
      <Icon className="h-4.5 w-4.5 text-foreground" />
    </div>
    <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
    {badge && (
      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border border-[hsl(var(--green))]/25">
        {badge}
      </span>
    )}
  </div>
);

interface ToggleRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  title: string;
  desc: string;
  value: boolean;
  onChange: () => void;
  iconColor?: string;
}
const ToggleRow = ({ icon: Icon, title, desc, value, onChange, iconColor = "text-primary" }: ToggleRowProps) => (
  <div className="flex items-center justify-between rounded-2xl bg-secondary/60 border border-border/50 p-3.5 gap-3">
    <div className="flex items-start gap-3 min-w-0">
      <div className="h-8 w-8 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
    <ToggleSwitch value={value} onChange={onChange} />
  </div>
);

interface InputFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  iconColor?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
  suffix?: React.ReactNode;
}
const InputField = ({ icon: Icon, label, iconColor = "text-primary", type = "text", value, onChange, placeholder, mono = true, suffix }: InputFieldProps) => (
  <div>
    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
      <Icon className={`h-3 w-3 ${iconColor}`} /> {label}
    </label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-border/60 bg-muted/50 px-3.5 py-2.5 ${suffix ? "pr-10" : ""} text-xs ${mono ? "font-mono" : "font-sans"} text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all`}
      />
      {suffix && <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffix}</div>}
    </div>
  </div>
);

interface SaveButtonProps {
  onClick: () => void;
  loading: boolean;
  label?: string;
}
const SaveButton = ({ onClick, loading: isLoading, label = "Save" }: SaveButtonProps) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    disabled={isLoading}
    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50"
  >
    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
    {label}
  </motion.button>
);

interface CardProps {
  children: React.ReactNode;
  index?: number;
}
const Card = ({ children, index = 0 }: CardProps) => (
  <motion.div
    custom={index}
    variants={{
      hidden: { opacity: 0, y: 16 },
      visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const } }),
    }}
    initial="hidden"
    animate="visible"
    className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm"
  >
    {children}
  </motion.div>
);

/* -------------------------------------------------------------------------- */

const SettingsPage = ({ onLogout }: SettingsPageProps) => {
  const { settings, notifications, loading } = useTelegramSettings();
  const { forwarding, loading: _fwdLoading } = useForwardingSettings();
  const { security, loading: _secLoading } = useSecuritySettings();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [smsBotToken, setSmsBotToken] = useState("");
  const [smsChatId, setSmsChatId] = useState("");
  const [showSmsBotToken, setShowSmsBotToken] = useState(false);
  const [newConn, setNewConn] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [savingTg, setSavingTg] = useState(false);
  const [savingSmsBot, setSavingSmsBot] = useState(false);
  const [fwdEnabled, setFwdEnabled] = useState(false);
  const [fwdNumber, setFwdNumber] = useState("");
  const [savingFwd, setSavingFwd] = useState(false);
  const [otpOnDelete, setOtpOnDelete] = useState(false);
  const [otpOnLogin, setOtpOnLogin] = useState(false);
  const [forwardSmsToTg, setForwardSmsToTg] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [tgSecretKey, setTgSecretKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [otpAction, setOtpAction] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showBotGuide, setShowBotGuide] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [resetTotpPwd, setResetTotpPwd] = useState("");
  const [showResetTotp, setShowResetTotp] = useState(false);
  const [resettingTotp, setResettingTotp] = useState(false);

  const saveSecuritySettings = useCallback(
    async (overrides: Record<string, unknown> = {}) => {
      const current = {
        otp_on_delete: otpOnDelete,
        otp_on_login: otpOnLogin,
        forward_sms_to_tg: forwardSmsToTg,
        ...overrides,
      };
      try {
        await set(ref(db, "security_settings"), current);
      } catch {
        toast.error("Failed to save setting");
      }
    },
    [otpOnDelete, otpOnLogin, forwardSmsToTg]
  );

  const requireOtp = useCallback(async (actionLabel: string, action: () => void) => {
    const config = await loadTelegramConfig();
    if (!config || !config.bot_token || !config.telegram_user_id) {
      action();
      return;
    }
    setPendingAction(() => action);
    setOtpAction(actionLabel);
  }, []);

  const handleOtpVerified = () => {
    pendingAction?.();
    setOtpAction(null);
    setPendingAction(null);
  };

  const handleOtpCancel = () => {
    setOtpAction(null);
    setPendingAction(null);
  };

  const autoToggle = useCallback(
    (currentValue: boolean, key: string, label: string, setter: (v: boolean) => void) => {
      if (currentValue) {
        requireOtp(`Turn off: ${label}`, () => {
          setter(false);
          saveSecuritySettings({ [key]: false });
        });
      } else {
        setter(true);
        saveSecuritySettings({ [key]: true });
        toast.success(`${label} enabled`);
      }
    },
    [requireOtp, saveSecuritySettings]
  );

  useEffect(() => {
    if (settings) {
      setBotToken(settings.bot_token || "");
      setChatId(settings.telegram_user_id ? String(settings.telegram_user_id) : "");
    }
    if (notifications) {
      setNewConn(notifications.new_connections);
    }
  }, [settings, notifications]);

  useEffect(() => {
    const smsRef = ref(db, "sms_bot_settings");
    const unsub = onValue(smsRef, (snapshot) => {
      if (snapshot.exists()) {
        const tok = snapshot.child("bot_token").val();
        const cid = snapshot.child("chat_id").val();
        setSmsBotToken(tok == null ? "" : String(tok));
        setSmsChatId(cid == null ? "" : String(cid));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (forwarding) {
      setFwdEnabled(forwarding.enabled);
      setFwdNumber(forwarding.number);
    }
  }, [forwarding]);

  useEffect(() => {
    if (security) {
      setOtpOnDelete(security.otp_on_delete);
      setOtpOnLogin(security.otp_on_login);
      setForwardSmsToTg(security.forward_sms_to_tg);
    }
  }, [security]);

  const doSaveCreds = async () => {
    setSavingCreds(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error("Not logged in");
        setSavingCreds(false);
        return;
      }
      await updatePassword(user, newPassword);
      toast.success("Password updated!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      toast.error(msg);
    }
    setSavingCreds(false);
  };

  const handleSaveCreds = async () => {
    if (!newPassword) {
      toast.error("Enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    requireOtp("Change Password", doSaveCreds);
  };

  const TG_SECRET = "dfdv8";

  const testTelegramBot = async (token: string, userId: number): Promise<boolean> => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: "✅ <b>Cyber Panel</b>\n\nTelegram bot verified successfully!", parse_mode: "HTML" }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleSaveTg = async () => {
    const tgChanged =
      botToken.trim() !== (settings?.bot_token || "") ||
      String(Number(chatId.trim()) || 0) !== String(settings?.telegram_user_id || 0);

    if (tgChanged) {
      if (tgSecretKey.trim() !== TG_SECRET) {
        toast.error("Invalid secret key");
        return;
      }
      if (!botToken.trim() || !chatId.trim()) {
        toast.error("Bot token and Chat ID required");
        return;
      }
      setTesting(true);
      const ok = await testTelegramBot(botToken.trim(), Number(chatId.trim()) || 0);
      setTesting(false);
      if (!ok) {
        toast.error("Test failed — invalid bot token or chat ID");
        return;
      }
      toast.success("Test message sent!");
    }

    setSavingTg(true);
    try {
      await set(ref(db, "telegram_settings"), { bot_token: botToken.trim(), telegram_user_id: Number(chatId.trim()) || 0 });
      clearTelegramConfigCache();
      setTgSecretKey("");
      toast.success("Telegram bot saved");
    } catch {
      toast.error("Failed to save");
    }
    setSavingTg(false);
  };

  const handleSaveSmsBot = async () => {
    if (!smsBotToken.trim() || !smsChatId.trim()) {
      toast.error("SMS Bot token and Chat ID required");
      return;
    }
    setSavingSmsBot(true);
    try {
      await set(ref(db, "sms_bot_settings"), { bot_token: smsBotToken.trim(), chat_id: Number(smsChatId.trim()) || 0 });
      toast.success("SMS bot config saved");
    } catch {
      toast.error("Failed to save");
    }
    setSavingSmsBot(false);
  };

  const handleSaveFwd = async () => {
    setSavingFwd(true);
    try {
      await set(ref(db, "forwarding"), { enabled: fwdEnabled, number: fwdNumber.trim() });
      toast.success("Forwarding saved");
    } catch {
      toast.error("Failed to save");
    }
    setSavingFwd(false);
  };

  const handleToggleNewConn = async () => {
    const next = !newConn;
    setNewConn(next);
    try {
      await set(ref(db, "notifications/new_connections"), next);
      toast.success(next ? "Notifications enabled" : "Notifications disabled");
    } catch {
      toast.error("Failed to save");
    }
  };

  const handleToggleFwd = () => {
    if (fwdEnabled) {
      requireOtp("Turn off: SMS Forwarding", async () => {
        setFwdEnabled(false);
        try {
          await set(ref(db, "forwarding"), { enabled: false, number: fwdNumber.trim() });
          toast.success("Forwarding disabled");
        } catch {
          toast.error("Failed to save");
        }
      });
    } else {
      setFwdEnabled(true);
      set(ref(db, "forwarding"), { enabled: true, number: fwdNumber.trim() });
      toast.success("Forwarding enabled");
    }
  };

  const handleResetTotp = async () => {
    if (!resetTotpPwd) {
      toast.error("Enter your password");
      return;
    }
    setResettingTotp(true);
    try {
      await resetTotp(resetTotpPwd);
      toast.success("2FA reset. Re-enroll on next login.");
      setShowResetTotp(false);
      setResetTotpPwd("");
      if (onLogout) await onLogout();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    }
    setResettingTotp(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-6">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
        <div className="px-5 lg:px-8 pt-5 pb-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-foreground tracking-tight">Settings</h1>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Configure your panel</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 lg:px-8 py-6 space-y-4 max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        {loading ? (
          <div className="space-y-4 lg:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card/80 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Telegram Bot */}
            <Card index={0}>
              <SectionHeader icon={Bot} title="Telegram Bot" gradient="bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--blue))]" />
              <div className="space-y-4">
                <InputField
                  icon={Bot}
                  label="Bot Token"
                  iconColor="text-[hsl(var(--cyan))]"
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={setBotToken}
                  placeholder="123456:ABC-DEF..."
                  suffix={
                    <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  }
                />
                <InputField icon={Hash} label="Chat ID" iconColor="text-[hsl(var(--pink))]" value={chatId} onChange={setChatId} placeholder="123456789" />
                <InputField icon={KeyRound} label="Secret Key" iconColor="text-[hsl(var(--orange))]" type="password" value={tgSecretKey} onChange={setTgSecretKey} placeholder="Enter secret key to update" />
                <p className="text-[10px] text-muted-foreground/70 -mt-2 pl-1">Required only when changing bot token or chat ID</p>
                <SaveButton onClick={handleSaveTg} loading={savingTg || testing} label={testing ? "Testing..." : "Save Telegram Bot"} />
                <button
                  type="button"
                  onClick={() => setShowBotGuide(true)}
                  className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-secondary/40 hover:bg-primary/10 hover:border-primary/20 transition-all text-left group"
                >
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">How to create a Telegram Bot?</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
                </button>
              </div>
            </Card>

            {/* 2FA & Security */}
            <Card index={1}>
              <SectionHeader icon={ShieldCheck} title="2FA & Security" gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--pink))]" />
              <div className="space-y-3">
                <div className="rounded-2xl bg-secondary/60 border border-border/50 p-3.5 space-y-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
                      <Smartphone className="h-4 w-4 text-[hsl(var(--green))]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">Authenticator (Mandatory)</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        Every login requires a 6-digit code from your authenticator app. To re-enroll, reset 2FA below.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowResetTotp(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset 2FA / Re-enroll
                  </button>
                </div>

                <ToggleRow
                  icon={Lock}
                  title="Telegram OTP on Login"
                  desc="Also require a Telegram OTP after the authenticator code (extra layer)"
                  value={otpOnLogin}
                  onChange={() => autoToggle(otpOnLogin, "otp_on_login", "Telegram OTP on Login", setOtpOnLogin)}
                  iconColor="text-[hsl(var(--orange))]"
                />

                <ToggleRow
                  icon={ShieldCheck}
                  title="Telegram OTP on Delete"
                  desc="Require Telegram OTP for destructive actions (delete data, etc.)"
                  value={otpOnDelete}
                  onChange={() => autoToggle(otpOnDelete, "otp_on_delete", "Telegram OTP on Delete", setOtpOnDelete)}
                  iconColor="text-[hsl(var(--pink))]"
                />
              </div>
            </Card>

            {/* Forward SMS to Telegram */}
            <Card index={2}>
              <SectionHeader icon={MessageSquareShare} title="Forward SMS to Telegram" gradient="bg-gradient-to-br from-[hsl(var(--green))] to-[hsl(var(--cyan))]" />
              <div className="space-y-3">
                <ToggleRow
                  icon={MessageSquareShare}
                  title="Enable SMS Forwarding"
                  desc="All new SMS forwarded to a separate TG bot"
                  value={forwardSmsToTg}
                  onChange={() => autoToggle(forwardSmsToTg, "forward_sms_to_tg", "Forward SMS to TG", setForwardSmsToTg)}
                  iconColor="text-[hsl(var(--green))]"
                />
                <AnimatePresence>
                  {forwardSmsToTg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <Bot className="h-3 w-3" /> SMS Bot Config
                        </p>
                        <InputField
                          icon={Bot}
                          label="SMS Bot Token"
                          iconColor="text-[hsl(var(--green))]"
                          type={showSmsBotToken ? "text" : "password"}
                          value={smsBotToken}
                          onChange={setSmsBotToken}
                          placeholder="123456:ABC-DEF..."
                          suffix={
                            <button onClick={() => setShowSmsBotToken(!showSmsBotToken)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {showSmsBotToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          }
                        />
                        <InputField icon={Hash} label="SMS Chat ID" iconColor="text-[hsl(var(--green))]" value={smsChatId} onChange={setSmsChatId} placeholder="123456789" />
                        <SaveButton onClick={handleSaveSmsBot} loading={savingSmsBot} label="Save SMS Bot" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* Notifications */}
            <Card index={3}>
              <SectionHeader icon={Bell} title="Notifications" gradient="bg-gradient-to-br from-[hsl(var(--orange))] to-[hsl(var(--yellow))]" />
              <ToggleRow
                icon={Bell}
                title="New Connections"
                desc="Get notified when a new device connects"
                value={newConn}
                onChange={handleToggleNewConn}
                iconColor="text-[hsl(var(--orange))]"
              />
            </Card>

            {/* SMS Forwarding to number */}
            <Card index={4}>
              <SectionHeader icon={PhoneForwarded} title="SMS Forwarding" gradient="bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--blue))]" />
              <div className="space-y-3">
                <ToggleRow
                  icon={PhoneForwarded}
                  title="Enable Forwarding"
                  desc="Forward incoming SMS to another number"
                  value={fwdEnabled}
                  onChange={handleToggleFwd}
                  iconColor="text-[hsl(var(--cyan))]"
                />
                <AnimatePresence>
                  {fwdEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-1">
                        <InputField icon={Phone} label="Forward To" iconColor="text-[hsl(var(--cyan))]" type="tel" value={fwdNumber} onChange={setFwdNumber} placeholder="+91 9876543210" mono={false} />
                        <SaveButton onClick={handleSaveFwd} loading={savingFwd} label="Save Number" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* Change Password */}
            <Card index={5}>
              <SectionHeader icon={KeyRound} title="Change Password" gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--pink))]" />
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border/40 px-3.5 py-2.5">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">@</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate">{auth.currentUser?.email || "—"}</span>
                </div>
                <InputField
                  icon={Lock}
                  label="New Password"
                  iconColor="text-primary"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Min 8 characters"
                  mono={false}
                  suffix={
                    <button onClick={() => setShowNewPassword(!showNewPassword)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  }
                />
                <AnimatePresence>
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <InputField icon={Lock} label="Confirm Password" iconColor="text-primary" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" mono={false} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <SaveButton onClick={handleSaveCreds} loading={savingCreds} label="Update Password" />
              </div>
            </Card>

            {/* Actions */}
            <div className="space-y-3 lg:col-span-2">
              <motion.button
                custom={6}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }) }}
                initial="hidden"
                animate="visible"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowIntro(true)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-primary/8 border border-primary/15 text-primary text-sm font-bold hover:bg-primary/15 transition-all"
              >
                <Play className="h-4 w-4" />
                Show Feature Intro
              </motion.button>

              {onLogout && (
                <motion.button
                  custom={7}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }) }}
                  initial="hidden"
                  animate="visible"
                  whileTap={{ scale: 0.97 }}
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-destructive/8 border border-destructive/15 text-destructive text-sm font-bold hover:bg-destructive/15 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </motion.button>
              )}
            </div>
          </>
        )}

        <AnimatePresence>{showIntro && <FeatureIntro onClose={() => setShowIntro(false)} />}</AnimatePresence>

        <p className="text-center text-[10px] text-muted-foreground/40 pb-2 lg:col-span-2">Cyber Panel</p>
      </div>

      {otpAction && <OtpDialog action={otpAction} onVerified={handleOtpVerified} onCancel={handleOtpCancel} />}

      {/* Bot Guide Modal */}
      <AnimatePresence>
        {showBotGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowBotGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Create a Telegram Bot</h3>
                </div>
                <button onClick={() => setShowBotGuide(false)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {[
                { step: "1", title: "Open BotFather", desc: "Search for @BotFather on Telegram or tap the link below and start a chat." },
                { step: "2", title: "Create New Bot", desc: "Send /newbot command to BotFather." },
                { step: "3", title: "Set Bot Name", desc: "Choose a display name (e.g., \"My Panel Bot\")." },
                { step: "4", title: "Set Bot Username", desc: "Choose a unique username ending in 'bot'." },
                { step: "5", title: "Copy Bot Token", desc: "BotFather gives you an API token. Paste it above." },
                { step: "6", title: "Get Your Chat ID", desc: "Send a message to @userinfobot on Telegram." },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-primary">{s.step}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
              <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                <ExternalLink className="h-3.5 w-3.5" /> Open @BotFather
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset TOTP modal */}
      <AnimatePresence>
        {showResetTotp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowResetTotp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-bold text-foreground">Reset 2FA</h3>
                </div>
                <button onClick={() => setShowResetTotp(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You'll be logged out and asked to scan a new authenticator QR on next login.
              </p>
              <div className="relative rounded-xl border border-border bg-secondary/50">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={resetTotpPwd}
                  onChange={(e) => setResetTotpPwd(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
              <button
                onClick={handleResetTotp}
                disabled={resettingTotp}
                className="w-full py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {resettingTotp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reset & Logout
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
