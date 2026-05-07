import { useState, useEffect } from "react";
import { X, Shield, Loader2, KeyRound, Smartphone } from "lucide-react";
import { verifyOtp, sendOtpToTelegram } from "@/lib/telegram";
import { getTotpSettings, verifyTotp } from "@/lib/totp";
import { ref, get } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface OtpDialogProps {
  action: string;
  onVerified: () => void;
  onCancel: () => void;
}

const OtpDialog = ({ action, onVerified, onCancel }: OtpDialogProps) => {
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [method, setMethod] = useState<"telegram" | "totp" | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [methodSnap, totpSettings] = await Promise.all([
          get(ref(db, "security_settings/otp_method")),
          getTotpSettings(),
        ]);
        const m = methodSnap.val() || "telegram";
        if (m === "totp" && totpSettings.enabled && totpSettings.secret) {
          setMethod("totp");
          setTotpSecret(totpSettings.secret);
        } else {
          setMethod("telegram");
        }
      } catch {
        setMethod("telegram");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSendOtp = async () => {
    setSending(true);
    const ok = await sendOtpToTelegram(action);
    setSending(false);
    if (ok) {
      setSent(true);
      toast.success("OTP sent to Telegram!");
    } else {
      toast.error("Failed to send OTP. Check Telegram bot settings.");
    }
  };

  const handleVerify = () => {
    setVerifying(true);
    if (verifyOtp(otp)) {
      toast.success("OTP verified!");
      onVerified();
    } else {
      toast.error("Invalid OTP. Try again.");
      setOtp("");
    }
    setVerifying(false);
  };

  const handleTotpVerify = () => {
    if (!totpSecret || totpCode.length !== 6) return;
    setVerifying(true);
    if (verifyTotp(totpSecret, totpCode)) {
      toast.success("Code verified!");
      onVerified();
    } else {
      toast.error("Invalid code. Try again.");
      setTotpCode("");
    }
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center px-5">
        <div className="w-full max-w-sm bg-card border border-primary/20 rounded-2xl p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 px-5" onClick={onCancel}>
      <div
        className="w-full max-w-sm bg-card border border-primary/20 rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-300 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
              {method === "totp" ? <Smartphone className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                {method === "totp" ? "Authenticator" : "2FA Verification"}
              </h3>
              <p className="text-[10px] text-muted-foreground">{action}</p>
            </div>
          </div>
          <button onClick={onCancel} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {method === "totp" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter the 6-digit code from your authenticator app.
            </p>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setTotpCode(val);
                if (val.length === 6 && totpSecret) {
                  setTimeout(() => {
                    setVerifying(true);
                    if (verifyTotp(totpSecret, val)) {
                      toast.success("Code verified!");
                      onVerified();
                    } else {
                      toast.error("Invalid code. Try again.");
                      setTotpCode("");
                    }
                    setVerifying(false);
                  }, 300);
                }
              }}
              placeholder="Enter 6-digit code"
              maxLength={6}
              autoFocus
              className="w-full text-center text-2xl font-mono font-bold tracking-[0.4em] rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-foreground placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleTotpVerify}
              disabled={totpCode.length !== 6 || verifying}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Verify
            </button>
          </div>
        ) : (
          <>
            {!sent ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A 4-digit OTP will be sent to your Telegram. Enter it below to confirm this action.
                </p>
                <button
                  onClick={handleSendOtp}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Send OTP to Telegram
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter the 4-digit OTP sent to your Telegram.
                </p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setOtp(val);
                    if (val.length === 4) {
                      setVerifying(true);
                      setTimeout(() => {
                        if (verifyOtp(val)) {
                          toast.success("OTP verified!");
                          onVerified();
                        } else {
                          toast.error("Invalid OTP. Try again.");
                          setOtp("");
                        }
                        setVerifying(false);
                      }, 300);
                    }
                  }}
                  placeholder="Enter 4-digit OTP"
                  maxLength={4}
                  autoFocus
                  className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-foreground placeholder:text-muted-foreground placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleVerify}
                    disabled={otp.length !== 4 || verifying}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Verify
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={sending}
                    className="px-4 py-3 rounded-xl bg-secondary border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resend"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OtpDialog;
