import { useState } from "react";
import { usePanelConfig, updateAdminName, updateExpiryDate } from "@/hooks/usePanelConfig";
import { sendOtpToTelegram, verifyOtp } from "@/lib/telegram";
import { ArrowLeft, Edit2, Clock, Check, X, Loader2, Shield, Calendar, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ProfilePage = () => {
  const { config, daysRemaining } = usePanelConfig();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const firstLetter = config.admin_name?.charAt(0)?.toUpperCase() || "?";

  const handleNameSave = async () => {
    if (!nameValue.trim()) return;
    await updateAdminName(nameValue);
    setEditingName(false);
    toast.success("Name updated");
  };

  const handleSendOtp = async () => {
    setSending(true);
    const sent = await sendOtpToTelegram("Extend Panel Expiry");
    setSending(false);
    if (sent) {
      setOtpSent(true);
      toast.success("OTP sent to Telegram");
    } else {
      toast.error("Failed to send OTP. Check Telegram settings.");
    }
  };

  const handleVerifyAndExtend = async () => {
    setVerifying(true);
    const valid = verifyOtp(otpValue);
    if (!valid) {
      setVerifying(false);
      toast.error("Invalid OTP");
      return;
    }

    const now = new Date();
    let newDate: Date;
    const code = secretCode.trim();

    if (code === "0987") {
      newDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      toast.success("+1 week added");
    } else if (code === "0765") {
      newDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      toast.success("+15 days added");
    } else if (code === "6663") {
      newDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      toast.success("+1 month added");
    } else if (code === "0067") {
      newDate = new Date("2099-12-31");
      toast.success("Lifetime access granted");
    } else {
      newDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      toast.error("Wrong code! Panel set to 1 week only.");
    }

    const formatted = newDate.toISOString().split("T")[0];
    await updateExpiryDate(formatted);
    setVerifying(false);
    setOtpSent(false);
    setOtpValue("");
    setSecretCode("");
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/60 backdrop-blur-2xl">
        <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-secondary/60 flex items-center justify-center hover:bg-primary/20 transition-all active:scale-95">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <h1 className="text-base font-extrabold text-foreground tracking-tight">Profile</h1>
        </div>
      </header>

      <main className="px-5 py-6 space-y-4 max-w-5xl mx-auto">
        {/* Avatar & Name Card */}
        <div className="rounded-2xl border border-primary/15 bg-card/40 backdrop-blur-sm p-6 flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-3xl bg-primary flex items-center justify-center text-primary-foreground text-3xl font-black shadow-lg shadow-primary/20">
            {firstLetter}
          </div>

          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="flex-1 bg-secondary/60 border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground text-center outline-none focus:border-primary/40"
                autoFocus
                maxLength={30}
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
              />
              <button onClick={handleNameSave} className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center hover:bg-primary/25 transition-colors">
                <Check className="h-4 w-4 text-primary" />
              </button>
              <button onClick={() => setEditingName(false)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/15 transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setNameValue(config.admin_name); setEditingName(true); }}
              className="flex items-center gap-2 group"
            >
              <h2 className="text-lg font-black text-foreground">{config.admin_name}</h2>
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          )}

          {daysRemaining !== null && daysRemaining > 0 && (() => {
            if (daysRemaining > 10000) return (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow/20 to-primary/20 border border-yellow/30 text-[10px] font-black uppercase tracking-wider">
                <Crown className="h-3 w-3 text-yellow" />
                <span className="bg-gradient-to-r from-yellow to-primary bg-clip-text text-transparent">VIP3 · Premium</span>
              </span>
            );
            if (daysRemaining > 25) return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow/20 to-amber-500/15 border border-yellow/35 shadow-[0_0_10px_rgba(234,179,8,0.2)] text-[10px] font-black uppercase tracking-widest">
                <Crown className="h-3 w-3 text-yellow drop-shadow-[0_0_3px_rgba(234,179,8,0.5)]" />
                <span className="bg-gradient-to-r from-yellow to-amber-400 bg-clip-text text-transparent">Gold</span>
              </span>
            );
            if (daysRemaining >= 7) return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-300/20 to-gray-400/15 border border-slate-300/35 shadow-[0_0_8px_rgba(148,163,184,0.2)] text-[10px] font-black uppercase tracking-widest">
                <Crown className="h-3 w-3 text-slate-300 drop-shadow-[0_0_3px_rgba(148,163,184,0.5)]" />
                <span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">Silver</span>
              </span>
            );
            return (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-700/15 border border-amber-700/30 text-[10px] font-black uppercase tracking-wider">
                <Crown className="h-3 w-3 text-amber-700" />
                <span className="text-amber-700">Bronze</span>
              </span>
            );
          })()}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-green" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Status</p>
              <p className="text-sm font-bold text-green mt-0.5">Active</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Expires</p>
              <p className={`text-sm font-bold mt-0.5 ${
                daysRemaining !== null && daysRemaining <= 7 ? "text-destructive" :
                daysRemaining !== null && daysRemaining <= 30 ? "text-yellow" : "text-green"
              }`}>
                {daysRemaining !== null && daysRemaining > 365 ? "Lifetime" :
                 daysRemaining !== null && daysRemaining > 0 ? `${daysRemaining} days` : "Expired"}
              </p>
            </div>
          </div>
        </div>

        {config.expiry_date && (
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Expiry date: {new Date(config.expiry_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        )}

      </main>
    </div>
  );
};

export default ProfilePage;
