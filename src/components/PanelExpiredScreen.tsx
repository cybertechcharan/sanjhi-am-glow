import { Shield, Lock, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

interface PanelExpiredScreenProps {
  adminName: string;
  expiryDate: string;
}

const PanelExpiredScreen = ({ adminName, expiryDate }: PanelExpiredScreenProps) => {
  const formattedDate = expiryDate
    ? new Date(expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "N/A";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-destructive/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-primary/6 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 mx-5 w-full max-w-sm"
      >
        <div className="rounded-3xl border border-destructive/20 bg-card/60 backdrop-blur-2xl overflow-hidden">
          {/* Top accent line */}
          <div className="h-1 bg-gradient-to-r from-destructive/60 via-destructive to-destructive/60" />

          <div className="flex flex-col items-center gap-5 py-10 px-6">
            {/* Lock icon */}
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <Lock className="h-10 w-10 text-destructive" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                <Shield className="h-3 w-3 text-destructive-foreground" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-xl font-black text-foreground tracking-tight">Panel Expired</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hey <span className="font-bold text-foreground">{adminName}</span>, your panel license expired on{" "}
                <span className="font-bold text-destructive">{formattedDate}</span>.
              </p>
            </div>

            {/* Info box */}
            <div className="w-full rounded-2xl border border-border/60 bg-secondary/30 p-4 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">To Renew</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contact the developer on Telegram to renew your panel subscription and regain full access.
              </p>
            </div>

            {/* CTA */}
            <a
              href="https://t.me/xylohu"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-[0_0_25px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.35)] hover:scale-[1.02] active:scale-[0.97] transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Message @xylohu on Telegram
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PanelExpiredScreen;
