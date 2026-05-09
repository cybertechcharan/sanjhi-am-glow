import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  Users,
  HardDrive,
  Building2,
  Plus,
  Loader2,
  RefreshCw,
  KeyRound,
  Smartphone,
  Trash2,
  CheckCircle2,
  XCircle,
  LogOut,
  Lock,
  Mail,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";

interface Tenant {
  id: string;
  email: string;
  role: "admin" | "superadmin";
  tenantId: string;
  totp_enrolled: boolean;
  last_login_at: string | null;
  last_login_ip: string;
  disabled: boolean;
  locked: boolean;
  created_at: string;
  devices: number;
}

interface Stats {
  admins: number;
  devices: number;
  tenants: number;
}

interface Props {
  onLogout: () => Promise<void>;
}

const AdminPanelPage = ({ onLogout }: Props) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [tres, sres] = await Promise.all([
        apiFetch<{ ok: true; tenants: Tenant[] }>("/api/admin/tenants"),
        apiFetch<{ ok: true } & Stats>("/api/admin/stats"),
      ]);
      setTenants(tres.tenants);
      setStats({ admins: sres.admins, devices: sres.devices, tenants: sres.tenants });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!createEmail || !createPassword) {
      toast.error("Email and password required");
      return;
    }
    if (createPassword.length < 8) {
      toast.error("Password must be 8+ characters");
      return;
    }
    setBusyId("__create__");
    try {
      await apiFetch("/api/admin/tenants", {
        method: "POST",
        body: { email: createEmail.trim().toLowerCase(), password: createPassword },
      });
      toast.success("Tenant created");
      setCreateEmail("");
      setCreatePassword("");
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
    setBusyId(null);
  };

  const handleToggleDisabled = async (t: Tenant) => {
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/tenants/${t.id}/disabled`, {
        method: "POST",
        body: { disabled: !t.disabled },
      });
      toast.success(t.disabled ? "Tenant enabled" : "Tenant disabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
    setBusyId(null);
  };

  const handleResetPassword = async (t: Tenant) => {
    const newPassword = prompt(`New password for ${t.email} (min 8 chars):`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast.error("Password must be 8+ characters");
      return;
    }
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/tenants/${t.id}/reset-password`, {
        method: "POST",
        body: { newPassword },
      });
      toast.success("Password reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
    setBusyId(null);
  };

  const handleResetTotp = async (t: Tenant) => {
    if (!confirm(`Reset 2FA for ${t.email}? They'll need to re-enroll.`)) return;
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/tenants/${t.id}/reset-totp`, { method: "POST" });
      toast.success("2FA reset");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
    setBusyId(null);
  };

  const handleDelete = async (t: Tenant) => {
    if (t.role === "superadmin") {
      toast.error("Cannot delete superadmin");
      return;
    }
    if (!confirm(`Delete tenant ${t.email} and ALL their data? This cannot be undone.`)) return;
    setBusyId(t.id);
    try {
      await apiFetch(`/api/admin/tenants/${t.id}`, { method: "DELETE" });
      toast.success("Tenant deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
    setBusyId(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-xl">
        <div className="px-6 py-4 max-w-6xl mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold tracking-tight">Cyber Panel — Admin</h1>
            <p className="text-[11px] text-neutral-500">Tenant & security management</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={refreshing}
            className="h-9 w-9 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-neutral-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => void onLogout()}
            className="h-9 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Users} label="Tenants" value={stats?.tenants ?? "—"} accent="from-blue-500 to-cyan-500" />
          <StatCard icon={Building2} label="Admins" value={stats?.admins ?? "—"} accent="from-violet-500 to-pink-500" />
          <StatCard icon={HardDrive} label="Devices" value={stats?.devices ?? "—"} accent="from-emerald-500 to-teal-500" />
        </div>

        {/* Create tenant */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Tenants</h2>
              <p className="text-[11px] text-neutral-500">Each tenant has its own isolated data tree.</p>
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="h-9 px-3 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> {showCreate ? "Cancel" : "New tenant"}
            </button>
          </div>

          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-3 pt-1"
            >
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-900">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="email@tenant.com"
                  className="w-full bg-transparent rounded-xl pl-10 pr-3 py-2.5 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                />
              </div>
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-900">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Initial password (min 8 chars)"
                  className="w-full bg-transparent rounded-xl pl-10 pr-3 py-2.5 text-[13px] text-white placeholder:text-neutral-600 focus:outline-none"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={busyId === "__create__"}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busyId === "__create__" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Create tenant
              </button>
            </motion.div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-neutral-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {tenants.length === 0 && <p className="text-xs text-neutral-500 text-center py-8">No tenants</p>}
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    t.disabled ? "border-red-500/20 bg-red-500/5" : "border-neutral-800 bg-neutral-900/40"
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{t.email}</p>
                      {t.role === "superadmin" && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          superadmin
                        </span>
                      )}
                      {t.disabled && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                          disabled
                        </span>
                      )}
                      {t.locked && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          locked
                        </span>
                      )}
                      {t.totp_enrolled ? (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          2FA on
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-neutral-700/40 text-neutral-400 border border-neutral-700/50">
                          2FA pending
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 font-mono">{t.tenantId} · {t.devices} devices</p>
                    {t.last_login_at && (
                      <p className="text-[10px] text-neutral-600">
                        Last login: {new Date(t.last_login_at).toLocaleString()} from {t.last_login_ip || "?"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <IconButton title={t.disabled ? "Enable" : "Disable"} onClick={() => handleToggleDisabled(t)} busy={busyId === t.id}>
                      {t.disabled ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    </IconButton>
                    <IconButton title="Reset password" onClick={() => handleResetPassword(t)} busy={busyId === t.id}>
                      <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                    </IconButton>
                    <IconButton title="Reset 2FA" onClick={() => handleResetTotp(t)} busy={busyId === t.id}>
                      <Smartphone className="h-3.5 w-3.5 text-violet-400" />
                    </IconButton>
                    {t.role !== "superadmin" && (
                      <IconButton title="Delete" onClick={() => handleDelete(t)} busy={busyId === t.id}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </IconButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string | number; accent: string }) => (
  <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  </div>
);

const IconButton = ({ children, title, onClick, busy }: { children: React.ReactNode; title: string; onClick: () => void; busy: boolean }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={busy}
    className="h-8 w-8 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors flex items-center justify-center disabled:opacity-40"
  >
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" /> : children}
  </button>
);

export default AdminPanelPage;
