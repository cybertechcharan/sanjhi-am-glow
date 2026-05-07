import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FOX_IMG = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSS9G9afOSbP4z8HJfGhhufxsn9oqJRX8YCw&s";

interface FoxDevModalProps {
  open: boolean;
  onClose: () => void;
}

const FoxDevModal = ({ open, onClose }: FoxDevModalProps) => {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (!open) {
      setScene(0);
      return;
    }
    const t1 = setTimeout(() => setScene(1), 2000);
    const t2 = setTimeout(() => setScene(2), 4500);
    const t3 = setTimeout(() => setScene(3), 7500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Close button */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-5 right-5 z-30 h-10 w-10 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center active:scale-90"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </motion.button>

        {/* Theme-aware bg */}
        <div className="absolute inset-0 bg-background" />

        {/* Ambient glow */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none bg-primary/10"
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${i % 3 === 0 ? "bg-primary" : i % 3 === 1 ? "bg-primary/70" : "bg-foreground/30"}`}
            style={{
              width: 3 + (i % 4) * 2,
              height: 3 + (i % 4) * 2,
              left: `${10 + (i * 7) % 80}%`,
              top: `${10 + (i * 13) % 80}%`,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, (i % 2 === 0 ? 20 : -20), 0],
              opacity: [0, 0.6, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3 + (i % 3),
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Rotating rings */}
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={ring}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none border border-primary/10"
            style={{
              width: 180 + ring * 90,
              height: 180 + ring * 90,
            }}
            animate={{
              rotate: ring % 2 === 0 ? 360 : -360,
              scale: [1, 1.06, 1],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{
              rotate: { duration: 10 + ring * 5, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: ring * 0.5 },
              opacity: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: ring * 0.5 },
            }}
          />
        ))}

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6" onClick={(e) => e.stopPropagation()}>

          <AnimatePresence mode="wait">
            {/* ── SCENE 0: Fox Reveal ── */}
            {scene === 0 && (
              <motion.div
                key="scene0"
                className="flex flex-col items-center gap-6"
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.4 } }}
              >
                <motion.div className="relative">
                  <motion.div
                    className="absolute inset-[-30px] rounded-full bg-primary/20"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.img
                    src={FOX_IMG}
                    alt="Fox"
                    className="relative h-36 w-36 rounded-full object-cover shadow-2xl shadow-primary/30 border-4 border-primary/50"
                    initial={{ scale: 0, rotate: -360 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 80, damping: 12 }}
                  />
                </motion.div>

                {[0, 1, 2].map((r) => (
                  <motion.div
                    key={r}
                    className="absolute rounded-full border-2 border-primary/20 pointer-events-none"
                    style={{ width: 180 + r * 60, height: 180 + r * 60 }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0.8, 1.3], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: r * 0.5, ease: "easeOut" }}
                  />
                ))}

                <motion.p
                  className="text-[10px] font-bold text-primary/60 uppercase tracking-[0.4em]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  Presenting
                </motion.p>
              </motion.div>
            )}

            {/* ── SCENE 1: FOX DEV Text ── */}
            {scene === 1 && (
              <motion.div
                key="scene1"
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -40, transition: { duration: 0.4 } }}
              >
                <motion.img
                  src={FOX_IMG}
                  alt="Fox"
                  className="h-20 w-20 rounded-full object-cover shadow-xl border-[3px] border-primary/40"
                  initial={{ scale: 0, y: 40 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                />

                <div className="flex gap-2">
                  {"FOX".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      className="text-7xl font-black text-primary drop-shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
                      initial={{ y: 80, opacity: 0, rotate: 20 }}
                      animate={{ y: [0, -6, 0], opacity: 1, rotate: 0 }}
                      transition={{
                        y: { duration: 1.5, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" },
                        opacity: { delay: i * 0.08, duration: 0.3 },
                        rotate: { delay: i * 0.08, type: "spring", stiffness: 150, damping: 10 },
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>

                <div className="flex gap-2">
                  {"DEV".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      className="text-7xl font-black text-foreground drop-shadow-[0_0_30px_hsl(var(--foreground)/0.15)]"
                      initial={{ y: 80, opacity: 0, rotate: -15 }}
                      animate={{ y: [0, -6, 0], opacity: 1, rotate: 0 }}
                      transition={{
                        y: { duration: 1.5, repeat: Infinity, delay: 0.3 + i * 0.15, ease: "easeInOut" },
                        opacity: { delay: 0.2 + i * 0.08, duration: 0.3 },
                        rotate: { delay: 0.2 + i * 0.08, type: "spring", stiffness: 150, damping: 10 },
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>

                <motion.div
                  className="h-1 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: 200 }}
                  transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                />
              </motion.div>
            )}

            {/* ── SCENE 2: NON ENDING LEGACY ── */}
            {scene === 2 && (
              <motion.div
                key="scene2"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.2, transition: { duration: 0.4 } }}
              >
                <div className="flex gap-1 flex-wrap justify-center">
                  {"NON ENDING".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      className="text-4xl font-black text-primary uppercase drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
                      initial={{ scale: 3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, y: [0, -4, 0] }}
                      transition={{
                        scale: { delay: i * 0.04, type: "spring", stiffness: 180, damping: 12 },
                        opacity: { delay: i * 0.04, duration: 0.2 },
                        y: { duration: 2, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" },
                      }}
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </div>

                <motion.div
                  className="w-4 h-4 bg-primary rotate-45 shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ scale: { duration: 1.5, repeat: Infinity }, delay: 0.5 }}
                />

                <div className="flex gap-3">
                  {"LEGACY".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      className="text-6xl font-black text-foreground drop-shadow-[0_0_20px_hsl(var(--foreground)/0.2)]"
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: [0, -6, 0], opacity: 1 }}
                      transition={{
                        y: { duration: 2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" },
                        opacity: { delay: 0.4 + i * 0.06, duration: 0.3 },
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>

                <motion.div
                  className="overflow-hidden w-[300px] mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 1 }}
                >
                  <motion.p
                    className="text-xs font-bold text-primary whitespace-nowrap"
                    animate={{ x: ["100%", "-100%"] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  >
                    ✦ NON ENDING LEGACY ✦ NON ENDING LEGACY ✦ NON ENDING LEGACY ✦ NON ENDING LEGACY ✦
                  </motion.p>
                </motion.div>
              </motion.div>
            )}

            {/* ── SCENE 3: NOT READY FOR THIS ── */}
            {scene === 3 && (
              <motion.div
                key="scene3"
                className="flex flex-col items-center gap-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.img
                  src={FOX_IMG}
                  alt="Fox"
                  className="h-16 w-16 rounded-full object-cover border-2 border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 150, damping: 12 }}
                />

                <motion.p
                  className="text-lg font-bold tracking-[0.4em] text-muted-foreground uppercase"
                  initial={{ opacity: 0, letterSpacing: "2em" }}
                  animate={{ opacity: 1, letterSpacing: "0.4em" }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                >
                  YOU ARE
                </motion.p>

                <div className="flex gap-1 flex-wrap justify-center">
                  {"NOT READY".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      className={`text-5xl font-black ${i < 3 ? "text-destructive drop-shadow-[0_0_40px_hsl(var(--destructive)/0.6)]" : "text-foreground drop-shadow-[0_0_20px_hsl(var(--foreground)/0.15)]"}`}
                      initial={{ scale: 3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.4 + i * 0.05,
                        type: "spring",
                        stiffness: 200,
                        damping: 8,
                      }}
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </div>

                <motion.div
                  className="absolute rounded-full border-2 border-primary/30 pointer-events-none"
                  style={{ width: 250, height: 250 }}
                  initial={{ scale: 0.5, opacity: 0.6 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                />

                <motion.p
                  className="text-2xl font-bold tracking-[0.3em] text-primary drop-shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1, type: "spring", stiffness: 150, damping: 12 }}
                >
                  FOR THIS
                </motion.p>

                <motion.span
                  className="text-5xl"
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                  transition={{
                    scale: { delay: 1.3, duration: 1.5, repeat: Infinity, ease: "easeInOut" },
                    rotate: { delay: 1.3, duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }}
                >
                  🦊
                </motion.span>

                <motion.div
                  className="flex flex-col items-center gap-1 mt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8, duration: 0.5 }}
                >
                  <p className="text-sm font-black text-primary">FOX DEV</p>
                  <div className="w-16 h-px bg-primary/30" />
                  <p className="text-[9px] text-muted-foreground font-semibold tracking-[0.3em] uppercase">
                    Non Ending Legacy · 2025
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Close hint */}
        <motion.p
          className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-[0.3em] z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Tap anywhere to close
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

export default FoxDevModal;
