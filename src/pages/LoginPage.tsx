import { useEffect, useState } from "react";
import { Shield, Loader2, LogIn, Mail, Lock, KeyRound, ArrowLeft, QrCode, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { loginStart, loginVerifyTotp, loginVerifyTotpEnroll } from "@/lib/authPb";
import { ApiError } from "@/lib/apiClient";

type Stage = "credentials" | "enroll-qr" | "enroll-verify" | "verify";

type EnrollData = { secret: string; otpauth: string; qr: string; issuer: string; label: string };

const LoginPage = () => {
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (stage === "credentials") {
      setCode("");
      setChallenge(null);
      setEnrollData(null);
    }
  }, [stage]);

  const reset = () => {
    setStage("credentials");
    setCode("");
    setChallenge(null);
    setEnrollData(null);
    setVerifying(false);
  };

  const handleLogin = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    try {
      const res = await loginStart(email.trim().toLowerCase(), password);
      setChallenge(res.challenge);
      if (res.step === "enroll") {
        setEnrollData(res.totp);
        setStage("enroll-qr");
      } else {
        setStage("verify");
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed";
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleVerify = async (digits: string) => {
    if (!challenge || verifying) return;
    if (digits.length !== 6) return;
    setVerifying(true);
    try {
      if (stage === "enroll-verify") {
        await loginVerifyTotpEnroll(challenge, digits);
      } else {
        await loginVerifyTotp(challenge, digits);
      }
      toast.success("Logged in");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Verification failed";
      toast.error(msg);
      setCode("");
    }
    setVerifying(false);
  };

  const handleCopySecret = async () => {
    if (!enrollData) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

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
            <h1 className="text-2xl font-black text-white tracking-tight">Cyber Panel</h1>
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
            {stage === "credentials" && (
              <motion.div key="credentials" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-[15px] font-bold text-white">Welcome back</h2>
                  <p className="text-[11px] text-neutral-500">Sign in to access your panel</p>
                </div>

                <div className="space-y-2.5">
                  <div className={`relative rounded-xl border transition-all duration-200 ${focused === "email" ? "border-neutral-600 bg-neutral-900" : "border-neutral-800/60 bg-neutral-900/60"}`}>
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] transition-colors ${focused === "email" ? "text-neutral-300" : "text-neutral-600"}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      autoComplete="email"
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                  </div>

                  <div className={`relative rounded-xl border transition-all duration-200 ${focused === "password" ? "border-neutral-600 bg-neutral-900" : "border-neutral-800/60 bg-neutral-900/60"}`}>
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] transition-colors ${focused === "password" ? "text-neutral-300" : "text-neutral-600"}`} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full bg-transparent rounded-xl pl-10 pr-3 py-3 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading || !email || !password}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-30 disabled:active:scale-100"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Continue
                  </button>

                  <p className="text-[10px] text-neutral-600 text-center pt-1">
                    Two-factor authentication is required for every account.
                  </p>
                </div>
              </motion.div>
            )}

            {stage === "enroll-qr" && enrollData && (
              <motion.div key="enroll-qr" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={reset} className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800/60 flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                    <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                  </button>
                  <h2 className="text-[15px] font-bold text-white">Set up Authenticator</h2>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Scan this QR with Google Authenticator (or any TOTP app), then continue to verify.
                </p>
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-3">
                    <img src={enrollData.qr} alt="TOTP QR" className="h-44 w-44" />
                  </div>
                </div>
                <div className="rounded-xl bg-neutral-900/60 border border-neutral-800/60 p-3 space-y-1.5">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">Manual key</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-[12px] font-mono text-white break-all select-all">{enrollData.secret}</p>
                    <button
                      onClick={handleCopySecret}
                      className="h-7 w-7 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center justify-center text-neutral-300 shrink-0"
                    >
                      {secretCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setStage("enroll-verify")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all"
                >
                  <QrCode className="h-4 w-4" />
                  I've scanned it — verify
                </button>
              </motion.div>
            )}

            {(stage === "enroll-verify" || stage === "verify") && (
              <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={reset} className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800/60 flex items-center justify-center hover:bg-neutral-800 transition-colors active:scale-95">
                    <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
                  </button>
                  <h2 className="text-[15px] font-bold text-white">{stage === "enroll-verify" ? "Confirm code" : "Authenticator code"}</h2>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(val);
                    if (val.length === 6) void handleVerify(val);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] rounded-xl border border-neutral-800/60 bg-neutral-900/60 px-4 py-3.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
                />
                <button
                  onClick={() => void handleVerify(code)}
                  disabled={code.length !== 6 || verifying}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black text-[13px] font-bold hover:bg-neutral-100 active:scale-[0.97] transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Verify & Sign in
                </button>
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
          Cyber Panel
        </motion.p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
