import { useState } from "react";
import { Shield, User, CalendarDays, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { savePanelConfig } from "@/hooks/usePanelConfig";
import { toast } from "sonner";

const PanelSetupScreen = () => {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Enter admin name"); return; }
    if (!date) { toast.error("Select expiry date"); return; }

    setSaving(true);
    try {
      const success = await savePanelConfig(name, date);
      if (success) {
        toast.success("Panel configured successfully!");
      } else {
        toast.error("Panel is already configured");
      }
    } catch {
      toast.error("Failed to save config");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-accent/6 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 mx-5 w-full max-w-sm"
      >
        <div className="rounded-3xl border border-primary/20 bg-card/60 backdrop-blur-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          <div className="flex flex-col items-center gap-6 py-10 px-6">
            {/* Icon */}
            <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="h-10 w-10 text-primary" />
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-xl font-black text-foreground tracking-tight">Panel Setup</h1>
              <p className="text-xs text-muted-foreground">One-time configuration. This cannot be changed later.</p>
            </div>

            {/* Name input */}
            <div className="w-full space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
                <User className="h-3 w-3" /> Admin Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Date input */}
            <div className="w-full space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Expiry Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-border/60 text-sm text-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Warning */}
            <div className="w-full rounded-xl border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-[10px] text-destructive font-semibold text-center">
                ⚠️ This is a one-time setup. You cannot change these values later.
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim() || !date}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-[0_0_25px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.35)] hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Configure Panel"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PanelSetupScreen;
