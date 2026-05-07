import { motion } from "framer-motion";
import { Shield, Users, Zap, Globe, Code, Rocket, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePanelName } from "@/hooks/useCustomization";

const AboutPage = () => {
  const navigate = useNavigate();
  const panelName = usePanelName();

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  const stats = [
    { value: "50+", label: "Developers" },
    { value: "10K+", label: "Users" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Support" },
  ];

  const values = [
    { icon: Zap, title: "Speed First", desc: "We move fast and ship faster. Every feature is optimized for real-time performance." },
    { icon: Shield, title: "Bulletproof Security", desc: "Military-grade encryption and zero-knowledge architecture protect every operation." },
    { icon: Globe, title: "Global Reach", desc: "Our infrastructure spans across continents for seamless worldwide access." },
    { icon: Code, title: "Built Different", desc: "We don't follow trends — we set them. Custom-engineered from the ground up." },
  ];

  return (
    <div className="min-h-screen pb-24 relative bg-background">
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[120px] z-0 pointer-events-none" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/60 backdrop-blur-2xl">
          <div className="flex h-14 items-center gap-3 px-5 max-w-5xl mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-xl bg-secondary/60 flex items-center justify-center hover:bg-primary/20 transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground">About</span>
          </div>
        </header>

        <motion.main
          className="px-5 py-6 space-y-6 max-w-5xl mx-auto"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Hero */}
          <motion.div variants={item} className="relative rounded-3xl border border-primary/15 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background/80 to-accent/5" />
            <div className="absolute top-[-40px] right-[-40px] w-48 h-48 bg-primary/15 rounded-full blur-[80px]" />

            <div className="relative px-6 pt-10 pb-8 flex flex-col items-center text-center gap-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center">
                  <Users className="h-10 w-10 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                </div>
              </motion.div>

              <div className="space-y-2">
                <h1 className="text-3xl font-black text-foreground tracking-tight">
                  Who We Are
                </h1>
                <p className="text-xs font-semibold text-primary uppercase tracking-[0.25em]">
                  The {panelName} Team
                </p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                We are the <span className="text-foreground font-bold">biggest and craziest</span> team of developers on Telegram. 
                We build what others only dream of — raw, powerful, and unapologetically advanced panels that push every boundary.
              </p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={item} className="grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-3 text-center">
                <p className="text-xl font-black text-primary tracking-tight">{s.value}</p>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Mission */}
          <motion.div variants={item} className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Rocket className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Our Mission</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We don't just build software — we engineer <span className="text-foreground font-semibold">weapons-grade tools</span> for 
              those who demand the absolute best. Our team lives and breathes Telegram development, 
              creating panels that are <span className="text-foreground font-semibold">faster, smarter, and more powerful</span> than anything else out there. 
              No compromises. No shortcuts. Just pure, unmatched engineering.
            </p>
          </motion.div>

          {/* Values */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">What Drives Us</h2>
              <div className="h-px flex-1 ml-3 bg-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {values.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 flex flex-col gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <v.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">{v.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{v.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div variants={item} className="rounded-3xl border border-primary/20 bg-card/30 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.08] to-transparent" />
            <div className="relative flex flex-col items-center gap-4 py-8 px-6 text-center">
              <p className="text-sm text-muted-foreground">Want to join the craziest dev team on Telegram?</p>
              <a
                href="https://t.me/xylohu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-[0_0_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)] hover:scale-[1.02] active:scale-[0.97] transition-all"
              >
                💬 Hit us up @xylohu
              </a>
            </div>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
};

export default AboutPage;
