import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, MessageSquare, ScanSearch, FileText, Shield,
  Zap, Send, Bell, Palette, Globe, ChevronRight, X, Sparkles
} from "lucide-react";

interface FeatureSlide {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  gradient: string;
}

const SLIDES: FeatureSlide[] = [
  {
    icon: Sparkles,
    title: "Dark X Panel 3.0",
    subtitle: "By Fox Dev",
    color: "text-primary",
    gradient: "from-primary/30 via-accent/10 to-transparent",
  },
  {
    icon: Smartphone,
    title: "Device Management",
    subtitle: "Monitor battery, SIM, status & manage multiple devices with tab mode",
    color: "text-cyan",
    gradient: "from-cyan/30 via-cyan/10 to-transparent",
  },
  {
    icon: MessageSquare,
    title: "SMS Intelligence",
    subtitle: "Auto-classify credits, debits, OTPs & detect bank sources instantly",
    color: "text-green",
    gradient: "from-green/30 via-green/10 to-transparent",
  },
  {
    icon: ScanSearch,
    title: "Magic Scan",
    subtitle: "Scan all devices at once to find every credit transaction",
    color: "text-pink",
    gradient: "from-pink/30 via-pink/10 to-transparent",
  },
  {
    icon: FileText,
    title: "Form Capture",
    subtitle: "Collect & view submitted forms across all devices in real-time",
    color: "text-yellow",
    gradient: "from-yellow/30 via-yellow/10 to-transparent",
  },
  {
    icon: Send,
    title: "Send SMS & Calls",
    subtitle: "Send messages and make calls remotely from any connected device",
    color: "text-blue",
    gradient: "from-blue/30 via-blue/10 to-transparent",
  },
  {
    icon: Bell,
    title: "Telegram Alerts",
    subtitle: "Get instant notifications for new connections & messages via Telegram",
    color: "text-orange",
    gradient: "from-orange/30 via-orange/10 to-transparent",
  },
  {
    icon: Shield,
    title: "Security First",
    subtitle: "OTP verification, login history & password protection built in",
    color: "text-destructive",
    gradient: "from-destructive/30 via-destructive/10 to-transparent",
  },
  {
    icon: Palette,
    title: "Fully Customizable",
    subtitle: "Custom backgrounds, themes & personalize every detail",
    color: "text-accent",
    gradient: "from-accent/30 via-accent/10 to-transparent",
  },
  {
    icon: Zap,
    title: "Dark X Panel 3.0",
    subtitle: "By Fox Dev · You're all set!",
    color: "text-primary",
    gradient: "from-primary/30 via-accent/10 to-transparent",
  },
];

interface FeatureIntroProps {
  onClose: () => void;
}

const FeatureIntro = ({ onClose }: FeatureIntroProps) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const isLast = current === SLIDES.length - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onClose();
      return;
    }
    setDirection(1);
    setCurrent((c) => c + 1);
  }, [isLast, onClose]);

  const goPrev = useCallback(() => {
    if (current === 0) return;
    setDirection(-1);
    setCurrent((c) => c - 1);
  }, [current]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Auto-advance timer
  useEffect(() => {
    if (isLast) return;
    const timer = setTimeout(goNext, 5000);
    return () => clearTimeout(timer);
  }, [current, isLast, goNext]);

  const slide = SLIDES[current];
  const Icon = slide.icon;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8,
      rotateY: dir > 0 ? 25 : -25,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
      transition: { type: "spring" as const, stiffness: 200, damping: 25, mass: 0.8 },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
      scale: 0.8,
      rotateY: dir > 0 ? -25 : 25,
      transition: { duration: 0.3 },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Radial glow */}
        <motion.div
          key={`glow-${current}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial ${slide.gradient} blur-3xl`}
        />
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`particle-${current}-${i}`}
            initial={{ opacity: 0, y: 100 }}
            animate={{
              opacity: [0, 0.4, 0],
              y: [-20, -200],
              x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 15)],
            }}
            transition={{ duration: 3 + i * 0.5, delay: i * 0.3, repeat: Infinity }}
            className={`absolute bottom-1/4 left-1/2 w-1 h-1 rounded-full bg-primary`}
            style={{ left: `${30 + i * 8}%` }}
          />
        ))}
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* Skip button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary/50 backdrop-blur-sm border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
      >
        Skip <X className="h-3 w-3" />
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full max-w-lg px-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="relative mb-8"
            >
              <div className={`h-28 w-28 rounded-3xl bg-gradient-to-br ${slide.gradient} border border-border/50 flex items-center justify-center backdrop-blur-sm`}>
                <Icon className={`h-14 w-14 ${slide.color}`} />
              </div>
              {/* Ping ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                className={`absolute inset-0 rounded-3xl border-2 border-current ${slide.color} opacity-30`}
              />
            </motion.div>

            {/* Counter */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-3"
            >
              <span className="px-3 py-1 rounded-full bg-secondary/80 text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                {current + 1} / {SLIDES.length}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-4xl font-black text-foreground mb-3 tracking-tight"
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-sm"
            >
              {slide.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 w-full max-w-lg px-8 pb-10 space-y-5">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`rounded-full transition-all ${i === current ? `w-8 h-2 bg-primary` : "w-2 h-2 bg-secondary hover:bg-muted-foreground/30"}`}
              layoutId={undefined}
              animate={{ scale: i === current ? 1 : 0.85 }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {current > 0 && (
            <button
              onClick={goPrev}
              className="flex-1 py-3.5 rounded-2xl bg-secondary border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all active:scale-[0.98]"
            >
              Back
            </button>
          )}
          <button
            onClick={goNext}
            className={`flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              isLast
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isLast ? "Let's Go!" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Auto-advance progress bar */}
      {!isLast && (
        <motion.div
          key={`progress-${current}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 5, ease: "linear" }}
          className="absolute bottom-0 left-0 h-0.5 bg-primary origin-left w-full"
        />
      )}
    </motion.div>
  );
};

export default FeatureIntro;
