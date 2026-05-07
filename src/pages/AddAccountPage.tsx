import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Key, DollarSign, Shield, Loader2, CheckCircle, AlertTriangle, Copy, Check, Ticket, Send, ChevronRight, Database, FileJson } from "lucide-react";
import { addLinkedAccount, validateAccessKey, ACCOUNT_PRICE_USD } from "@/lib/multiAccount";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const BEP20_ADDRESS = "0x7a00B4E64103027BC0617102C0791EE1f475eFb";

function generateUniqueAmount(base: number): string {
  const suffix = Math.random() * 0.99 + 0.01;
  return (base + parseFloat(suffix.toFixed(2))).toFixed(2);
}

const stepLabels = ["Payment", "Firebase Config", "FCM Config"];

const AddAccountPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 - Payment
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uniqueAmount, setUniqueAmount] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");

  // Step 2 - Firebase
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [firebaseConfigRaw, setFirebaseConfigRaw] = useState("");
  const [parsedFirebase, setParsedFirebase] = useState<any>(null);
  const [firebaseError, setFirebaseError] = useState("");

  // Step 3 - FCM
  const [fcmJsonRaw, setFcmJsonRaw] = useState("");
  const [parsedFcm, setParsedFcm] = useState<any>(null);
  const [fcmError, setFcmError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uniqueAmount) setUniqueAmount(generateUniqueAmount(ACCOUNT_PRICE_USD));
  }, []);

  const parseFirebaseConfig = (raw: string) => {
    setFirebaseConfigRaw(raw);
    setFirebaseError("");
    if (!raw.trim()) { setParsedFirebase(null); return; }
    try {
      let cleaned = raw.trim();
      // Strip variable declaration and trailing semicolons
      cleaned = cleaned.replace(/^(export\s+)?(const|let|var)\s+\w+\s*=\s*/, "");
      cleaned = cleaned.replace(/;\s*$/, "");
      // Convert JS object to valid JSON: quote unquoted keys, replace single quotes
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1"); // remove trailing commas
      cleaned = cleaned.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'); // quote unquoted keys
      cleaned = cleaned.replace(/'/g, '"'); // single to double quotes
      const parsed = JSON.parse(cleaned);
      if (parsed.apiKey && parsed.projectId && parsed.databaseURL && parsed.appId) {
        setParsedFirebase(parsed);
        if (!label) setLabel(parsed.projectId);
      } else {
        setParsedFirebase(null);
        setFirebaseError("Missing required fields (apiKey, projectId, databaseURL, appId)");
      }
    } catch {
      setParsedFirebase(null);
      setFirebaseError("Could not parse. Paste the full firebaseConfig object.");
    }
  };

  const parseFcmJson = (raw: string) => {
    setFcmJsonRaw(raw);
    setFcmError("");
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed.client_email && parsed.private_key) {
        setParsedFcm(parsed);
      } else {
        setParsedFcm(null);
        setFcmError("Missing client_email or private_key");
      }
    } catch {
      setParsedFcm(null);
      if (raw.trim()) setFcmError("Invalid JSON. Paste the full service account JSON.");
    }
  };

  const handleCouponSubmit = () => {
    if (validateAccessKey(couponCode)) {
      setUnlocked(true);
      setCouponError("");
      toast.success("Coupon applied! Access granted.");
      setTimeout(() => setStep(2), 600);
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
          setTimeout(() => setStep(2), 1000);
        } else {
          setPaymentStatus("failed");
          toast.error("Payment not found yet.");
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
      toast.error("Complete all steps first");
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
      }, email, accPassword);
      toast.success("Account added!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to add account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-card border border-border/50 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-black text-foreground">Add Account</h1>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Step {step} of 3</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`} />
              <span className={`text-[8px] font-bold ${s <= step ? "text-primary" : "text-muted-foreground"}`}>
                {stepLabels[s - 1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* STEP 1: Payment */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-foreground mt-3">Unlock Account Slot</h2>
                <p className="text-[11px] text-muted-foreground">Pay with USDT or use a coupon code</p>
              </div>

              {/* Price */}
              <div className="p-4 rounded-2xl bg-card border border-border/50 text-center">
                <span className="text-2xl font-black text-primary">${uniqueAmount || ACCOUNT_PRICE_USD}</span>
                <span className="text-xs text-muted-foreground ml-1">USDT (BEP20)</span>
                <p className="text-[10px] text-muted-foreground mt-1">One-time · BSC Network</p>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Send to address</Label>
                <div className="flex gap-2">
                  <Input value={BEP20_ADDRESS} readOnly className="text-[9px] font-mono h-9" />
                  <Button size="sm" variant="outline" onClick={handleCopyAddress} className="h-9 px-3 shrink-0">
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Verify */}
              <Button onClick={handleVerifyPayment} disabled={verifying || paymentStatus === "success"} className="w-full">
                {verifying ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</>
                ) : paymentStatus === "success" ? (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Verified!</>
                ) : (
                  <><Shield className="h-4 w-4 mr-2" /> Verify Payment</>
                )}
              </Button>

              {paymentStatus === "failed" && (
                <p className="text-[10px] text-destructive text-center">Payment not found. Try again in a few minutes.</p>
              )}

              {/* Divider */}
              <div className="relative flex items-center justify-center py-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                <span className="relative bg-background px-4 text-[9px] text-muted-foreground font-bold uppercase">or use coupon</span>
              </div>

              {!showCoupon ? (
                <button onClick={() => setShowCoupon(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors rounded-xl border border-dashed border-border">
                  <Ticket className="h-3.5 w-3.5" /> Have a coupon code?
                </button>
              ) : (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Enter coupon code" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }} className="text-xs" />
                    <Button onClick={handleCouponSubmit} disabled={!couponCode.trim() || unlocked}>
                      {unlocked ? <CheckCircle className="h-4 w-4 text-primary" /> : <Key className="h-4 w-4" />}
                    </Button>
                  </div>
                  {couponError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {couponError}</p>}
                  {unlocked && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-primary font-bold text-center">✓ Coupon applied! Proceeding...</motion.p>}
                </motion.div>
              )}

              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Send className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Contact <span className="font-bold text-foreground">@xylohu</span> on Telegram</span>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Firebase Config */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-foreground mt-3">Firebase Config</h2>
                <p className="text-[11px] text-muted-foreground">Paste your firebaseConfig object</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold">Account Label *</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Client Panel 2" className="text-xs" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold">Login Email *</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="text-xs" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold">Login Password *</Label>
                <Input type="password" value={accPassword} onChange={(e) => setAccPassword(e.target.value)} placeholder="••••••••" className="text-xs" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold">Firebase Config *</Label>
                  {parsedFirebase && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Parsed</span>}
                </div>
                <textarea
                  value={firebaseConfigRaw}
                  onChange={(e) => parseFirebaseConfig(e.target.value)}
                  placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  authDomain: "...",\n  databaseURL: "...",\n  projectId: "...",\n  storageBucket: "...",\n  messagingSenderId: "...",\n  appId: "...",\n  measurementId: "..."\n};'}
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-[10px] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[160px] resize-none"
                />
                {firebaseError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {firebaseError}</p>}
                {parsedFirebase && (
                  <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl bg-card border border-border/50">
                    {Object.entries(parsedFirebase).map(([k, v]) => (
                      <p key={k} className="text-[8px] text-muted-foreground truncate"><span className="font-bold text-foreground">{k}:</span> {String(v).substring(0, 20)}</p>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={() => setStep(3)} disabled={!parsedFirebase || !label || !email || !accPassword} className="w-full">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)} className="w-full text-xs text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </motion.div>
          )}

          {/* STEP 3: FCM Config */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <FileJson className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-foreground mt-3">FCM Service Account</h2>
                <p className="text-[11px] text-muted-foreground">Paste the service account JSON for push notifications</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold">Service Account JSON *</Label>
                  {parsedFcm && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Parsed</span>}
                </div>
                <textarea
                  value={fcmJsonRaw}
                  onChange={(e) => parseFcmJson(e.target.value)}
                  placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",\n  ...\n}'}
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-[10px] font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[180px] resize-none"
                />
                {fcmError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {fcmError}</p>}
                {parsedFcm && (
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="text-[9px] text-muted-foreground truncate"><span className="font-bold text-foreground">client_email:</span> {parsedFcm.client_email}</p>
                    <p className="text-[9px] text-muted-foreground"><span className="font-bold text-foreground">private_key:</span> ••••••• (detected)</p>
                    {parsedFcm.project_id && <p className="text-[9px] text-muted-foreground"><span className="font-bold text-foreground">project_id:</span> {parsedFcm.project_id}</p>}
                  </div>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving || !parsedFcm} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add Account
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)} className="w-full text-xs text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AddAccountPage;
