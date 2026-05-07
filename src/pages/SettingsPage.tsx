import { useState, useEffect, useCallback } from "react";
import { useTelegramSettings, useForwardingSettings } from "@/hooks/useFirebaseData";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import { ref, set, update, onValue } from "@/lib/rtdbPb";
import { db, auth } from "@/lib/firebase";
import { updatePassword, signInWithEmailAndPassword } from "@/lib/authPb";
import { Settings, Bot, Hash, Bell, Loader2, Save, Eye, EyeOff, PhoneForwarded, Phone, MessageSquareShare, Lock, LogOut, KeyRound, ShieldCheck, Zap, ChevronRight, HelpCircle, X, ExternalLink, Play, Fingerprint, Grid3X3, Smartphone, QrCode, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { clearTelegramConfigCache, loadTelegramConfig } from "@/lib/telegram";
import OtpDialog from "@/components/OtpDialog";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import FeatureIntro from "@/components/FeatureIntro";
import { isBiometricAvailable, clearCredentials, clearPattern, savePattern, hasSavedPattern } from "@/lib/biometric";
import PatternLock from "@/components/PatternLock";
import { generateTotpSecret, generateQrDataUrl, verifyTotp, saveTotpSecret, disableTotp } from "@/lib/totp";

interface SettingsPageProps {
  onLogout?: () => void;
}

const SettingsPage = ({ onLogout }: SettingsPageProps) => {
  const { settings, notifications, loading } = useTelegramSettings();
  const { forwarding, loading: fwdLoading } = useForwardingSettings();
  const { security, loading: secLoading } = useSecuritySettings();
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
  const [biometricLogin, setBiometricLogin] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [patternLogin, setPatternLogin] = useState(false);
  const [showPatternSetup, setShowPatternSetup] = useState(false);
  const [patternStep, setPatternStep] = useState<"password" | "draw" | "confirm">("password");
  const [tempPattern, setTempPattern] = useState<number[]>([]);
  const [patternPassword, setPatternPassword] = useState("");
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
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpStep, setTotpStep] = useState<"password" | "qr" | "verify">("password");
  const [totpPassword, setTotpPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrUrl, setTotpQrUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpSaving, setTotpSaving] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpRemoving, setTotpRemoving] = useState(false);
  const [otpMethod, setOtpMethod] = useState<"telegram" | "totp">("telegram");

  // --- Auto-save helper for security_settings ---
  const saveSecuritySettings = useCallback(async (overrides: Record<string, any> = {}) => {
    const current = {
      otp_on_delete: otpOnDelete,
      otp_on_login: otpOnLogin,
      forward_sms_to_tg: forwardSmsToTg,
      biometric_login: biometricLogin,
      pattern_login: patternLogin,
      totp_enabled: totpEnabled,
      totp_secret: security?.totp_secret || null,
      otp_method: otpMethod,
      ...overrides,
    };
    try {
      await update(ref(db, "security_settings"), current);
    } catch {
      toast.error("Failed to save setting");
    }
  }, [otpOnDelete, otpOnLogin, forwardSmsToTg, biometricLogin, patternLogin, totpEnabled, security?.totp_secret, otpMethod]);

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

  // Auto-save toggle with guard
  const autoToggle = useCallback((currentValue: boolean, key: string, label: string, setter: (v: boolean) => void, onExtra?: () => void) => {
    if (currentValue) {
      requireOtp(`Turn off: ${label}`, () => {
        setter(false);
        saveSecuritySettings({ [key]: false });
        onExtra?.();
      });
    } else {
      setter(true);
      saveSecuritySettings({ [key]: true });
      toast.success(`${label} enabled`);
    }
  }, [requireOtp, saveSecuritySettings]);

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
      setBiometricLogin(security.biometric_login);
      setPatternLogin(security.pattern_login);
      setTotpEnabled(security.totp_enabled);
      setOtpMethod(security.otp_method);
    }
  }, [security]);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricSupported);
  }, []);

  const doSaveCreds = async () => {
    setSavingCreds(true);
    try {
      const user = auth.currentUser;
      if (!user) { toast.error("Not logged in"); setSavingCreds(false); return; }
      await updatePassword(user, newPassword);
      toast.success("Password updated!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        toast.error("Please logout and login again before changing password");
      } else {
        toast.error("Failed to update password");
      }
    }
    setSavingCreds(false);
  };

  const handleSaveCreds = async () => {
    if (!newPassword) { toast.error("Enter a new password"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    requireOtp("Change Password", doSaveCreds);
  };

  const TG_SECRET = "dfdv8";

  const testTelegramBot = async (token: string, userId: number): Promise<boolean> => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: userId, text: "✅ <b>Dark x Panel 3.0</b>\n\nTelegram bot verified successfully!", parse_mode: "HTML" }),
      });
      return res.ok;
    } catch { return false; }
  };

  // Save Telegram bot settings
  const handleSaveTg = async () => {
    const tgChanged =
      botToken.trim() !== (settings?.bot_token || "") ||
      String(Number(chatId.trim()) || 0) !== String(settings?.telegram_user_id || 0);

    if (tgChanged) {
      if (tgSecretKey.trim() !== TG_SECRET) { toast.error("Invalid secret key"); return; }
      if (!botToken.trim() || !chatId.trim()) { toast.error("Bot token and Chat ID required"); return; }
      setTesting(true);
      const ok = await testTelegramBot(botToken.trim(), Number(chatId.trim()) || 0);
      setTesting(false);
      if (!ok) { toast.error("Test failed — invalid bot token or chat ID"); return; }
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

  // Save SMS bot config
  const handleSaveSmsBot = async () => {
    if (!smsBotToken.trim() || !smsChatId.trim()) { toast.error("SMS Bot token and Chat ID required"); return; }
    setSavingSmsBot(true);
    try {
      await set(ref(db, "sms_bot_settings"), { bot_token: smsBotToken.trim(), chat_id: Number(smsChatId.trim()) || 0 });
      toast.success("SMS bot config saved");
    } catch {
      toast.error("Failed to save");
    }
    setSavingSmsBot(false);
  };

  // Save forwarding
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

  // Auto-save notifications
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

  // Auto-save forwarding toggle
  const handleToggleFwd = () => {
    if (fwdEnabled) {
      requireOtp("Turn off: SMS Forwarding", async () => {
        setFwdEnabled(false);
        try {
          await set(ref(db, "forwarding"), { enabled: false, number: fwdNumber.trim() });
          toast.success("Forwarding disabled");
        } catch { toast.error("Failed to save"); }
      });
    } else {
      setFwdEnabled(true);
      set(ref(db, "forwarding"), { enabled: true, number: fwdNumber.trim() });
      toast.success("Forwarding enabled");
    }
  };

  // Auto-save 2FA method
  const handleMethodChange = async (method: "telegram" | "totp") => {
    if (method === "totp" && !totpEnabled) {
      toast.error("Set up Google Authenticator first");
      return;
    }
    setOtpMethod(method);
    await saveSecuritySettings({ otp_method: method });
    toast.success(`2FA method: ${method === "totp" ? "Authenticator" : "Telegram OTP"}`);
  };

  // --- Reusable sub-components ---

  const ToggleSwitch = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
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

  const SectionHeader = ({ icon: Icon, title, gradient, badge }: { icon: any; title: string; gradient: string; badge?: string }) => (
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

  const ToggleRow = ({ icon: Icon, title, desc, value, onChange, iconColor = "text-primary" }: {
    icon: any; title: string; desc: string; value: boolean; onChange: () => void; iconColor?: string;
  }) => (
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

  const InputField = ({ icon: Icon, label, iconColor = "text-primary", type = "text", value, onChange, placeholder, mono = true, suffix }: {
    icon: any; label: string; iconColor?: string; type?: string; value: string; onChange: (v: string) => void; placeholder: string; mono?: boolean; suffix?: React.ReactNode;
  }) => (
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
        {suffix && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
    </div>
  );

  const SaveButton = ({ onClick, loading: isLoading, label = "Save" }: { onClick: () => void; loading: boolean; label?: string }) => (
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

  const Card = ({ children, index = 0 }: { children: React.ReactNode; index?: number }) => (
    <motion.div
      custom={index}
      variants={{ hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" as const } }) }}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm"
    >
      {children}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-6">
      {/* Header */}
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
            {/* ═══ CARD 1: Telegram Bot ═══ */}
            <Card index={0}>
              <SectionHeader icon={Bot} title="Telegram Bot" gradient="bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--blue))]" />
              <div className="space-y-4">
                <InputField
                  icon={Bot} label="Bot Token" iconColor="text-[hsl(var(--cyan))]"
                  type={showToken ? "text" : "password"} value={botToken} onChange={setBotToken}
                  placeholder="123456:ABC-DEF..."
                  suffix={
                    <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  }
                />
                <InputField
                  icon={Hash} label="Chat ID" iconColor="text-[hsl(var(--pink))]"
                  value={chatId} onChange={setChatId} placeholder="123456789"
                />
                <InputField
                  icon={KeyRound} label="Secret Key" iconColor="text-[hsl(var(--orange))]"
                  type="password" value={tgSecretKey} onChange={setTgSecretKey}
                  placeholder="Enter secret key to update"
                />
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

            {/* ═══ CARD 2: 2FA & Security ═══ */}
            <Card index={1}>
              <SectionHeader icon={ShieldCheck} title="2FA & Security" gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--pink))]" />
              <div className="space-y-3">
                {/* 2FA Method Selector */}
                <div className="rounded-2xl bg-secondary/60 border border-border/50 p-3.5 space-y-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">2FA Method</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Choose verification system</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMethodChange("telegram")}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                        otpMethod === "telegram" ? "border-primary bg-primary/10 shadow-sm" : "border-border/50 bg-muted/30 hover:border-border"
                      }`}
                    >
                      <KeyRound className={`h-5 w-5 ${otpMethod === "telegram" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-[11px] font-bold ${otpMethod === "telegram" ? "text-primary" : "text-muted-foreground"}`}>Telegram OTP</span>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">4-digit code via bot</span>
                    </button>
                    <button
                      onClick={() => handleMethodChange("totp")}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                        otpMethod === "totp" ? "border-[hsl(var(--green))] bg-[hsl(var(--green))]/10 shadow-sm" : "border-border/50 bg-muted/30 hover:border-border"
                      } ${!totpEnabled ? "opacity-50" : ""}`}
                    >
                      <Smartphone className={`h-5 w-5 ${otpMethod === "totp" ? "text-[hsl(var(--green))]" : "text-muted-foreground"}`} />
                      <span className={`text-[11px] font-bold ${otpMethod === "totp" ? "text-[hsl(var(--green))]" : "text-muted-foreground"}`}>Authenticator</span>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">{totpEnabled ? "6-digit TOTP" : "Not set up"}</span>
                    </button>
                  </div>
                </div>

                <ToggleRow
                  icon={Lock} title="2FA on Login"
                  desc={otpMethod === "totp" ? "Require authenticator code on login" : "Require Telegram OTP on login"}
                  value={otpOnLogin}
                  onChange={() => autoToggle(otpOnLogin, "otp_on_login", "2FA on Login", setOtpOnLogin)}
                  iconColor="text-[hsl(var(--orange))]"
                />

                <ToggleRow
                  icon={ShieldCheck} title="2FA on Delete"
                  desc={otpMethod === "totp" ? "Require authenticator code to delete" : "Require OTP to delete data"}
                  value={otpOnDelete}
                  onChange={() => autoToggle(otpOnDelete, "otp_on_delete", "2FA on Delete", setOtpOnDelete)}
                  iconColor="text-[hsl(var(--pink))]"
                />
              </div>
            </Card>

            {/* ═══ CARD 3: Login Methods ═══ */}
            <Card index={2}>
              <SectionHeader icon={Fingerprint} title="Login Methods" gradient="bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--green))]" badge="New" />
              <div className="space-y-3">
                <ToggleRow
                  icon={Fingerprint} title="Fingerprint Login"
                  desc={biometricSupported ? "Quick login with biometrics" : "Not supported on this device"}
                  value={biometricLogin}
                  onChange={() => {
                    if (!biometricSupported) { toast.error("Biometrics not available"); return; }
                    autoToggle(biometricLogin, "biometric_login", "Fingerprint Login", setBiometricLogin, () => clearCredentials());
                  }}
                  iconColor="text-[hsl(var(--cyan))]"
                />

                <ToggleRow
                  icon={Grid3X3} title="Pattern Lock"
                  desc="Draw a pattern to unlock your panel"
                  value={patternLogin}
                  onChange={() => {
                    if (!patternLogin) {
                      setShowPatternSetup(true);
                      setPatternStep("password");
                      setPatternPassword("");
                      setTempPattern([]);
                    } else {
                      autoToggle(patternLogin, "pattern_login", "Pattern Lock", setPatternLogin, () => clearPattern());
                    }
                  }}
                  iconColor="text-[hsl(var(--orange))]"
                />

                {/* Google Authenticator */}
                <div className="rounded-2xl bg-secondary/60 border border-border/50 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
                        <Smartphone className="h-4 w-4 text-[hsl(var(--green))]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">Google Authenticator</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                          {totpEnabled ? "TOTP configured and ready" : "Set up authenticator-based 2FA"}
                        </p>
                      </div>
                    </div>
                    {totpEnabled && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border border-[hsl(var(--green))]/25 shrink-0">Active</span>
                    )}
                  </div>
                  {!totpEnabled ? (
                    <button
                      onClick={() => { setShowTotpSetup(true); setTotpStep("password"); setTotpPassword(""); setTotpCode(""); setTotpSecret(""); setTotpQrUrl(""); }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Set Up Authenticator
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        requireOtp("Remove Authenticator", async () => {
                          setTotpRemoving(true);
                          try {
                            await disableTotp();
                            setTotpEnabled(false);
                            if (otpMethod === "totp") { setOtpMethod("telegram"); await saveSecuritySettings({ totp_enabled: false, totp_secret: null, otp_method: "telegram" }); }
                            toast.success("Authenticator removed");
                          } catch { toast.error("Failed to remove"); }
                          setTotpRemoving(false);
                        });
                      }}
                      disabled={totpRemoving}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all disabled:opacity-50"
                    >
                      {totpRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Remove Authenticator
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {/* ═══ CARD 4: Forward SMS to Telegram ═══ */}
            <Card index={3}>
              <SectionHeader icon={MessageSquareShare} title="Forward SMS to Telegram" gradient="bg-gradient-to-br from-[hsl(var(--green))] to-[hsl(var(--cyan))]" />
              <div className="space-y-3">
                <ToggleRow
                  icon={MessageSquareShare} title="Enable SMS Forwarding"
                  desc="All new SMS forwarded to a separate TG bot"
                  value={forwardSmsToTg}
                  onChange={() => autoToggle(forwardSmsToTg, "forward_sms_to_tg", "Forward SMS to TG", setForwardSmsToTg)}
                  iconColor="text-[hsl(var(--green))]"
                />
                <AnimatePresence>
                  {forwardSmsToTg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                          <Zap className="h-3 w-3" /> SMS Bot Config
                        </p>
                        <InputField
                          icon={Bot} label="SMS Bot Token" iconColor="text-[hsl(var(--green))]"
                          type={showSmsBotToken ? "text" : "password"} value={smsBotToken} onChange={setSmsBotToken}
                          placeholder="123456:ABC-DEF..."
                          suffix={
                            <button onClick={() => setShowSmsBotToken(!showSmsBotToken)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {showSmsBotToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          }
                        />
                        <InputField
                          icon={Hash} label="SMS Chat ID" iconColor="text-[hsl(var(--green))]"
                          value={smsChatId} onChange={setSmsChatId} placeholder="123456789"
                        />
                        <SaveButton onClick={handleSaveSmsBot} loading={savingSmsBot} label="Save SMS Bot" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* ═══ CARD 5: Notifications ═══ */}
            <Card index={4}>
              <SectionHeader icon={Bell} title="Notifications" gradient="bg-gradient-to-br from-[hsl(var(--orange))] to-[hsl(var(--yellow))]" />
              <ToggleRow
                icon={Bell} title="New Connections"
                desc="Get notified when a new device connects"
                value={newConn}
                onChange={handleToggleNewConn}
                iconColor="text-[hsl(var(--orange))]"
              />
            </Card>

            {/* ═══ CARD 6: SMS Forwarding (Number) ═══ */}
            <Card index={5}>
              <SectionHeader icon={PhoneForwarded} title="SMS Forwarding" gradient="bg-gradient-to-br from-[hsl(var(--cyan))] to-[hsl(var(--blue))]" />
              <div className="space-y-3">
                <ToggleRow
                  icon={PhoneForwarded} title="Enable Forwarding"
                  desc="Forward incoming SMS to another number"
                  value={fwdEnabled}
                  onChange={handleToggleFwd}
                  iconColor="text-[hsl(var(--cyan))]"
                />
                <AnimatePresence>
                  {fwdEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pt-1">
                        <InputField
                          icon={Phone} label="Forward To" iconColor="text-[hsl(var(--cyan))]"
                          type="tel" value={fwdNumber} onChange={setFwdNumber}
                          placeholder="+91 9876543210" mono={false}
                        />
                        <SaveButton onClick={handleSaveFwd} loading={savingFwd} label="Save Number" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* ═══ CARD 7: Change Password ═══ */}
            <Card index={6}>
              <SectionHeader icon={KeyRound} title="Change Password" gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--pink))]" />
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border/40 px-3.5 py-2.5">
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">@</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono truncate">{auth.currentUser?.email || "—"}</span>
                </div>
                <InputField
                  icon={Lock} label="New Password" iconColor="text-primary"
                  type={showNewPassword ? "text" : "password"} value={newPassword} onChange={setNewPassword}
                  placeholder="Min 6 characters" mono={false}
                  suffix={
                    <button onClick={() => setShowNewPassword(!showNewPassword)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  }
                />
                <AnimatePresence>
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <InputField
                        icon={Lock} label="Confirm Password" iconColor="text-primary"
                        type="password" value={confirmPassword} onChange={setConfirmPassword}
                        placeholder="Confirm new password" mono={false}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <SaveButton onClick={handleSaveCreds} loading={savingCreds} label="Update Password" />
              </div>
            </Card>

            {/* ═══ Actions ═══ */}
            <div className="space-y-3 lg:col-span-2">
              <motion.button
                custom={7}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }) }}
                initial="hidden" animate="visible"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowIntro(true)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-primary/8 border border-primary/15 text-primary text-sm font-bold hover:bg-primary/15 transition-all"
              >
                <Play className="h-4 w-4" />
                Show Feature Intro
              </motion.button>

              {onLogout && (
                <motion.button
                  custom={8}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }) }}
                  initial="hidden" animate="visible"
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

        <AnimatePresence>
          {showIntro && <FeatureIntro onClose={() => setShowIntro(false)} />}
        </AnimatePresence>

        <p className="text-center text-[10px] text-muted-foreground/40 pb-2 lg:col-span-2">Dark x Panel 3.0</p>
      </div>

      {otpAction && (
        <OtpDialog action={otpAction} onVerified={handleOtpVerified} onCancel={handleOtpCancel} />
      )}

      {/* Bot Guide Modal */}
      <AnimatePresence>
        {showBotGuide && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowBotGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
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

      {/* Pattern Setup Modal */}
      <AnimatePresence>
        {showPatternSetup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowPatternSetup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-[hsl(var(--orange))]" />
                  <h3 className="text-sm font-bold text-foreground">
                    {patternStep === "password" ? "Verify Password" : patternStep === "draw" ? "Draw Your Pattern" : "Confirm Your Pattern"}
                  </h3>
                </div>
                <button onClick={() => setShowPatternSetup(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {patternStep === "password" ? "Enter your current password to set up pattern lock." : patternStep === "draw" ? "Connect at least 4 dots to create your pattern." : "Draw the same pattern again to confirm."}
              </p>
              {patternStep === "password" && (
                <div className="space-y-3">
                  <div className="relative rounded-xl border border-border bg-secondary/50">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="password" value={patternPassword} onChange={(e) => setPatternPassword(e.target.value)} placeholder="Enter your password" className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" autoFocus onKeyDown={(e) => { if (e.key === "Enter" && patternPassword) setPatternStep("draw"); }} />
                  </div>
                  <button onClick={() => { if (!patternPassword) { toast.error("Enter your password"); return; } setPatternStep("draw"); }} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">Continue</button>
                </div>
              )}
              {(patternStep === "draw" || patternStep === "confirm") && (
                <div className="flex justify-center">
                  <PatternLock
                    size={220}
                    onComplete={async (pattern) => {
                      if (pattern.length < 4) { toast.error("Connect at least 4 dots"); return; }
                      if (patternStep === "draw") { setTempPattern(pattern); setPatternStep("confirm"); toast.success("Now draw it again to confirm"); }
                      else {
                        if (pattern.join(",") === tempPattern.join(",")) {
                          const user = auth.currentUser;
                          if (user) {
                            await savePattern(pattern, user.email || "", patternPassword);
                            setPatternLogin(true);
                            setShowPatternSetup(false);
                            setPatternPassword("");
                            await saveSecuritySettings({ pattern_login: true });
                            toast.success("Pattern lock activated!");
                          }
                        } else { toast.error("Patterns don't match."); setPatternStep("draw"); setTempPattern([]); }
                      }
                    }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                {patternStep === "confirm" && (
                  <button onClick={() => { setPatternStep("draw"); setTempPattern([]); }} className="flex-1 py-2.5 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Redraw</button>
                )}
                <button onClick={() => setShowPatternSetup(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOTP Setup Modal */}
      <AnimatePresence>
        {showTotpSetup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowTotpSetup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[hsl(var(--green))]" />
                  <h3 className="text-sm font-bold text-foreground">
                    {totpStep === "password" ? "Verify Password" : totpStep === "qr" ? "Scan QR Code" : "Verify Code"}
                  </h3>
                </div>
                <button onClick={() => setShowTotpSetup(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {totpStep === "password" ? "Enter your panel password to set up Google Authenticator." : totpStep === "qr" ? "Scan this QR code with Google Authenticator or any TOTP app." : "Enter the 6-digit code from your authenticator app."}
              </p>
              {totpStep === "password" && (
                <div className="space-y-3">
                  <div className="relative rounded-xl border border-border bg-secondary/50">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="password" value={totpPassword} onChange={(e) => setTotpPassword(e.target.value)} placeholder="Enter your password" className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && totpPassword) {
                          try { const user = auth.currentUser; if (!user?.email) return; await signInWithEmailAndPassword(auth, user.email, totpPassword); const secret = generateTotpSecret(); setTotpSecret(secret); const qr = await generateQrDataUrl(secret); setTotpQrUrl(qr); setTotpStep("qr"); } catch { toast.error("Wrong password"); }
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!totpPassword) { toast.error("Enter your password"); return; }
                      try { const user = auth.currentUser; if (!user?.email) return; await signInWithEmailAndPassword(auth, user.email, totpPassword); const secret = generateTotpSecret(); setTotpSecret(secret); const qr = await generateQrDataUrl(secret); setTotpQrUrl(qr); setTotpStep("qr"); } catch { toast.error("Wrong password"); }
                    }}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                  >Continue</button>
                </div>
              )}
              {totpStep === "qr" && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    {totpQrUrl && <div className="rounded-xl bg-white p-3"><img src={totpQrUrl} alt="TOTP QR Code" className="h-48 w-48" /></div>}
                  </div>
                  <div className="rounded-xl bg-secondary/60 border border-border/50 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Manual Key</p>
                    <p className="text-xs font-mono text-foreground break-all select-all">{totpSecret}</p>
                  </div>
                  <button onClick={() => setTotpStep("verify")} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">I've Scanned It — Next</button>
                </div>
              )}
              {totpStep === "verify" && (
                <div className="space-y-3">
                  <input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter 6-digit code" maxLength={6} autoFocus className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-foreground placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <button
                    onClick={async () => {
                      if (totpCode.length !== 6) { toast.error("Enter 6-digit code"); return; }
                      setTotpSaving(true);
                      if (verifyTotp(totpSecret, totpCode)) { await saveTotpSecret(totpSecret); setTotpEnabled(true); setShowTotpSetup(false); toast.success("Google Authenticator activated!"); }
                      else { toast.error("Invalid code."); setTotpCode(""); }
                      setTotpSaving(false);
                    }}
                    disabled={totpCode.length !== 6 || totpSaving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {totpSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Verify & Activate
                  </button>
                </div>
              )}
              <button onClick={() => setShowTotpSetup(false)} className="w-full py-2.5 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsPage;
