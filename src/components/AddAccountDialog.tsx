import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Key, DollarSign, Shield, Loader2, CheckCircle, AlertTriangle, Copy, Check, Ticket, Send } from "lucide-react";
import { addLinkedAccount, validateAccessKey, ACCOUNT_PRICE_USD } from "@/lib/multiAccount";
import { toast } from "sonner";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

type Step = "gate" | "config";

const BEP20_ADDRESS = "0x7a00B4E64103027BC0617102C0791EE1f475eFb";

function generateUniqueAmount(base: number): string {
  const suffix = Math.random() * 0.99 + 0.01;
  return (base + parseFloat(suffix.toFixed(2))).toFixed(2);
}

const AddAccountDialog = ({ open, onOpenChange, onAdded }: AddAccountDialogProps) => {
  const [step, setStep] = useState<Step>("gate");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uniqueAmount, setUniqueAmount] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");

  // Config fields (auto-parsed)
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [firebaseConfigRaw, setFirebaseConfigRaw] = useState("");
  const [fcmJsonRaw, setFcmJsonRaw] = useState("");
  const [parsedFirebase, setParsedFirebase] = useState<any>(null);
  const [parsedFcm, setParsedFcm] = useState<any>(null);
  const [firebaseError, setFirebaseError] = useState("");
  const [fcmError, setFcmError] = useState("");
  const [saving, setSaving] = useState(false);

  const parseFirebaseConfig = (raw: string) => {
    setFirebaseConfigRaw(raw);
    setFirebaseError("");
    try {
      // Strip "const firebaseConfig = " and trailing ";"
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^(const|let|var)\s+\w+\s*=\s*/, "");
      cleaned = cleaned.replace(/;\s*$/, "");
      const parsed = JSON.parse(cleaned.replace(/(['"])?(\w+)(['"])?\s*:/g, '"$2":').replace(/'/g, '"'));
      if (parsed.apiKey && parsed.projectId && parsed.databaseURL && parsed.appId) {
        setParsedFirebase(parsed);
        setFirebaseError("");
      } else {
        setParsedFirebase(null);
        setFirebaseError("Missing required fields (apiKey, projectId, databaseURL, appId)");
      }
    } catch {
      // Try direct JSON parse
      try {
        const parsed = JSON.parse(raw.trim());
        if (parsed.apiKey && parsed.projectId) {
          setParsedFirebase(parsed);
          return;
        }
      } catch {}
      setParsedFirebase(null);
      if (raw.trim()) setFirebaseError("Could not parse config. Paste the full firebaseConfig object.");
    }
  };

  const parseFcmJson = (raw: string) => {
    setFcmJsonRaw(raw);
    setFcmError("");
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed.client_email && parsed.private_key) {
        setParsedFcm(parsed);
        setFcmError("");
      } else {
        setParsedFcm(null);
        setFcmError("Missing client_email or private_key");
      }
    } catch {
      setParsedFcm(null);
      if (raw.trim()) setFcmError("Invalid JSON. Paste the full service account JSON.");
    }
  };

  useEffect(() => {
    if (open && !uniqueAmount) {
      setUniqueAmount(generateUniqueAmount(ACCOUNT_PRICE_USD));
    }
  }, [open]);

  const resetForm = () => {
    setStep("gate");
    setCouponCode("");
    setCouponError("");
    setUnlocked(false);
    setShowCoupon(false);
    setCopied(false);
    setUniqueAmount("");
    setVerifying(false);
    setPaymentStatus("idle");
    setLabel("");
    setEmail("");
    setFirebaseConfigRaw("");
    setFcmJsonRaw("");
    setParsedFirebase(null);
    setParsedFcm(null);
    setFirebaseError("");
    setFcmError("");
  };

  const handleCouponSubmit = () => {
    if (validateAccessKey(couponCode)) {
      setUnlocked(true);
      setCouponError("");
      toast.success("Coupon applied! Access granted.");
      setTimeout(() => setStep("config"), 600);
    } else {
      setCouponError("Invalid coupon code");
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(BEP20_ADDRESS);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyPayment = async () => {
    setVerifying(true);
    setPaymentStatus("processing");
    try {
      const res = await fetch(
        `https://api.bscscan.com/api?module=account&action=txlist&address=${BEP20_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
      );
      const data = await res.json();
      if (data.result && Array.isArray(data.result)) {
        const now = Date.now() / 1000;
        const found = data.result.some((tx: any) => {
          const age = now - parseInt(tx.timeStamp);
          return age < 3600;
        });
        if (found) {
          setPaymentStatus("success");
          toast.success("Payment verified!");
          setTimeout(() => setStep("config"), 1000);
        } else {
          setPaymentStatus("failed");
          toast.error("Payment not found. Try again in a few minutes.");
        }
      } else {
        setPaymentStatus("failed");
      }
    } catch {
      setPaymentStatus("failed");
      toast.error("Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!label || !email || !parsedFirebase || !parsedFcm) {
      toast.error("Fill label, email, and paste both configs");
      return;
    }
    setSaving(true);
    try {
      await addLinkedAccount({
        label,
        apiKey: parsedFirebase.apiKey,
        authDomain: parsedFirebase.authDomain,
        databaseURL: parsedFirebase.databaseURL,
        projectId: parsedFirebase.projectId,
        storageBucket: parsedFirebase.storageBucket || "",
        messagingSenderId: parsedFirebase.messagingSenderId || "",
        appId: parsedFirebase.appId,
        measurementId: parsedFirebase.measurementId || undefined,
        fcmClientEmail: parsedFcm.client_email,
        fcmPrivateKey: parsedFcm.private_key,
      }, email, "");
      toast.success("Account added successfully!");
      resetForm();
      onOpenChange(false);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to add account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-primary" />
            Add Account
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "gate" && (
            <motion.div
              key="gate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Price card */}
              <div className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Per Account</span>
                  <span className="text-lg font-black text-primary">${uniqueAmount || ACCOUNT_PRICE_USD} <span className="text-[10px] text-muted-foreground font-medium">USDT</span></span>
                </div>
                <p className="text-[10px] text-muted-foreground">BEP20 (BSC Network) · One-time payment</p>
              </div>

              {/* USDT Address */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Send USDT to</Label>
                <div className="flex gap-2">
                  <Input
                    value={BEP20_ADDRESS}
                    readOnly
                    className="text-[10px] font-mono h-8"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyAddress} className="h-8 px-2 shrink-0">
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Verify button */}
              <Button
                onClick={handleVerifyPayment}
                disabled={verifying || paymentStatus === "success"}
                className="w-full text-xs"
              >
                {verifying ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Verifying...</>
                ) : paymentStatus === "success" ? (
                  <><CheckCircle className="h-4 w-4 mr-1" /> Verified!</>
                ) : (
                  <><Shield className="h-4 w-4 mr-1" /> Verify Payment</>
                )}
              </Button>

              {paymentStatus === "failed" && (
                <p className="text-[10px] text-destructive text-center">Payment not found. Make sure you sent the exact amount and try again.</p>
              )}

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                <span className="relative bg-background px-3 text-[9px] text-muted-foreground font-bold uppercase">or use coupon</span>
              </div>

              {/* Coupon code */}
              {!showCoupon ? (
                <button onClick={() => setShowCoupon(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <Ticket className="h-3.5 w-3.5" /> Have a coupon code?
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                      className="text-xs h-8"
                    />
                    <Button size="sm" onClick={handleCouponSubmit} disabled={!couponCode.trim() || unlocked} className="h-8">
                      {unlocked ? <CheckCircle className="h-4 w-4 text-primary" /> : <Key className="h-4 w-4" />}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {couponError}
                    </p>
                  )}
                  {unlocked && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-primary font-bold">
                      ✓ Coupon applied! Redirecting...
                    </motion.p>
                  )}
                </motion.div>
              )}

              {/* Contact */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <Send className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Contact <span className="font-bold text-foreground">@CyberMatrix_Admin</span> on Telegram</span>
              </div>
            </motion.div>
          )}

          {step === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[10px] text-muted-foreground">
                  <Shield className="h-3 w-3 inline mr-1 text-primary" />
                  Paste your Firebase config & FCM JSON — fields are auto-detected.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold">Account Label *</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Client Panel 2" className="text-xs h-8" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold">Login Email *</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="text-xs h-8" />
              </div>

              {/* Firebase Config paste */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold">Firebase Config *</Label>
                  {parsedFirebase && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Parsed</span>}
                </div>
                <textarea
                  value={firebaseConfigRaw}
                  onChange={(e) => parseFirebaseConfig(e.target.value)}
                  placeholder={'Paste your firebaseConfig here:\nconst firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  databaseURL: "...",\n  ...\n};'}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[10px] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] resize-none"
                />
                {firebaseError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {firebaseError}</p>}
                {parsedFirebase && (
                  <div className="grid grid-cols-2 gap-1 p-2 rounded-lg bg-card border border-border/50">
                    {Object.entries(parsedFirebase).map(([k, v]) => (
                      <p key={k} className="text-[8px] text-muted-foreground truncate"><span className="font-bold text-foreground">{k}:</span> {String(v).substring(0, 25)}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* FCM JSON paste */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold">FCM Service Account JSON *</Label>
                  {parsedFcm && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Parsed</span>}
                </div>
                <textarea
                  value={fcmJsonRaw}
                  onChange={(e) => parseFcmJson(e.target.value)}
                  placeholder={'Paste service account JSON:\n{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "...",\n  ...\n}'}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[10px] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] resize-none"
                />
                {fcmError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {fcmError}</p>}
                {parsedFcm && (
                  <div className="p-2 rounded-lg bg-card border border-border/50 space-y-0.5">
                    <p className="text-[8px] text-muted-foreground truncate"><span className="font-bold text-foreground">client_email:</span> {parsedFcm.client_email}</p>
                    <p className="text-[8px] text-muted-foreground"><span className="font-bold text-foreground">private_key:</span> ••••••• (detected)</p>
                  </div>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving || !parsedFirebase || !parsedFcm} className="w-full text-xs">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Account
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AddAccountDialog;
