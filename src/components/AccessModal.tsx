import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Ticket, Loader2, ChevronRight, Shield, Crown, Calendar, Send, AlertTriangle, Users, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ref, get, set } from "@/lib/rtdbPb";
import { db } from "@/lib/firebase";

const BEP20_ADDRESS = "0x7a00B4E64103027BC0617102C0791EE1f475eFb";

const ACCESS_PLANS = [
  {
    id: "monthly",
    name: "1 Month",
    basePrice: 250,
    days: 30,
    icon: Calendar,
    popular: false,
    description: "30 days of full premium access",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    basePrice: 999,
    days: 36500,
    icon: Crown,
    popular: true,
    description: "Unlimited forever access · One time",
  },
];

const RESELLER_PLAN = {
  id: "reseller",
  name: "Reseller License",
  basePrice: 99,
  description: "Earn 50% commission per sale",
  icon: Users,
};

const COUPON_DISCOUNTS: Record<string, number> = {
  SAXJKL: 30,
};

// Coupons that grant free days directly
const COUPON_FREE_DAYS: Record<string, number> = {
  BEP20AD: 30,
};

function generateUniqueAmount(base: number): string {
  const suffix = Math.random() * 0.99 + 0.01;
  return (base + parseFloat(suffix.toFixed(2))).toFixed(2);
}

interface AccessModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining?: number | null;
  mode?: "access" | "reseller";
}

