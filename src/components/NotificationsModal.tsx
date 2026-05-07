import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { ref, onValue, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { X, Bell, BellOff, Trash2, Search } from "lucide-react";

interface Notification {
  key: string;
  sender: string;
  body: string;
  date: string;
  timestamp: string;
  package: string;
  app_name: string;
}

/* ── App icon registry ── */
const APP_ICONS: Record<string, string> = {
  "org.telegram.messenger": "https://cdn.pixabay.com/photo/2021/12/27/10/50/telegram-6896827_1280.png",
  "com.whatsapp": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcQ4naynYCxMCkiiHk5lM4bEflkFKQcL7VVw&s",
  "com.whatsapp.w4b": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcQ4naynYCxMCkiiHk5lM4bEflkFKQcL7VVw&s",
  "com.application.zomato": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0ky9JC1A6RBkq5qZ4sXLX6CgF3SrZ9357AA&s",
  "com.google.android.youtube": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS75zORG4AgblTazNsr6KWPbfrsDAu9z_HdqA&s",
  "com.google.android.apps.youtube.music": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/960px-Youtube_Music_icon.svg.png",
  "com.google.android.apps.youtube.music.pwa": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/960px-Youtube_Music_icon.svg.png",
  "com.zeptoconsumerapp": "https://avatars.githubusercontent.com/u/84562117?s=280&v=4",
  "in.zepto.customer": "https://avatars.githubusercontent.com/u/84562117?s=280&v=4",
  "com.truecaller": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQycgDt3hs-bMXHAsCE8rwGECzCoXCbSWsVtw&s",
  "com.android.phone": "https://cdn-icons-png.flaticon.com/512/8748/8748459.png",
  "com.android.dialer": "https://cdn-icons-png.flaticon.com/512/8748/8748459.png",
  "com.samsung.android.dialer": "https://cdn-icons-png.flaticon.com/512/8748/8748459.png",
  "com.jio.myjio": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS37k_kIEfB9Qo2mfNWHDYHHdQi2z6Gpixx0w&s",
  "com.jio.myjio6": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS37k_kIEfB9Qo2mfNWHDYHHdQi2z6Gpixx0w&s",
  "com.google.android.gms": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN1HgAOQZBf48TI55AvzbnfV0IFrCCrX6ldg&s",
  "com.google.android.googlequicksearchbox": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN1HgAOQZBf48TI55AvzbnfV0IFrCCrX6ldg&s",
  "com.google.android.apps.messaging": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQN1HgAOQZBf48TI55AvzbnfV0IFrCCrX6ldg&s",
  "com.google.android.gm": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgzPFM4Zm-0MPP3fTHbbzASjcxdpEE_bHvjQ&s",
  "com.swiggyfood": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQ_OTkM0sbcKOBvrdx2vvvKei9QJxruSLkLA&s",
  "in.swiggy.android": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQ_OTkM0sbcKOBvrdx2vvvKei9QJxruSLkLA&s",
  "com.wallet.crypto.trustapp": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT54Ge3KZXN-cY1CSk6K4YoH-xLV0peXNnGVg&s",
  "com.binance.dev": "https://cdn-icons-png.flaticon.com/512/14446/14446125.png",
  "com.binance.android": "https://cdn-icons-png.flaticon.com/512/14446/14446125.png",
  "com.fampay.in": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxebypZqkcrFyzTjlNj3KLFeQwIP_5D4csbQ&s",
  "com.android.settings": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSmeI0RKMSbok6u_277eKrIdg4horWwnz_n2g&s",
  "com.samsung.android.app.settings": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSmeI0RKMSbok6u_277eKrIdg4horWwnz_n2g&s",
  "com.oyo.consumer": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRtK2Lx3Av9k8p3Tm1HjDoA_8-hoMHc5N-Ncg&s",
  "com.amazon.mShop.android.shopping": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQFbYR8_vZMujgZUWps_AsC8U1paH81zh6MoA&s",
  "in.amazon.mShop.android.shopping": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQFbYR8_vZMujgZUWps_AsC8U1paH81zh6MoA&s",
  "com.facebook.katana": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUcP0ZcWRME2hXax1sPPgNtutzs7H0ZQv2vw&s",
  "com.facebook.lite": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUcP0ZcWRME2hXax1sPPgNtutzs7H0ZQv2vw&s",
  "com.facebook.orca": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQUcP0ZcWRME2hXax1sPPgNtutzs7H0ZQv2vw&s",
  "com.instagram.android": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7_KeZGeUlZL_nvEr63QgrPxdbRTn8goCVvQ&s",
  "com.instagram.threads": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7_KeZGeUlZL_nvEr63QgrPxdbRTn8goCVvQ&s",
  "com.snapchat.android": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT24DZl9xnecXz45C-sT7OZBs0qfmJ0AJjsyw&s",
};

const getAppIcon = (pkg: string): string | null => {
  if (APP_ICONS[pkg]) return APP_ICONS[pkg];
  // fuzzy match
  const lower = pkg.toLowerCase();
  if (lower.includes("telegram")) return APP_ICONS["org.telegram.messenger"];
  if (lower.includes("whatsapp")) return APP_ICONS["com.whatsapp"];
  if (lower.includes("zomato")) return APP_ICONS["com.application.zomato"];
  if (lower.includes("youtube.music")) return APP_ICONS["com.google.android.apps.youtube.music"];
  if (lower.includes("youtube")) return APP_ICONS["com.google.android.youtube"];
  if (lower.includes("zepto")) return APP_ICONS["com.zeptoconsumerapp"];
  if (lower.includes("truecaller")) return APP_ICONS["com.truecaller"];
  if (lower.includes("dialer") || lower.includes("phone")) return APP_ICONS["com.android.phone"];
  if (lower.includes("jio")) return APP_ICONS["com.jio.myjio"];
  if (lower.includes("google") || lower.includes("gms")) return APP_ICONS["com.google.android.gms"];
  if (lower.includes("gmail") || lower === "com.google.android.gm") return APP_ICONS["com.google.android.gm"];
  if (lower.includes("swiggy")) return APP_ICONS["com.swiggyfood"];
  if (lower.includes("trust") && lower.includes("wallet")) return APP_ICONS["com.wallet.crypto.trustapp"];
  if (lower.includes("binance")) return APP_ICONS["com.binance.dev"];
  if (lower.includes("fampay")) return APP_ICONS["com.fampay.in"];
  if (lower.includes("settings")) return APP_ICONS["com.android.settings"];
  if (lower.includes("oyo")) return APP_ICONS["com.oyo.consumer"];
  if (lower.includes("amazon")) return APP_ICONS["com.amazon.mShop.android.shopping"];
  if (lower.includes("facebook") || lower.includes("fb")) return APP_ICONS["com.facebook.katana"];
  if (lower.includes("thread")) return APP_ICONS["com.instagram.threads"];
  if (lower.includes("instagram")) return APP_ICONS["com.instagram.android"];
  if (lower.includes("snapchat")) return APP_ICONS["com.snapchat.android"];
  if (lower.includes("snapchat")) return APP_ICONS["com.snapchat.android"];
  return null;
};

const getAppColor = (pkg: string): string => {
  const p = pkg.toLowerCase();
  if (p.includes("telegram")) return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  if (p.includes("whatsapp")) return "text-green-500 bg-green-500/10 border-green-500/20";
  if (p.includes("zomato")) return "text-red-400 bg-red-500/10 border-red-500/20";
  if (p.includes("youtube")) return "text-red-500 bg-red-500/10 border-red-500/20";
  if (p.includes("zepto")) return "text-purple-400 bg-purple-500/10 border-purple-500/20";
  if (p.includes("truecaller")) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  if (p.includes("phone") || p.includes("dialer")) return "text-green-400 bg-green-500/10 border-green-500/20";
  if (p.includes("jio")) return "text-blue-600 bg-blue-600/10 border-blue-600/20";
  if (p.includes("google") || p.includes("gms")) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  if (p.includes("gmail")) return "text-red-500 bg-red-500/10 border-red-500/20";
  if (p.includes("swiggy")) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  if (p.includes("trust") && p.includes("wallet")) return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  if (p.includes("binance")) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  if (p.includes("fampay")) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (p.includes("settings")) return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  if (p.includes("facebook") || p.includes("fb")) return "text-blue-600 bg-blue-600/10 border-blue-600/20";
  if (p.includes("instagram")) return "text-pink-500 bg-pink-500/10 border-pink-500/20";
  if (p.includes("thread")) return "text-gray-300 bg-gray-300/10 border-gray-300/20";
  if (p.includes("snapchat")) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (p.includes("oyo")) return "text-red-500 bg-red-500/10 border-red-500/20";
  return "text-primary bg-primary/10 border-primary/20";
};

interface NotificationsModalProps {
  deviceId: string;
  deviceName: string;
  onClose?: () => void;
  inline?: boolean;
}

/* ── Single notification card ── */
const NotifCard = memo(({ n, onDelete }: { n: Notification; onDelete?: () => void }) => {
  const icon = getAppIcon(n.package);
  const colorClass = getAppColor(n.package);

  return (
    <div className="group flex items-start gap-3 p-3 rounded-2xl bg-card border border-border/60 hover:border-border transition-all overflow-hidden">
      {/* Icon */}
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${icon ? "border-border/40 bg-card" : colorClass}`}>
        {icon ? (
          <img src={icon} alt={n.app_name} className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Row 1: sender + time */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-foreground truncate">{n.sender}</span>
          <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0 tabular-nums">
            {formatTime(n.timestamp)}
          </span>
        </div>

        {/* Row 2: app badge */}
        <span className={`mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${colorClass}`}>
          {n.app_name}
        </span>

        {/* Row 3: body */}
        {n.body && (
          <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed break-words whitespace-pre-wrap">{n.body}</p>
        )}
      </div>

      {/* Delete on hover (desktop) */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

/* ── Time formatter (show HH:mm only if today) ── */
const formatTime = (ts: string): string => {
  if (!ts) return "";
  // ts format: "yyyy-MM-dd HH:mm:ss"
  const parts = ts.split(" ");
  if (parts.length === 2) {
    const today = new Date().toISOString().slice(0, 10);
    if (parts[0] === today) return parts[1].slice(0, 5); // HH:mm
    return parts[0].slice(5) + " " + parts[1].slice(0, 5); // MM-dd HH:mm
  }
  return ts;
};

/* ── Empty state ── */
const EmptyNotif = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center px-6">
    <div className="h-16 w-16 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center mb-4">
      <BellOff className="h-7 w-7 text-muted-foreground/60" />
    </div>
    <p className="text-sm font-bold text-muted-foreground">No notifications yet</p>
    <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">
      Notifications from this device will appear here in real-time
    </p>
  </div>
);

/* ── Loading state ── */
const LoadingNotif = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    <p className="text-xs text-muted-foreground">Loading notifications…</p>
  </div>
);

/* ── App Story Bubble ── */
const AppStoryBubble = memo(({ pkg, appName, count, active, onClick }: { pkg: string; appName: string; count: number; active: boolean; onClick: () => void }) => {
  const icon = getAppIcon(pkg);
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 shrink-0 w-[60px]">
      <div className={`relative h-[52px] w-[52px] rounded-full p-[2.5px] transition-all ${active ? "bg-gradient-to-tr from-primary via-accent to-primary shadow-lg shadow-primary/30" : "bg-border/60"}`}>
        <div className="h-full w-full rounded-full bg-card flex items-center justify-center overflow-hidden">
          {icon ? (
            <img src={icon} alt={appName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1 border-2 border-card">
          {count}
        </span>
      </div>
      <span className={`text-[9px] font-semibold text-center leading-tight line-clamp-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
        {appName.length > 8 ? appName.slice(0, 7) + "…" : appName}
      </span>
    </button>
  );
});

/* ── Main component ── */
const NotificationsModal = ({ deviceId, deviceName, onClose, inline = false }: NotificationsModalProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeApp, setActiveApp] = useState<string | null>(null);

  useEffect(() => {
    const notifRef = ref(db, `notifications_user/${deviceId}`);
    const unsub = onValue(notifRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const entries: Notification[] = Object.entries(data).map(([key, val]: [string, any]) => ({
        key,
        sender: val.sender || "Unknown",
        body: val.body || "",
        date: val.date || "",
        timestamp: val.timestamp || "",
        package: val.package || "",
        app_name: val.app_name || "Unknown App",
      }));

      entries.sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const dbTime = new Date(b.date).getTime() || 0;
        return dbTime - da;
      });

      if (entries.length > 200) {
        entries.slice(200).forEach((n) => {
          remove(ref(db, `notifications_user/${deviceId}/${n.key}`));
        });
      }

      setNotifications(entries.slice(0, 200));
      setLoading(false);
    });

    return () => unsub();
  }, [deviceId]);

  /* Unique apps with counts, sorted by count desc */
  const uniqueApps = useMemo(() => {
    const map = new Map<string, { pkg: string; appName: string; count: number }>();
    notifications.forEach((n) => {
      const key = n.package || n.app_name;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, { pkg: n.package, appName: n.app_name, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [notifications]);

  const filtered = useMemo(() => {
    let list = notifications;
    if (activeApp) {
      list = list.filter(n => (n.package || n.app_name) === activeApp);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(n =>
      n.sender.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.app_name.toLowerCase().includes(q)
    );
  }, [notifications, search, activeApp]);

  const handleDelete = useCallback((key: string) => {
    remove(ref(db, `notifications_user/${deviceId}/${key}`));
  }, [deviceId]);

  const handleClearAll = useCallback(() => {
    remove(ref(db, `notifications_user/${deviceId}`));
  }, [deviceId]);

  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleAppClick = useCallback((pkg: string) => {
    setActiveApp(prev => prev === pkg ? null : pkg);
  }, []);

  const searchBar = notifications.length > 3 ? (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
      <input
        type="text"
        value={search}
        onChange={onSearchChange}
        placeholder="Search notifications..."
        className="w-full h-9 pl-9 pr-3 rounded-xl bg-secondary/50 border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
      />
    </div>
  ) : null;

  const storiesBar = uniqueApps.length > 1 ? (
    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* All button */}
      <button onClick={() => setActiveApp(null)} className="flex flex-col items-center gap-1 shrink-0 w-[60px]">
        <div className={`relative h-[52px] w-[52px] rounded-full p-[2.5px] transition-all ${!activeApp ? "bg-gradient-to-tr from-primary via-accent to-primary shadow-lg shadow-primary/30" : "bg-border/60"}`}>
          <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1 border-2 border-card">
            {notifications.length}
          </span>
        </div>
        <span className={`text-[9px] font-semibold ${!activeApp ? "text-primary" : "text-muted-foreground"}`}>All</span>
      </button>
      {uniqueApps.map((app) => (
        <AppStoryBubble
          key={app.pkg || app.appName}
          pkg={app.pkg}
          appName={app.appName}
          count={app.count}
          active={activeApp === (app.pkg || app.appName)}
          onClick={() => handleAppClick(app.pkg || app.appName)}
        />
      ))}
    </div>
  ) : null;

  /* Inline mode (used inside tabs) */
  if (inline) {
    return (
      <div className="space-y-2">
        {storiesBar}
        {searchBar}
        {loading ? <LoadingNotif /> : filtered.length === 0 ? <EmptyNotif /> : (
          filtered.map((n) => (
            <NotifCard key={n.key} n={n} onDelete={() => handleDelete(n.key)} />
          ))
        )}
      </div>
    );
  }

  /* Fullscreen modal */
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col lg:items-center lg:justify-center lg:bg-black/70 lg:backdrop-blur-sm">
      <div className="w-full h-full max-w-full lg:w-[640px] lg:max-h-[85vh] lg:rounded-2xl lg:border lg:border-border bg-background flex flex-col overflow-hidden lg:shadow-2xl lg:shadow-primary/10">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-border/50 bg-card/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-foreground tracking-tight">Notifications</h2>
              <p className="text-[10px] text-muted-foreground/70 font-medium truncate">
                {deviceName} · {notifications.length} items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="h-8 px-2.5 rounded-lg text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-secondary/80 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* App stories filter */}
        {storiesBar && (
          <div className="shrink-0 px-3 pt-2.5 pb-1 border-b border-border/30">
            {storiesBar}
          </div>
        )}

        {/* Search */}
        {searchBar && (
          <div className="shrink-0 px-3 pt-2">
            {searchBar}
          </div>
        )}

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="p-3 space-y-2">
            {loading ? <LoadingNotif /> : filtered.length === 0 ? <EmptyNotif /> : (
              filtered.map((n) => (
                <NotifCard key={n.key} n={n} onDelete={() => handleDelete(n.key)} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
