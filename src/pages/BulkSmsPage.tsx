import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useFirebaseUsers } from "@/hooks/useFirebaseData";
import { sendSMS, sendPing } from "@/lib/fcm";
import { Upload, Send, X, FileText, Smartphone, CheckCircle2, XCircle, Loader2, AlertTriangle, Wifi, Hash, MessageSquare, Clock, Trash2, Settings2, Variable, Zap, Radio, GripVertical, Eye, Type, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type SendStatus = "idle" | "running" | "done";
type LogEntry = { device: string; number: string; status: "ok" | "fail"; error?: string; message?: string; vars?: string[]; timestamp?: number };
type Recipient = { number: string; vars: string[] };
type RawParsed = { columns: string[][]; headerSample: string[][] };

const MAX_NUMBERS = 1000;
const PER_DEVICE = 50;
const DEVICE_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
const DEVICE_COOLDOWN_KEY = "dxp_device_cooldowns";

// Per-device cooldown helpers using localStorage
function getDeviceCooldowns(): Record<string, number> {
  try {
    const stored = localStorage.getItem(DEVICE_COOLDOWN_KEY);
    if (!stored) return {};
    const data = JSON.parse(stored);
    const now = Date.now();
    // Clean expired
    const clean: Record<string, number> = {};
    for (const [id, exp] of Object.entries(data)) {
      if (typeof exp === "number" && exp > now) clean[id] = exp;
    }
    if (Object.keys(clean).length !== Object.keys(data).length) {
      localStorage.setItem(DEVICE_COOLDOWN_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch { return {}; }
}

function setDeviceCooldown(deviceId: string) {
  const data = getDeviceCooldowns();
  data[deviceId] = Date.now() + DEVICE_COOLDOWN_MS;
  localStorage.setItem(DEVICE_COOLDOWN_KEY, JSON.stringify(data));
}

function isDeviceOnCooldown(deviceId: string): boolean {
  const data = getDeviceCooldowns();
  return !!(data[deviceId] && data[deviceId] > Date.now());
}

function getDeviceCooldownExpiry(deviceId: string): number | null {
  const data = getDeviceCooldowns();
  return data[deviceId] && data[deviceId] > Date.now() ? data[deviceId] : null;
}

const BulkSmsPage = () => {
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const { users, loading } = useFirebaseUsers();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [rawInput, setRawInput] = useState("");
  const [message, setMessage] = useState("");
  const [sim, setSim] = useState<"0" | "1">("0");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [excludedDevices, setExcludedDevices] = useState<Set<string>>(new Set());
  const [deviceSearch, setDeviceSearch] = useState("");
  const [devicePage, setDevicePage] = useState(0);
  const DEVICES_PER_PAGE = 20;
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [rawParsed, setRawParsed] = useState<RawParsed | null>(null);
  const [numberColIndex, setNumberColIndex] = useState(0);
  const [pinging, setPinging] = useState(false);
  const [pingModalOpen, setPingModalOpen] = useState(false);
  const [pingResults, setPingResults] = useState<{ brand: string; model: string; online: boolean; status: "pending" | "ok" | "fail" }[]>([]);
  const [pingDone, setPingDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedVar, setDraggedVar] = useState<number | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [currentSendInfo, setCurrentSendInfo] = useState<{ number: string; device: string; message: string; vars: string[]; index: number } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Per-device cooldown tracking
  const [deviceCooldowns, setDeviceCooldowns] = useState<Record<string, number>>(() => getDeviceCooldowns());
  const [, setTick] = useState(0);

  // Refresh cooldowns every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setDeviceCooldowns(getDeviceCooldowns());
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const cooledDownDeviceIds = useMemo(() => {
    return new Set(Object.keys(deviceCooldowns).filter(id => deviceCooldowns[id] > Date.now()));
  }, [deviceCooldowns]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  const onlineDevices = useMemo(() => {
    return Object.entries(users)
      .filter(([id, u]) => u.status === "online" && u.fcm_token && !excludedDevices.has(id) && !cooledDownDeviceIds.has(id))
      .map(([id, u]) => ({ id, brand: u.brand, model: u.model, fcm: u.fcm_token }));
  }, [users, excludedDevices, cooledDownDeviceIds]);

  const allOnlineDevices = useMemo(() => {
    return Object.entries(users)
      .filter(([, u]) => u.status === "online" && u.fcm_token)
      .map(([id, u]) => ({ id, brand: u.brand, model: u.model, fcm: u.fcm_token }));
  }, [users]);

  const allDevicesWithFcm = useMemo(() => {
    return Object.entries(users)
      .filter(([, u]) => u.fcm_token)
      .map(([id, u]) => ({ id, brand: u.brand, model: u.model, fcm: u.fcm_token, online: u.status === "online" }));
  }, [users]);

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return allOnlineDevices;
    const q = deviceSearch.toLowerCase();
    return allOnlineDevices.filter(d => `${d.brand} ${d.model}`.toLowerCase().includes(q));
  }, [allOnlineDevices, deviceSearch]);

  const totalDevicePages = Math.max(1, Math.ceil(filteredDevices.length / DEVICES_PER_PAGE));
  const paginatedDevices = filteredDevices.slice(devicePage * DEVICES_PER_PAGE, (devicePage + 1) * DEVICES_PER_PAGE);

  const toggleExclude = (id: string) => {
    setExcludedDevices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const parseRawLines = (text: string): RawParsed | null => {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    const allParts = lines.map(l => l.split(/[,;]/).map(p => p.trim()));
    const maxCols = allParts.reduce((m, p) => Math.max(m, p.length), 0);
    // columns[i] = array of values in column i
    const columns: string[][] = Array.from({ length: maxCols }, (_, ci) =>
      allParts.map(p => p[ci] ?? "")
    );
    const headerSample = allParts.slice(0, 5);
    return { columns, headerSample };
  };

  const buildRecipients = (parsed: RawParsed, numCol: number): Recipient[] => {
    const results: Recipient[] = [];
    const seen = new Set<string>();
    const rowCount = parsed.columns[0]?.length ?? 0;
    for (let r = 0; r < rowCount; r++) {
      const number = (parsed.columns[numCol]?.[r] ?? "").replace(/[^\d+]/g, "");
      if (number.length < 7 || seen.has(number)) continue;
      seen.add(number);
      const vars: string[] = [];
      for (let c = 0; c < parsed.columns.length; c++) {
        if (c === numCol) continue;
        vars.push(parsed.columns[c][r] ?? "");
      }
      results.push({ number, vars });
      if (results.length >= MAX_NUMBERS) break;
    }
    return results;
  };

  const maxVarCount = useMemo(() => {
    return recipients.reduce((max, r) => Math.max(max, r.vars.length), 0);
  }, [recipients]);

  const handleTextParse = () => {
    const parsed = parseRawLines(rawInput);
    if (!parsed || parsed.columns.length === 0) {
      toast.error("No valid data found");
      return;
    }
    if (parsed.columns.length === 1) {
      // Only one column, no need to pick
      setNumberColIndex(0);
      const recs = buildRecipients(parsed, 0);
      setRecipients(recs);
      if (recs.length > 0) toast.success(`${recs.length} recipients loaded`);
      else toast.error("No valid numbers found");
    } else {
      // Multiple columns — auto-detect best guess then let user choose
      const bestGuess = parsed.columns.findIndex(col =>
        col.filter(v => v.replace(/[^\d+]/g, "").length >= 7).length > col.length * 0.5
      );
      setNumberColIndex(bestGuess >= 0 ? bestGuess : 0);
      setRawParsed(parsed);
      setColumnPickerOpen(true);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawInput(text);
      const parsed = parseRawLines(text);
      if (!parsed || parsed.columns.length === 0) {
        toast.error("No valid data in CSV");
        return;
      }
      if (parsed.columns.length === 1) {
        setNumberColIndex(0);
        const recs = buildRecipients(parsed, 0);
        setRecipients(recs);
        if (recs.length > 0) toast.success(`${recs.length} recipients from CSV`);
        else toast.error("No valid numbers in CSV");
      } else {
        const bestGuess = parsed.columns.findIndex(col =>
          col.filter(v => v.replace(/[^\d+]/g, "").length >= 7).length > col.length * 0.5
        );
        setNumberColIndex(bestGuess >= 0 ? bestGuess : 0);
        setRawParsed(parsed);
        setColumnPickerOpen(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resolveMessage = (template: string, vars: string[]): string => {
    return template.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
      const i = parseInt(idx) - 1;
      return vars[i] ?? `{{${idx}}}`;
    });
  };

  const startSending = useCallback(async () => {
    if (!message.trim() || recipients.length === 0 || onlineDevices.length === 0) return;

    abortRef.current = false;
    setStatus("running");
    setLog([]);
    setSent(0);
    setTotal(recipients.length);
    setCurrentSendInfo(null);

    const newLog: LogEntry[] = [];
    let sentCount = 0;

    let deviceIdx = 0;
    for (let i = 0; i < recipients.length; i++) {
      if (abortRef.current) break;

      if (i > 0 && i % PER_DEVICE === 0) {
        deviceIdx++;
        if (deviceIdx >= onlineDevices.length) {
          const remaining = recipients.length - i;
          toast.error(`Ran out of devices. ${remaining} numbers not sent.`);
          break;
        }
      }

      const device = onlineDevices[deviceIdx];
      const recipient = recipients[i];
      const finalMsg = resolveMessage(message.trim(), recipient.vars);

      setCurrentSendInfo({ number: recipient.number, device: `${device.brand} ${device.model}`, message: finalMsg, vars: recipient.vars, index: i });

      try {
        const res = await sendSMS(device.fcm, recipient.number, finalMsg, sim);
        const entry: LogEntry = {
          device: `${device.brand} ${device.model}`,
          number: recipient.number,
          status: res.success ? "ok" : "fail",
          error: res.error,
          message: finalMsg,
          vars: recipient.vars,
          timestamp: Date.now(),
        };
        newLog.push(entry);
        sentCount++;
        setSent(sentCount);
        setLog([...newLog]);
      } catch (err: any) {
        newLog.push({ device: `${device.brand} ${device.model}`, number: recipient.number, status: "fail", error: err.message, message: finalMsg, vars: recipient.vars, timestamp: Date.now() });
        sentCount++;
        setSent(sentCount);
        setLog([...newLog]);
      }

      if (i < recipients.length - 1) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    setCurrentSendInfo(null);
    setStatus("done");

    // Mark devices that sent 50 msgs as cooled down
    const deviceSendCounts: Record<string, number> = {};
    for (const entry of newLog) {
      deviceSendCounts[entry.device] = (deviceSendCounts[entry.device] || 0) + 1;
    }
    // Map device display names back to IDs
    let devIdx = 0;
    let countForCurrent = 0;
    for (let i = 0; i < newLog.length; i++) {
      countForCurrent++;
      if (countForCurrent >= PER_DEVICE || i === newLog.length - 1) {
        if (devIdx < onlineDevices.length) {
          setDeviceCooldown(onlineDevices[devIdx].id);
        }
        countForCurrent = 0;
        devIdx++;
      }
    }
    setDeviceCooldowns(getDeviceCooldowns());

    const okCount = newLog.filter(l => l.status === "ok").length;
    const failCount = newLog.filter(l => l.status === "fail").length;
    toast.success(`Done! ${okCount} sent, ${failCount} failed`);
  }, [recipients, message, sim, onlineDevices]);

  const stopSending = () => {
    abortRef.current = true;
  };

  const devicesNeeded = Math.ceil(recipients.length / PER_DEVICE);
  const okCount = log.filter(l => l.status === "ok").length;
  const failCount = log.filter(l => l.status === "fail").length;
  const progress = total > 0 ? (sent / total) * 100 : 0;
  const hasCooledDownDevices = cooledDownDeviceIds.size > 0;

  // Get cooled down device info for display
  const cooledDownDevicesInfo = useMemo(() => {
    return Object.entries(users)
      .filter(([id]) => cooledDownDeviceIds.has(id))
      .map(([id, u]) => {
        const expiry = getDeviceCooldownExpiry(id);
        const remaining = expiry ? expiry - Date.now() : 0;
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        return { id, brand: u.brand, model: u.model, timeLeft: `${h}h ${m}m` };
      });
  }, [users, cooledDownDeviceIds]);

  return (
    <div className="min-h-screen pb-24 lg:pb-6 bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                <Send className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-foreground tracking-tight">Bulk SMS</h1>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {onlineDevices.length} devices · {onlineDevices.length * PER_DEVICE} SMS capacity
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (pinging) return;
                const shuffled = [...allDevicesWithFcm].sort(() => Math.random() - 0.5);
                const toPing = shuffled.slice(0, Math.min(Math.floor(Math.random() * 11) + 20, shuffled.length));
                setPingResults(toPing.map(d => ({ brand: d.brand, model: d.model, online: d.online, status: "pending" })));
                setPingDone(false);
                setPingModalOpen(true);
                setPinging(true);

                (async () => {
                  for (let i = 0; i < toPing.length; i++) {
                    const res = await sendPing(toPing[i].fcm);
                    setPingResults(prev => prev.map((r, ri) => ri === i ? { ...r, status: res.success ? "ok" : "fail" } : r));
                  }
                  setPinging(false);
                  setPingDone(true);
                })();
              }}
              disabled={pinging}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {pinging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
              Ping
            </button>
          </div>
        </div>
      </header>

        {/* Ping modal */}
        <Dialog open={pingModalOpen} onOpenChange={(open) => { if (!pinging) setPingModalOpen(open); }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Radio className="h-4 w-4 text-primary" />
                Pinging Devices
                {pingDone && (
                  <span className="text-[10px] font-semibold text-muted-foreground ml-auto">
                    {pingResults.filter(r => r.status === "ok").length}/{pingResults.length} responded
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {!pingDone && (
                <div className="space-y-1.5">
                  <Progress value={(pingResults.filter(r => r.status !== "pending").length / Math.max(1, pingResults.length)) * 100} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground text-center">
                    {pingResults.filter(r => r.status !== "pending").length} / {pingResults.length} completed
                  </p>
                </div>
              )}
              {pingDone && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-black text-green-500">{pingResults.filter(r => r.status === "ok").length}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold">Success</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-destructive">{pingResults.filter(r => r.status === "fail").length}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-muted-foreground">{pingResults.length}</p>
                      <p className="text-[9px] text-muted-foreground font-semibold">Total</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {pingResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                      r.status === "ok" ? "bg-green-500/5 border border-green-500/20" :
                      r.status === "fail" ? "bg-destructive/5 border border-destructive/20" :
                      "bg-secondary/50 border border-transparent"
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                      r.status === "ok" ? "bg-green-500/15" :
                      r.status === "fail" ? "bg-destructive/15" :
                      "bg-muted"
                    }`}>
                      {r.status === "pending" ? (
                        <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                      ) : r.status === "ok" ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-semibold text-foreground truncate block">
                        {r.brand} {r.model}
                      </span>
                      <span className={`text-[9px] ${r.online ? "text-green-500" : "text-muted-foreground"}`}>
                        {r.online ? "Online" : "Offline"}
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                      r.status === "ok" ? "text-green-600 bg-green-500/10" :
                      r.status === "fail" ? "text-destructive bg-destructive/10" :
                      "text-muted-foreground bg-muted"
                    }`}>
                      {r.status === "pending" ? "Pinging..." : r.status === "ok" ? "OK" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
              {pingDone && (
                <button
                  onClick={() => setPingModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
                >
                  Done
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="px-5 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Cooled down devices banner */}
        {hasCooledDownDevices && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            <div className="flex items-center gap-3 p-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">{cooledDownDevicesInfo.length} Device{cooledDownDevicesInfo.length > 1 ? "s" : ""} on Cooldown</p>
                <p className="text-[10px] text-muted-foreground">Sent 50 SMS — excluded for 12 hours</p>
              </div>
            </div>
            <div className="px-3.5 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
              {cooledDownDevicesInfo.map(d => (
                <div key={d.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <Smartphone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground flex-1 truncate">{d.brand} {d.model}</span>
                  <span className="text-[10px] font-bold text-amber-500 font-mono">{d.timeLeft}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Online devices count */}
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
          <div className="h-9 w-9 rounded-xl bg-green-500/15 flex items-center justify-center">
            <Wifi className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-foreground">{loading ? "Loading..." : `${onlineDevices.length} Active Devices`}</p>
            <p className="text-[10px] text-muted-foreground">
              Each device sends up to {PER_DEVICE} SMS
              {excludedDevices.size > 0 && <span className="text-destructive ml-1">({excludedDevices.size} excluded)</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Max capacity</p>
            <p className="text-xs font-bold text-primary">{onlineDevices.length * PER_DEVICE} SMS</p>
          </div>
        </div>

        {/* Manage devices button */}
        {allOnlineDevices.length > 0 && (
          <button
            onClick={() => setDeviceModalOpen(true)}
            className="flex items-center gap-2.5 w-full p-3 rounded-2xl border border-border bg-card hover:bg-secondary/50 transition-colors"
          >
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-foreground">Manage Devices</p>
              <p className="text-[10px] text-muted-foreground">
                {excludedDevices.size > 0
                  ? `${excludedDevices.size} device${excludedDevices.size > 1 ? "s" : ""} excluded`
                  : "Tap to exclude devices from sending"}
              </p>
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              {onlineDevices.length}/{allOnlineDevices.length}
            </span>
          </button>
        )}

        {/* Device exclusion modal */}
        <Dialog open={deviceModalOpen} onOpenChange={(open) => { setDeviceModalOpen(open); if (!open) { setDeviceSearch(""); setDevicePage(0); } }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Manage Devices
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] text-muted-foreground">{onlineDevices.length} active · {excludedDevices.size} excluded</p>
                {excludedDevices.size > 0 && (
                  <button onClick={() => setExcludedDevices(new Set())} className="text-[10px] font-semibold text-primary hover:underline">
                    Include All
                  </button>
                )}
              </div>
              {allOnlineDevices.length > 20 && (
                <input
                  value={deviceSearch}
                  onChange={(e) => { setDeviceSearch(e.target.value); setDevicePage(0); }}
                  placeholder="Search devices..."
                  className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {paginatedDevices.map((d) => {
                  const isExcluded = excludedDevices.has(d.id);
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                        isExcluded ? "bg-destructive/5 border border-destructive/20" : "bg-secondary/50 border border-transparent hover:bg-secondary"
                      }`}
                      onClick={() => toggleExclude(d.id)}
                    >
                      <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isExcluded ? "bg-destructive/15" : "bg-green-500/15"
                      }`}>
                        <Smartphone className={`h-3 w-3 ${isExcluded ? "text-destructive" : "text-green-500"}`} />
                      </div>
                      <span className={`text-[11px] font-semibold flex-1 truncate ${isExcluded ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {d.brand} {d.model}
                      </span>
                      {isExcluded ? (
                        <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md">Excluded</span>
                      ) : (
                        <span className="text-[9px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-md">Active</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {totalDevicePages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setDevicePage(p => Math.max(0, p - 1))}
                    disabled={devicePage === 0}
                    className="px-2.5 py-1 rounded-lg bg-secondary text-[10px] font-bold text-foreground disabled:opacity-30"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground">{devicePage + 1}/{totalDevicePages}</span>
                  <button
                    onClick={() => setDevicePage(p => Math.min(totalDevicePages - 1, p + 1))}
                    disabled={devicePage >= totalDevicePages - 1}
                    className="px-2.5 py-1 rounded-lg bg-secondary text-[10px] font-bold text-foreground disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Column picker modal */}
        <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-primary" />
                Select Number Column
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Which column contains phone numbers? Others become variables.
              </p>
              {/* Preview table */}
              {rawParsed && rawParsed.headerSample.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-secondary/50">
                        {rawParsed.columns.map((_, ci) => (
                          <th key={ci} className="px-2 py-1.5 text-left font-bold text-muted-foreground">
                            Col {ci + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawParsed.headerSample.slice(0, 3).map((row, ri) => (
                        <tr key={ri} className="border-t border-border/50">
                          {rawParsed!.columns.map((_, ci) => (
                            <td
                              key={ci}
                              className={`px-2 py-1 font-mono truncate max-w-[80px] ${
                                ci === numberColIndex ? "text-primary font-bold bg-primary/5" : "text-foreground"
                              }`}
                            >
                              {row[ci] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Column selector */}
              <div className="space-y-1.5">
                {rawParsed?.columns.map((col, ci) => {
                  const sample = col.slice(0, 2).filter(Boolean).join(", ");
                  const looksLikeNumber = col.filter(v => v.replace(/[^\d+]/g, "").length >= 7).length > col.length * 0.3;
                  return (
                    <div
                      key={ci}
                      onClick={() => setNumberColIndex(ci)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                        numberColIndex === ci
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-secondary/50 border border-transparent hover:bg-secondary"
                      }`}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        numberColIndex === ci ? "border-primary" : "border-muted-foreground/30"
                      }`}>
                        {numberColIndex === ci && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-foreground">
                          Column {ci + 1}
                          {looksLikeNumber && <span className="text-[9px] text-primary ml-1.5 font-semibold">(looks like numbers)</span>}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate font-mono">{sample || "empty"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  if (!rawParsed) return;
                  const recs = buildRecipients(rawParsed, numberColIndex);
                  setRecipients(recs);
                  setColumnPickerOpen(false);
                  setRawParsed(null);
                  if (recs.length > 0) {
                    const varCount = recs[0].vars.length;
                    const varInfo = varCount > 0 ? ` with ${varCount} variable(s)` : "";
                    toast.success(`${recs.length} recipients loaded${varInfo}`);
                  } else {
                    toast.error("No valid numbers found in selected column");
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
              >
                Confirm Column {numberColIndex + 1} as Number
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Recipients</h3>
            </div>
            <div className="flex items-center gap-2">
              {recipients.length > 0 && (
                <button onClick={() => { setRecipients([]); setRawInput(""); }} className="text-[10px] font-semibold text-destructive hover:underline">Clear</button>
              )}
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors"
              >
                <Upload className="h-3 w-3" />
                CSV
              </button>
            </div>
          </div>

          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <Variable className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Add variables after number with commas:<br />
              <span className="font-mono text-foreground">+91987654,John,Delhi</span><br />
              Use <span className="font-mono text-primary font-bold">{"{{1}}"}</span> <span className="font-mono text-primary font-bold">{"{{2}}"}</span> in message
            </p>
          </div>

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={"+919876543210,John,Delhi\n+918765432109,Rahul,Mumbai\n+917654321098"}
            rows={5}
            className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
            disabled={status === "running"}
          />

          <div className="flex items-center justify-between">
            <button
              onClick={handleTextParse}
              disabled={!rawInput.trim() || status === "running"}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              Parse
            </button>
            {recipients.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10">
                <FileText className="h-3 w-3 text-primary" />
                <span className="text-[11px] font-bold text-primary">
                  {recipients.length} recipients{maxVarCount > 0 ? ` · ${maxVarCount} var${maxVarCount > 1 ? "s" : ""}` : ""}
                </span>
                {devicesNeeded > onlineDevices.length && (
                  <span className="text-[10px] font-bold text-destructive ml-1">
                    (need {devicesNeeded} devices)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Message Builder */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Message Builder</h3>
            </div>
            {recipients.length > 0 && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  showPreview ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                }`}
              >
                <Eye className="h-3 w-3" />
                {showPreview ? "Editor" : "Preview"}
              </button>
            )}
          </div>

          {/* Variable chips - draggable */}
          {maxVarCount > 0 && !showPreview && (
            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Drag & drop or tap variables</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: maxVarCount }, (_, i) => {
                  const sampleVal = recipients[0]?.vars[i] ?? "...";
                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        setDraggedVar(i);
                        e.dataTransfer.setData("text/plain", `{{${i + 1}}}`);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={() => setDraggedVar(null)}
                      onClick={() => {
                        if (status === "running") return;
                        const ta = messageRef.current;
                        if (ta) {
                          const start = ta.selectionStart;
                          const end = ta.selectionEnd;
                          const varText = `{{${i + 1}}}`;
                          const newMsg = message.slice(0, start) + varText + message.slice(end);
                          setMessage(newMsg);
                          setTimeout(() => {
                            ta.focus();
                            ta.setSelectionRange(start + varText.length, start + varText.length);
                          }, 0);
                        } else {
                          setMessage(prev => prev + `{{${i + 1}}}`);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition-all select-none ${
                        draggedVar === i
                          ? "bg-primary text-primary-foreground scale-105 shadow-lg shadow-primary/25"
                          : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                      }`}
                    >
                      <GripVertical className="h-3 w-3 opacity-50" />
                      <span className="text-[11px] font-bold font-mono">{`{{${i + 1}}}`}</span>
                      <span className="text-[9px] opacity-70 font-medium">{sampleVal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick templates */}
          {maxVarCount > 0 && !showPreview && !message.trim() && (
            <div className="space-y-1.5">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Quick Templates
              </p>
              <div className="flex flex-col gap-1">
                {[
                  maxVarCount >= 2 ? `Hi {{1}}, greetings from {{2}}!` : `Hi {{1}}, we have an update for you!`,
                  maxVarCount >= 3 ? `Dear {{1}}, your {{3}} membership from {{2}} is confirmed.` : maxVarCount >= 2 ? `Dear {{1}}, your order from {{2}} is ready.` : `Hello {{1}}, your order is ready!`,
                  maxVarCount >= 2 ? `{{1}}, special offer from {{2}} just for you!` : `{{1}}, special offer just for you!`,
                ].map((tpl, ti) => (
                  <button
                    key={ti}
                    onClick={() => setMessage(tpl)}
                    className="text-left px-3 py-2 rounded-xl bg-secondary/50 border border-transparent hover:border-primary/20 hover:bg-secondary text-[11px] text-muted-foreground font-mono transition-all"
                    disabled={status === "running"}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message textarea with drop zone */}
          {!showPreview ? (
            <div
              className={`relative rounded-xl border-2 border-dashed transition-colors ${
                draggedVar !== null ? "border-primary bg-primary/5" : "border-transparent"
              }`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => {
                e.preventDefault();
                const varText = e.dataTransfer.getData("text/plain");
                if (varText && messageRef.current) {
                  const ta = messageRef.current;
                  const rect = ta.getBoundingClientRect();
                  ta.focus();
                  const start = ta.selectionStart;
                  const newMsg = message.slice(0, start) + varText + message.slice(start);
                  setMessage(newMsg);
                }
                setDraggedVar(null);
              }}
            >
              {draggedVar !== null && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="bg-primary/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-primary/30">
                    <p className="text-[11px] font-bold text-primary">Drop variable here</p>
                  </div>
                </div>
              )}
              <textarea
                ref={messageRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={maxVarCount > 0 ? "Type message or drag variables here..." : "Type your message here..."}
                rows={4}
                className="w-full rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                disabled={status === "running"}
              />
            </div>
          ) : (
            /* Live preview */
            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Preview — First 3 recipients</p>
              {recipients.slice(0, 3).map((r, ri) => {
                const resolved = resolveMessage(message, r.vars);
                return (
                  <div key={ri} className="rounded-xl bg-secondary/50 border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary font-mono">{r.number}</span>
                      <span className="text-[9px] text-muted-foreground">{resolved.length} chars</span>
                    </div>
                    <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{resolved || <span className="text-muted-foreground italic">Empty message</span>}</p>
                  </div>
                );
              })}
              {recipients.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-[11px] text-muted-foreground">Parse recipients first to see preview</p>
                </div>
              )}
            </div>
          )}

          {/* Char count & SIM */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-mono">{message.length} chars</span>
              {message.length > 160 && (
                <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  {Math.ceil(message.length / 153)} SMS parts
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">SIM:</span>
              {["0", "1"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSim(s as "0" | "1")}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    sim === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                  disabled={status === "running"}
                >
                  SIM {parseInt(s) + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Send button */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (recipients.length === 0) { toast.error("Add recipients first"); return; }
              if (!message.trim()) { toast.error("Write a message first"); return; }
              if (onlineDevices.length === 0) { toast.error("No online devices available"); return; }
              startSending();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold shadow-lg active:scale-[0.98] transition-all bg-primary text-primary-foreground shadow-primary/25 hover:shadow-primary/40"
          >
            <Send className="h-4 w-4" />
            Start Bulk Send ({recipients.length} SMS)
          </button>
        </div>

        {/* Warning */}
        {recipients.length > 0 && devicesNeeded > onlineDevices.length && status === "idle" && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-600 dark:text-amber-400">
              <span className="font-bold">Not enough devices.</span> You need {devicesNeeded} online devices but only have {onlineDevices.length}. Only {onlineDevices.length * PER_DEVICE} of {recipients.length} SMS will be sent.
            </div>
          </div>
        )}
      </div>

      {/* FULLSCREEN SENDING OVERLAY */}
      {(status === "running" || status === "done") && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div className="shrink-0 border-b border-border px-5 pt-4 pb-3">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <div className="flex items-center gap-3">
                {status === "running" ? (
                  <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-2xl bg-green-500/15 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-extrabold text-foreground tracking-tight">
                    {status === "running" ? "Sending..." : "Complete"}
                  </h1>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {sent} of {total} messages processed
                  </p>
                </div>
              </div>
              {status === "running" ? (
                <button
                  onClick={stopSending}
                  className="px-3.5 py-2 rounded-xl bg-destructive text-destructive-foreground text-[11px] font-bold active:scale-95 transition-all"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => { setStatus("idle"); setLog([]); setSent(0); setTotal(0); }}
                  className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold active:scale-95 transition-all"
                >
                  Done
                </button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="shrink-0 px-5 py-3 border-b border-border">
            <div className="max-w-2xl mx-auto space-y-2.5">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-[11px] font-bold text-green-500">{okCount} sent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-[11px] font-bold text-destructive">{failCount} failed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground">{total - sent} remaining</span>
                </div>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Currently sending */}
          {currentSendInfo && status === "running" && (
            <div className="shrink-0 px-5 py-3 border-b border-primary/20 bg-primary/5">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  <span className="text-[9px] text-primary font-bold uppercase tracking-wider">Sending Now</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">#{currentSendInfo.index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-foreground font-mono">{currentSendInfo.number}</span>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Smartphone className="h-3 w-3 text-primary" />
                    {currentSendInfo.device}
                  </span>
                </div>
                {currentSendInfo.vars.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {currentSendInfo.vars.map((v, vi) => (
                      <span key={vi} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {`{{${vi + 1}}}`}={v}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border">
                  <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">{currentSendInfo.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Live log */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="max-w-2xl mx-auto space-y-1.5">
              {log.length === 0 && status === "running" && (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
                  <p className="text-xs text-muted-foreground">Starting bulk send...</p>
                </div>
              )}
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition-all ${
                    entry.status === "ok"
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-destructive/5 border-destructive/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {entry.status === "ok" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className="text-[11px] font-bold text-foreground font-mono">{entry.number}</span>
                    <span className="text-[9px] text-muted-foreground">→</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Smartphone className="h-2.5 w-2.5" />
                      {entry.device}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      #{i + 1}
                    </span>
                  </div>
                  {entry.vars && entry.vars.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 ml-5 flex-wrap">
                      {entry.vars.map((v, vi) => (
                        <span key={vi} className="text-[8px] font-mono px-1 py-0.5 rounded bg-secondary text-muted-foreground">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.message && (
                    <p className="text-[10px] text-muted-foreground mt-1 ml-5 truncate">{entry.message}</p>
                  )}
                  {entry.error && (
                    <p className="text-[10px] text-destructive mt-1 ml-5">{entry.error}</p>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Done summary */}
          {status === "done" && (
            <div className="shrink-0 px-5 py-4 border-t border-border">
              <div className="max-w-2xl mx-auto flex items-center gap-4">
                <div className="flex-1 flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-black text-green-500">{okCount}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold">Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-destructive">{failCount}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-foreground">{total}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold">Total</p>
                  </div>
                </div>
                <button
                  onClick={() => { setStatus("idle"); setLog([]); setSent(0); setTotal(0); }}
                  className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/25 active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkSmsPage;
