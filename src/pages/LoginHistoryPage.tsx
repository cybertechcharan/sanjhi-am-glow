import { useEffect, useState } from "react";
import { ref, onValue } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { ArrowLeft, Globe, Monitor, Clock, X, MapPin, Building2, Wifi, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface LoginEntry {
  id: string;
  ip: string;
  hostname: string;
  userAgent: string;
  loginAt: string;
}

interface IpDetails {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
}

const LoginHistoryPage = () => {
  const [history, setHistory] = useState<LoginEntry[] | null>(null);
  const [ipDetails, setIpDetails] = useState<IpDetails | null>(null);
  const [loadingIp, setLoadingIp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onValue(ref(db, "login_history"), (snap) => {
      const data = snap.val();
      if (!data) { setHistory([]); return; }
      const entries = Object.entries(data).map(([id, val]: any) => ({
        id,
        ip: val.ip || "Unknown",
        hostname: val.hostname || "Unknown",
        userAgent: val.userAgent || "Unknown",
        loginAt: val.loginAt || "",
      }));
      entries.sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());
      setHistory(entries);
    });
    return () => unsub();
  }, []);

  const getBrowserName = (ua: string) => {
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    return "Unknown";
  };

  const getDeviceType = (ua: string) => {
    if (/Android|iPhone|iPad|Mobile/i.test(ua)) return "Mobile";
    return "Desktop";
  };

  const handleIpClick = async (ip: string) => {
    if (ip === "Unknown") return;
    setLoadingIp(true);
    setIpDetails(null);
    try {
      const res = await fetch(`https://ipinfo.io/${ip}/json?token=`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIpDetails({
        ip: data.ip || ip,
        city: data.city || "Unknown",
        region: data.region || "Unknown",
        country: data.country || "Unknown",
        loc: data.loc || "",
        org: data.org || "Unknown",
        postal: data.postal || "",
        timezone: data.timezone || "",
      });
    } catch {
      // Fallback to ip-api.com
      try {
        const res2 = await fetch(`http://ip-api.com/json/${ip}`);
        const data2 = await res2.json();
        if (data2.status === "success") {
          setIpDetails({
            ip: data2.query || ip,
            city: data2.city || "Unknown",
            region: data2.regionName || "Unknown",
            country: data2.country || "Unknown",
            loc: `${data2.lat},${data2.lon}`,
            org: data2.isp || "Unknown",
            postal: data2.zip || "",
            timezone: data2.timezone || "",
          });
        } else {
          toast.error("Could not fetch IP details");
        }
      } catch {
        toast.error("Could not fetch IP details");
      }
    } finally {
      setLoadingIp(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-base font-bold text-foreground">Login History</h1>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {/* Loading state with progress bar */}
        {history === null && (
          <div className="py-10 space-y-4">
            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-progress" />
            </div>
            <p className="text-center text-muted-foreground text-sm">Loading login history...</p>
            <style>{`
              @keyframes progress {
                0% { width: 0%; margin-left: 0%; }
                50% { width: 60%; margin-left: 20%; }
                100% { width: 0%; margin-left: 100%; }
              }
              .animate-progress {
                animation: progress 1.5s ease-in-out infinite;
              }
            `}</style>
          </div>
        )}

        {history !== null && history.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">No login history yet</p>
        )}

        {history?.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-border bg-card/80 p-4 space-y-2 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99]"
            onClick={() => handleIpClick(entry.ip)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{entry.ip}</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {getDeviceType(entry.userAgent)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Monitor className="h-3 w-3" />
              <span>{getBrowserName(entry.userAgent)} • {entry.hostname}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{new Date(entry.loginAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* IP Details Modal */}
      {(loadingIp || ipDetails) && (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 px-5"
          onClick={() => { setIpDetails(null); setLoadingIp(false); }}
        >
          <div
            className="w-full max-w-sm bg-card border border-primary/20 rounded-2xl p-5 space-y-4 animate-in zoom-in-95 duration-300 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingIp ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Looking up IP details...</p>
              </div>
            ) : ipDetails && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-foreground text-sm">IP Details</h3>
                  </div>
                  <button
                    onClick={() => setIpDetails(null)}
                    className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-3">
                  <DetailRow icon={Wifi} label="IP Address" value={ipDetails.ip} />
                  <DetailRow icon={MapPin} label="City" value={ipDetails.city} />
                  <DetailRow icon={MapPin} label="Region" value={ipDetails.region} />
                  <DetailRow icon={Globe} label="Country" value={ipDetails.country} />
                  <DetailRow icon={Building2} label="ISP / Org" value={ipDetails.org} />
                  {ipDetails.postal && <DetailRow icon={MapPin} label="Postal" value={ipDetails.postal} />}
                  {ipDetails.timezone && <DetailRow icon={Clock} label="Timezone" value={ipDetails.timezone} />}
                  {ipDetails.loc && <DetailRow icon={MapPin} label="Coordinates" value={ipDetails.loc} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-secondary/50">
    <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground break-all">{value}</p>
    </div>
  </div>
);

export default LoginHistoryPage;