const AccessModal = ({ open, onClose, daysRemaining, mode = "access" }: AccessModalProps) => {
  const [currentMode, setCurrentMode] = useState<"access" | "reseller">(mode);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"usdt" | "telegram" | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<number>(0);
  const [uniqueAmount, setUniqueAmount] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Reset state when mode changes
  useEffect(() => {
    setSelectedPlan(null);
    setPaymentMethod(null);
    setCouponApplied(0);
    setCouponCode("");
    setShowCoupon(false);
  }, [currentMode]);

  const plans = currentMode === "access" ? ACCESS_PLANS : [RESELLER_PLAN];
  const plan = currentMode === "access" 
    ? ACCESS_PLANS.find((p) => p.id === selectedPlan) 
    : selectedPlan === "reseller" ? RESELLER_PLAN : null;
  const discountedBase = plan ? Math.round(plan.basePrice * (1 - couponApplied / 100)) : 0;

  useEffect(() => {
    if (discountedBase > 0) {
      setUniqueAmount(generateUniqueAmount(discountedBase));
    } else {
      setUniqueAmount("");
    }
  }, [discountedBase, selectedPlan]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCouponApply = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    // Check free days coupons first
    const freeDays = COUPON_FREE_DAYS[code];
    if (freeDays) {
      setPaymentStatus("processing");
      setStatusMessage("Applying coupon...");
      try {
        const configRef = ref(db, "panel_config");
        const snap = await get(configRef);
        if (snap.exists()) {
          const config = snap.val();
          const currentExpiry = config.expiry_date ? new Date(config.expiry_date) : new Date();
          if (currentExpiry < new Date()) currentExpiry.setTime(Date.now());
          currentExpiry.setDate(currentExpiry.getDate() + freeDays);
          await set(ref(db, "panel_config/expiry_date"), currentExpiry.toISOString().split("T")[0]);
          setStatusMessage(`${freeDays} days of free access added!`);
          setPaymentStatus("success");
          setTimeout(() => onClose(), 2500);
          return;
        }
      } catch {
        setStatusMessage("Failed to apply coupon");
        setPaymentStatus("failed");
        setTimeout(() => setPaymentStatus("idle"), 2500);
        return;
      }
    }

    // Check discount coupons
    const discount = COUPON_DISCOUNTS[code];
    if (discount) {
      setCouponApplied(discount);
      toast.success(`Coupon applied! ${discount}% off`);
    } else {
      toast.error("Invalid coupon code");
    }
  };

  const handleAutoVerify = async () => {
    if (!plan || !uniqueAmount) return;
    setVerifying(true);
    setPaymentStatus("processing");
    setStatusMessage("Scanning blockchain...");
    try {
      await new Promise((r) => setTimeout(r, 1500)); // brief scan feel
      setStatusMessage("Checking recent transactions...");
      const res = await fetch(
        `https://api.bscscan.com/api?module=account&action=tokentx&address=${BEP20_ADDRESS}&page=1&offset=10&sort=desc&apikey=YourApiKeyToken`
      );
      const data = await res.json();

      if (data.status === "1" && data.result?.length > 0) {
        const targetAmount = parseFloat(uniqueAmount);
        const found = data.result.find((tx: any) => {
          const decimals = parseInt(tx.tokenDecimal) || 18;
          const value = parseInt(tx.value) / Math.pow(10, decimals);
          return Math.abs(value - targetAmount) < 0.01;
        });

        if (found) {
          setStatusMessage("Transaction found! Activating...");
          await new Promise((r) => setTimeout(r, 1000));

          if (currentMode === "access" && "days" in plan!) {
            const addDays = (plan as typeof ACCESS_PLANS[0]).days;
            const configRef = ref(db, "panel_config");
            const snap = await get(configRef);
            if (snap.exists()) {
              const config = snap.val();
              const currentExpiry = config.expiry_date ? new Date(config.expiry_date) : new Date();
              if (currentExpiry < new Date()) currentExpiry.setTime(Date.now());
              currentExpiry.setDate(currentExpiry.getDate() + addDays);
              await set(ref(db, "panel_config/expiry_date"), currentExpiry.toISOString().split("T")[0]);
              setStatusMessage(selectedPlan === "lifetime" ? "Lifetime Access Activated!" : `+${addDays} Days Added!`);
              setPaymentStatus("success");
              setTimeout(() => onClose(), 2500);
              return;
            }
          } else {
            setStatusMessage("Reseller License Activated!");
            setPaymentStatus("success");
            setTimeout(() => onClose(), 2500);
            return;
          }
        }
      }
      setStatusMessage("Transaction not found yet. Please wait and try again.");
      setPaymentStatus("failed");
      setTimeout(() => setPaymentStatus("idle"), 3000);
    } catch {
      setStatusMessage("Verification failed. Try again later.");
      setPaymentStatus("failed");
      setTimeout(() => setPaymentStatus("idle"), 3000);
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  const isExpiring = daysRemaining !== null && daysRemaining !== undefined && daysRemaining > 0 && daysRemaining <= 7;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col"
        >
          {/* Payment Status Overlay */}
          <AnimatePresence>
            {paymentStatus !== "idle" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 px-8"
              >
                {paymentStatus === "processing" && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-5"
                  >
                    <div className="relative h-20 w-20">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary border-r-primary/30"
                      />
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 rounded-full border-[2px] border-transparent border-b-primary/50 border-l-primary/20"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-base font-black text-foreground">Processing</p>
                      <motion.p
                        key={statusMessage}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-muted-foreground"
                      >
                        {statusMessage}
                      </motion.p>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {paymentStatus === "success" && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="flex flex-col items-center gap-5"
                  >
                    <div className="relative">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                        className="h-20 w-20 rounded-full bg-green/15 border-2 border-green/30 flex items-center justify-center"
                      >
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        >
                          <Check className="h-9 w-9 text-green" />
                        </motion.div>
                      </motion.div>
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                          animate={{
                            scale: [0, 1, 0],
                            x: Math.cos((i * 60) * Math.PI / 180) * 50,
                            y: Math.sin((i * 60) * Math.PI / 180) * 50,
                            opacity: [1, 1, 0],
                          }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-green/60"
                        />
                      ))}
                    </div>
                    <div className="text-center space-y-2">
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-xl font-black text-foreground"
                      >
                        Payment Successful! 🎉
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-sm text-muted-foreground"
                      >
                        {statusMessage}
                      </motion.p>
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="px-4 py-2 rounded-full bg-green/10 border border-green/20"
                    >
                      <p className="text-[10px] font-bold text-green uppercase tracking-wider">Access Activated</p>
                    </motion.div>
                  </motion.div>
                )}

                {paymentStatus === "failed" && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-5"
                  >
                    <motion.div
                      animate={{ x: [0, -8, 8, -5, 5, 0] }}
                      transition={{ duration: 0.5 }}
                      className="h-20 w-20 rounded-full bg-destructive/10 border-2 border-destructive/25 flex items-center justify-center"
                    >
                      <X className="h-9 w-9 text-destructive" />
                    </motion.div>
                    <div className="text-center space-y-2">
                      <p className="text-xl font-black text-foreground">Not Found</p>
                      <p className="text-sm text-muted-foreground">{statusMessage}</p>
                    </div>
                    <button
                      onClick={() => setPaymentStatus("idle")}
                      className="px-6 py-2.5 rounded-xl bg-secondary/60 border border-border/40 text-xs font-bold text-foreground active:scale-95 transition-transform"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex items-center gap-2">
              {currentMode === "access" ? <Shield className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
              <h2 className="text-base font-black text-foreground">
                {currentMode === "reseller" ? "Reseller License" : paymentMethod ? "Payment" : selectedPlan ? "Choose Payment" : "Choose Plan"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {(paymentMethod || selectedPlan) && (
                <button
                  onClick={() => paymentMethod ? setPaymentMethod(null) : setSelectedPlan(null)}
                  className="px-3 py-1.5 rounded-lg bg-secondary/50 text-[10px] font-bold text-muted-foreground active:scale-90 transition-transform"
                >
                  Back
                </button>
              )}
              <button onClick={onClose} className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5 space-y-5">

              {/* Expiry Warning */}
              {isExpiring && currentMode === "access" && !selectedPlan && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-destructive">About to Expire!</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Only <span className="font-bold text-destructive">{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span> left. Renew now to avoid losing access.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Mode Tabs */}
              {!selectedPlan && !paymentMethod && (
                <div className="flex gap-2 p-1 rounded-xl bg-secondary/30 border border-border/20">
                  <button
                    onClick={() => setCurrentMode("access")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      currentMode === "access" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Extend Access
                  </button>
                  <button
                    onClick={() => setCurrentMode("reseller")}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                      currentMode === "reseller" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    Reseller License
                  </button>
                </div>
              )}

              {/* Step 1: Plan Selection */}
              {!selectedPlan && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {currentMode === "reseller" && (
                    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green" />
                        <p className="text-xs font-black text-foreground">Earn 50% Per Sale</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Buy a reseller license and sell panel access. You earn <span className="font-bold text-green">50% commission</span> on every sale you make. Just $99 one-time.
                      </p>
                    </div>
                  )}

                  {currentMode === "access" && (
                    <p className="text-xs text-center text-muted-foreground">Select a plan to continue</p>
                  )}

                  {(currentMode === "access" ? ACCESS_PLANS : [RESELLER_PLAN]).map((p) => {
                    const Icon = p.icon;
                    const finalPrice = couponApplied > 0 ? Math.round(p.basePrice * (1 - couponApplied / 100)) : p.basePrice;
                    const isPopular = "popular" in p && p.popular;
                    return (
                      <motion.button
                        key={p.id}
                        onClick={() => setSelectedPlan(p.id)}
                        whileTap={{ scale: 0.97 }}
                        className="w-full relative rounded-2xl p-5 text-left transition-all border-2 border-border/30 bg-card/40 active:border-primary/40"
                      >
                        {isPopular && (
                          <div className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-yellow to-primary text-[9px] font-black text-background uppercase tracking-wider">
                            Best Value
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black text-foreground">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
                          </div>
                          <div className="text-right">
                            {couponApplied > 0 && (
                              <p className="text-[10px] text-muted-foreground line-through">${p.basePrice}</p>
                            )}
                            <p className="text-2xl font-black text-foreground">${finalPrice}</p>
                            <p className="text-[9px] text-muted-foreground">USDT</p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}

                  {/* Coupon */}
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowCoupon(!showCoupon)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/30 bg-card/40 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-yellow" />
                        <span className="text-xs font-bold text-foreground">Have a Coupon?</span>
                        {couponApplied > 0 && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-green/10 text-green font-bold">-{couponApplied}%</span>
                        )}
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showCoupon ? "rotate-90" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showCoupon && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-2"
                        >
                          <Input
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            className="text-xs font-mono h-11 bg-background/60 uppercase tracking-widest"
                          />
                          <Button
                            onClick={handleCouponApply}
                            disabled={!couponCode.trim() || couponApplied > 0}
                            variant="outline"
                            className="w-full gap-2 border-yellow/30 text-yellow hover:bg-yellow/10"
                            size="sm"
                          >
                            <Ticket className="h-4 w-4" />
                            {couponApplied > 0 ? "Coupon Applied ✓" : "Apply Coupon"}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Payment Method */}
              {selectedPlan && !paymentMethod && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="text-center py-3 rounded-2xl bg-primary/5 border border-primary/15">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">{plan?.name}</p>
                    <p className="text-3xl font-black text-primary">${discountedBase}</p>
                    {couponApplied > 0 && (
                      <p className="text-[10px] text-green font-bold mt-1">{couponApplied}% discount applied</p>
                    )}
                  </div>

                  <p className="text-xs text-center text-muted-foreground">Choose payment method</p>

                  <button
                    onClick={() => setPaymentMethod("telegram")}
                    className="w-full rounded-2xl border-2 border-border/30 bg-card/40 p-4 flex items-center gap-4 active:scale-[0.98] active:border-primary/30 transition-all"
                  >
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Send className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-black text-foreground">Pay via Telegram</p>
                      <p className="text-[10px] text-muted-foreground">Message @xylohu to renew</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>

                  <button
                    onClick={() => setPaymentMethod("usdt")}
                    className="w-full rounded-2xl border-2 border-border/30 bg-card/40 p-4 flex items-center gap-4 active:scale-[0.98] active:border-primary/30 transition-all"
                  >
                    <div className="h-12 w-12 rounded-xl bg-green/10 border border-green/20 flex items-center justify-center">
                      <span className="text-green font-black text-lg">$</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-black text-foreground">Pay with USDT</p>
                      <p className="text-[10px] text-muted-foreground">BEP20 (BSC) network</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </motion.div>
              )}

              {/* Step 3a: Telegram Payment */}
              {paymentMethod === "telegram" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                  <div className="text-center py-3 rounded-2xl bg-primary/5 border border-primary/15">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">{plan?.name}</p>
                    <p className="text-3xl font-black text-primary">${discountedBase}</p>
                  </div>

                  <div className="rounded-2xl border border-blue-500/15 bg-card/40 p-5 space-y-4 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                      <Send className="h-7 w-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">Message on Telegram</p>
                      <p className="text-xs text-muted-foreground mt-1">Contact <span className="font-bold text-primary">@xylohu</span> to complete payment</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground">Send this message:</p>
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                        <p className="text-xs font-mono text-foreground">
                          Hi, I want to buy {plan?.name} {currentMode === "reseller" ? "(Reseller)" : ""} (${discountedBase})
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopy(`Hi, I want to buy ${plan?.name} ${currentMode === "reseller" ? "(Reseller)" : ""} ($${discountedBase})`)}
                        className="text-[10px] text-primary font-bold flex items-center gap-1 mx-auto"
                      >
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy message"}
                      </button>
                    </div>
                    <a
                      href="https://t.me/xylohu"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white text-sm font-bold active:scale-95 transition-transform"
                    >
                      <Send className="h-4 w-4" />
                      Open Telegram
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Step 3b: USDT Payment */}
              {paymentMethod === "usdt" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="text-center py-4 rounded-2xl bg-primary/5 border border-primary/15">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1">Send Exactly</p>
                    <p className="text-4xl font-black text-primary">${uniqueAmount}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">USDT on BEP20 (BSC)</p>
                    <p className="text-[8px] text-yellow font-bold mt-2">⚠ Send exact amount for auto-verification</p>
                  </div>

                  <div className="rounded-2xl border border-primary/15 bg-card/40 p-4 space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-center">BEP20 Address</p>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-border/30">
                      <code className="flex-1 text-[9px] font-mono text-foreground break-all leading-relaxed">
                        {BEP20_ADDRESS}
                      </code>
                      <button
                        onClick={() => handleCopy(BEP20_ADDRESS)}
                        className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </div>
                    <p className="text-[8px] text-center text-destructive font-bold">
                      ⚠ Only send USDT on BEP20 (BSC) network. Other tokens will be lost.
                    </p>
                  </div>

                  <Button
                    onClick={handleAutoVerify}
                    disabled={verifying}
                    className="w-full gap-2 h-12"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {verifying ? "Checking transactions..." : "I've Sent — Verify Now"}
                  </Button>

                  <p className="text-[9px] text-center text-muted-foreground">
                    After sending, tap verify. It may take 1-2 minutes for the transaction to appear.
                  </p>
                </motion.div>
              )}

              {/* Info */}
              {!paymentMethod && !selectedPlan && (
                <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 space-y-1.5">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">How it works</p>
                  <p className="text-[10px] text-muted-foreground">1. Select a plan</p>
                  <p className="text-[10px] text-muted-foreground">2. Choose payment method</p>
                  <p className="text-[10px] text-muted-foreground">3. Complete payment & get activated</p>
                  <p className="text-[10px] text-muted-foreground mt-2">• Contact @xylohu on Telegram for support</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AccessModal;
