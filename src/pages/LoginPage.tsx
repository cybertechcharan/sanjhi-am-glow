import { useState, useEffect } from "react";
import { Shield, Loader2, LogIn, Mail, Lock, Fingerprint, KeyRound, ArrowLeft, Grid3X3, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { signInWithEmailAndPassword } from "@/lib/authPb";
import { defaultDb, defaultAuth } from "@/lib/firebase";

// Login always uses default project auth & db
const loginDb = defaultDb;
const loginAuth = defaultAuth;
import { ref, get } from "@/lib/rtdbPb";
import { createSession } from "@/lib/session";
import { verifyOtp, sendOtpToTelegram } from "@/lib/telegram";
import { motion, AnimatePresence } from "framer-motion";
import { isBiometricAvailable, hasSavedCredentials, getCredentials, saveCredentials, verifyBiometric, hasSavedPattern, verifyPattern, savePattern } from "@/lib/biometric";
import PatternLock from "@/components/PatternLock";
import { verifyTotp } from "@/lib/totp";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const [step, setStep] = useState<"login" | "otp" | "pattern" | "totp">("login");
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioHasCreds, setBioHasCreds] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [patternEnabled, setPatternEnabled] = useState(false);
  const [patternHasCreds, setPatternHasCreds] = useState(false);
  const [patternError, setPatternError] = useState(false);
  const [patternLoading, setPatternLoading] = useState(false);
  const [totpAvailable, setTotpAvailable] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [otpMethod, setOtpMethod] = useState<"telegram" | "totp">("telegram");

  const readBooleanSetting = async (path: string): Promise<boolean> => {
    try {
      const snap = await get(ref(loginDb, path));
      return snap.val() === true;
    } catch {
      return false;
    }
  };

  const readStringSetting = async (path: string, fallback = ""): Promise<string> => {
    try {
      const snap = await get(ref(loginDb, path));
      const value = snap.val();
      return typeof value === "string" && value.length > 0 ? value : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const [bioOn, patOn, totpEnabled, secret, method] = await Promise.all([
          readBooleanSetting("security_settings/biometric_login"),
          readBooleanSetting("security_settings/pattern_login"),
          readBooleanSetting("security_settings/totp_enabled"),
          readStringSetting("security_settings/totp_secret", ""),
          readStringSetting("security_settings/otp_method", "telegram"),
        ]);

        setBioEnabled(bioOn);
        setBioAvailable(bioOn);
        setBioHasCreds(hasSavedCredentials());
        setPatternEnabled(patOn);
        setPatternHasCreds(hasSavedPattern());
        setTotpAvailable(totpEnabled);
        setTotpSecret(secret || null);
        setOtpMethod(method === "totp" ? "totp" : "telegram");
      } catch {
        setBioAvailable(false);
        setBioEnabled(false);
        setPatternEnabled(false);
        setPatternHasCreds(hasSavedPattern());
        setTotpAvailable(false);
        setTotpSecret(null);
        setOtpMethod("telegram");
      }
    };
    checkSettings();
  }, []);

  const handleAuthError = (err: any) => {
    const code = err?.code || "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
      toast.error("Invalid email or password");
    } else if (code === "auth/wrong-password") {
      toast.error("Wrong password");
    } else if (code === "auth/too-many-requests") {
      toast.error("Too many attempts. Try again later.");
    } else {
      toast.error("Login failed");
    }
  };

  const finalLogin = async (creds: { email: string; password: string }) => {
    await signInWithEmailAndPassword(loginAuth, creds.email, creds.password);
    await createSession(loginDb);
    // Save password for multi-account switching
    localStorage.setItem("dxp_login_pass", creds.password);
    if (bioEnabled) await saveCredentials(creds.email, creds.password);
    if (patternEnabled && hasSavedPattern()) {
      const { savePatternCreds } = await import("@/lib/biometric");
      await savePatternCreds(creds.email, creds.password);
    }
    toast.success("Login successful!");
  };

  const handleBiometricLogin = async () => {
    if (!bioHasCreds) {
      toast.error("No saved credentials. Login with email first.");
      return;
    }
    setBioLoading(true);
    try {
      const webAuthnAvailable = await isBiometricAvailable();
      if (webAuthnAvailable) {
        const verified = await verifyBiometric();
        if (!verified) {
          toast.error("Biometric verification failed");
          setBioLoading(false);
          return;
        }
      }
      const creds = await getCredentials();
      if (!creds) {
        toast.error("Saved credentials corrupted. Login with email.");
        setBioLoading(false);
        return;
      }
      await finalLogin(creds);
    } catch (err: any) {
      handleAuthError(err);
    }
    setBioLoading(false);
  };

  const handlePatternComplete = async (pattern: number[]) => {
    if (pattern.length < 4) {
      toast.error("Connect at least 4 dots");
      return;
    }
    setPatternLoading(true);
    setPatternError(false);
    try {
      const creds = await verifyPattern(pattern);
      if (!creds) {
        setPatternError(true);
        toast.error("Wrong pattern. Try again.");
        setTimeout(() => setPatternError(false), 600);
        setPatternLoading(false);
        return;
      }
      await finalLogin(creds);
    } catch (err: any) {
      handleAuthError(err);
    }
    setPatternLoading(false);
  };

  const handleLogin = async () => {
    if (!email || !password) return;

    setLoading(true);
    try {
      const otpOnLogin = await readBooleanSetting("security_settings/otp_on_login");
      if (otpOnLogin) {
        setPendingCreds({ email, password });
        if (otpMethod === "totp" && totpAvailable && totpSecret) {
          setStep("totp");
        } else {
          setStep("otp");
        }
        setLoading(false);
        return;
      }
      await finalLogin({ email, password });

    } catch (err: any) {
      handleAuthError(err);
    }
    setLoading(false);
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    const ok = await sendOtpToTelegram("Login verification");
    setSendingOtp(false);
    if (ok) { setOtpSent(true); toast.success("OTP sent to Telegram!"); }
    else toast.error("Failed to send OTP.");
  };

  const handleVerifyOtp = async (code: string) => {
    if (!pendingCreds) return;
    setVerifying(true);
    if (verifyOtp(code)) {
      toast.success("OTP verified!");
      try {
        await finalLogin(pendingCreds);
      } catch (err: any) { handleAuthError(err); }
    } else {
      toast.error("Invalid OTP. Try again.");
      setOtp("");
    }
    setVerifying(false);
  };

  const handleBack = () => {
    setStep("login");
    setOtp("");
    setOtpSent(false);
    setPendingCreds(null);
    setPatternError(false);
    setTotpCode("");
  };

  const hasAltLogin = bioAvailable || (patternEnabled && patternHasCreds);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[360px] space-y-7 relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative">
            <div className="h-[72px] w-[72px] rounded-[22px] bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.08)]">
              <Shield className="h-9 w-9 text-black" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-[2.5px] border-black"
            />
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Dark x Panel
              <span className="text-neutral-500 font-bold"> 3.0</span>
            </h1>
            <p className="text-[11px] text-neutral-600 font-medium tracking-widest uppercase">
              Secure Access Portal
            </p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-neutral-800/80 bg-neutral-950/80 backdrop-blur-sm p-5 space-y-4"
        >
          <AnimatePresence mode="wait">
            {step === "login" && (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-[15px] font-bold text-white">Welcome back</h2>
                  <p className="text-[11px] text-neutral-500">Sign in to access your panel</p>
                </div>

                <div className="space-y-2.5">
                  {/* Email */}
                  <div className={`relative rounded-xl border transition-all duration-200 ${focused === "email" ? "border-neutral-600 bg-neutral-900" : "border-neutral-800/60 bg-neutral-900/60"}`}>
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] transition-colors ${focused === "email" ? "text-neutral-300" : "text-neutral-600"}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                  </div>

                  {/* Password */}
                  <div className={`relative rounded-xl border transition-all duration-200 ${focused === "password" ? "border-neutral-600 bg-neutral-900" : "border-neutral-800/60 bg-neutral-900/60"}`}>
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] transition-colors ${focused === "password" ? "text-neutral-300" : "text-neutral-600"}`} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                  </div>

                  {/* Sign In */}
                  <button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-30 disabled:active:scale-100"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Sign In
                  </button>

                  {/* Alt login methods */}
                  {hasAltLogin && (
                    <>
                      <div className="flex items-center gap-3 py-0.5">
                        <div className="flex-1 h-px bg-neutral-800/60" />
                        <span className="text-[9px] text-neutral-600 uppercase tracking-[0.2em] font-medium">or</span>
                        <div className="flex-1 h-px bg-neutral-800/60" />
                      </div>

                      <div className="space-y-2">
                        {/* Biometric */}
                        {bioAvailable && (
                          <button
                            onClick={handleBiometricLogin}
                            disabled={bioLoading}
                            className="group w-full relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 active:scale-[0.97] transition-all disabled:opacity-40 disabled:active:scale-100"
                          >
                            <div className="flex items-center justify-center gap-3 py-3 px-4">
                              <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                                {bioLoading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Fingerprint className="h-4 w-4 text-white" />}
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="text-[13px] font-semibold text-white leading-tight">Fingerprint Login</span>
                                <span className="text-[10px] text-neutral-500 leading-tight">
                                  {bioHasCreds ? "Tap to authenticate" : "Login with email first"}
                                </span>
                              </div>
                              <span className="ml-auto text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">New</span>
                            </div>
                          </button>
                        )}

                        {/* Pattern */}
                        {patternEnabled && patternHasCreds && (
                          <button
                            onClick={() => setStep("pattern")}
                            className="group w-full relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/40 hover:bg-neutral-900 hover:border-neutral-700 active:scale-[0.97] transition-all"
                          >
                            <div className="flex items-center justify-center gap-3 py-3 px-4">
                              <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.1] transition-colors">
                                <Grid3X3 className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex flex-col items-start">
                                <span className="text-[13px] font-semibold text-white leading-tight">Pattern Unlock</span>
                                <span className="text-[10px] text-neutral-500 leading-tight">Draw your pattern to login</span>
                              </div>
                              <span className="ml-auto text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">New</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {step === "pattern" && (
              <motion.div key="pattern" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <button onClick={handleBack} className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800/60 flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                      <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                    </button>
                    <h2 className="text-[15px] font-bold text-white">Pattern Unlock</h2>
                  </div>
                  <p className="text-[11px] text-neutral-500 ml-9">Draw your pattern to sign in</p>
                </div>

                <div className="flex flex-col items-center gap-4 py-2">
                  <PatternLock
                    onComplete={handlePatternComplete}
                    disabled={patternLoading}
                    error={patternError}
                    size={220}
                  />
                  {patternLoading && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                      <span className="text-xs text-neutral-500">Verifying...</span>
                    </div>
                  )}
                  {patternError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-400 font-medium"
                    >
                      Wrong pattern. Try again.
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )}

            {step === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <button onClick={handleBack} className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800/60 flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                      <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                    </button>
                    <h2 className="text-[15px] font-bold text-white">2FA Verification</h2>
                  </div>
                  <p className="text-[11px] text-neutral-500 ml-9">Verify your identity to continue</p>
                </div>

                {!otpSent ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                      A 4-digit OTP will be sent to your Telegram.
                    </p>
                    <button
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-40"
                    >
                      {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Send OTP to Telegram
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                      Enter the 4-digit OTP sent to your Telegram.
                    </p>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setOtp(val);
                        if (val.length === 4) setTimeout(() => handleVerifyOtp(val), 200);
                      }}
                      placeholder="0000"
                      maxLength={4}
                      autoFocus
                      className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-4 py-3.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerifyOtp(otp)}
                        disabled={otp.length !== 4 || verifying}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-40"
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        Verify
                      </button>
                      <button
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                        className="px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800/60 text-[11px] font-medium text-neutral-500 hover:text-white hover:border-neutral-700 transition-all disabled:opacity-40"
                      >
                        {sendingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resend"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === "totp" && (
              <motion.div key="totp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <button onClick={handleBack} className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800/60 flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                      <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                    </button>
                    <h2 className="text-[15px] font-bold text-white">Authenticator</h2>
                  </div>
                  <p className="text-[11px] text-neutral-500 ml-9">Enter code from your authenticator app</p>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setTotpCode(val);
                      if (val.length === 6 && pendingCreds && totpSecret) {
                        setTimeout(async () => {
                          setVerifying(true);
                          if (verifyTotp(totpSecret, val)) {
                            toast.success("Code verified!");
                            try { await finalLogin(pendingCreds); } catch (err: any) { handleAuthError(err); }
                          } else {
                            toast.error("Invalid code. Try again.");
                            setTotpCode("");
                          }
                          setVerifying(false);
                        }, 200);
                      }
                    }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-4 py-3.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
                  />
                  <button
                    onClick={async () => {
                      if (totpCode.length !== 6 || !pendingCreds || !totpSecret) return;
                      setVerifying(true);
                      if (verifyTotp(totpSecret, totpCode)) {
                        toast.success("Code verified!");
                        try { await finalLogin(pendingCreds); } catch (err: any) { handleAuthError(err); }
                      } else {
                        toast.error("Invalid code. Try again.");
                        setTotpCode("");
                      }
                      setVerifying(false);
                    }}
                    disabled={totpCode.length !== 6 || verifying}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-40"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Verify
                  </button>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[10px] text-neutral-700 font-mono tracking-wide"
        >
          v3.0.0 • Dark x Panel
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
