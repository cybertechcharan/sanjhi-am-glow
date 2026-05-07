import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, Loader2, CheckCircle, AlertTriangle, ChevronRight, Database, FileJson } from "lucide-react";
import { getLinkedAccounts, updateLinkedAccount, LinkedAccount } from "@/lib/multiAccount";
import { ref, get } from "@/lib/rtdbPb";
import { defaultDb } from "@/lib/firebase";
import { toast } from "sonner";

type Step = 1 | 2;

const stepLabels = ["Firebase Config", "FCM Config"];

const EditAccountPage = () => {
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<LinkedAccount | null>(null);

  // Step 1 - Firebase
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [firebaseConfigRaw, setFirebaseConfigRaw] = useState("");
  const [parsedFirebase, setParsedFirebase] = useState<any>(null);
  const [firebaseError, setFirebaseError] = useState("");

  // Step 2 - FCM
  const [fcmJsonRaw, setFcmJsonRaw] = useState("");
  const [parsedFcm, setParsedFcm] = useState<any>(null);
  const [fcmError, setFcmError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        const snap = await get(ref(defaultDb, `security_settings/linked_accounts/${accountId}`));
        const data = snap.val();
        if (!data) { toast.error("Account not found"); navigate(-1); return; }

        const acc: LinkedAccount = {
          id: accountId,
          label: data.label || data.projectId || "",
          apiKey: data.apiKey,
          authDomain: data.authDomain,
          databaseURL: data.databaseURL,
          projectId: data.projectId,
          storageBucket: data.storageBucket || "",
          messagingSenderId: data.messagingSenderId || "",
          appId: data.appId,
          measurementId: data.measurementId,
          fcmClientEmail: data.fcmClientEmail || "",
          fcmPrivateKey: data.fcmPrivateKey || "",
          addedAt: data.addedAt,
        };
        setAccount(acc);
        setLabel(acc.label);
        setEmail(data.email || "");
        setAccPassword(data.password || "");

        // Pre-fill firebase config
        const firebaseObj = {
          apiKey: acc.apiKey,
          authDomain: acc.authDomain,
          databaseURL: acc.databaseURL,
          projectId: acc.projectId,
          storageBucket: acc.storageBucket,
          messagingSenderId: acc.messagingSenderId,
          appId: acc.appId,
          ...(acc.measurementId ? { measurementId: acc.measurementId } : {}),
        };
        const configStr = JSON.stringify(firebaseObj, null, 2);
        setFirebaseConfigRaw(configStr);
        setParsedFirebase(firebaseObj);

        // Pre-fill FCM
        if (acc.fcmClientEmail && acc.fcmPrivateKey) {
          const fcmObj = { client_email: acc.fcmClientEmail, private_key: acc.fcmPrivateKey };
          setFcmJsonRaw(JSON.stringify(fcmObj, null, 2));
          setParsedFcm(fcmObj);
        }
      } catch (err) {
        toast.error("Failed to load account");
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const parseFirebaseConfig = (raw: string) => {
    setFirebaseConfigRaw(raw);
    setFirebaseError("");
    if (!raw.trim()) { setParsedFirebase(null); return; }
    try {
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^(export\s+)?(const|let|var)\s+\w+\s*=\s*/, "");
      cleaned = cleaned.replace(/;\s*$/, "");
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
      cleaned = cleaned.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
      cleaned = cleaned.replace(/'/g, '"');
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

  const handleSave = async () => {
    if (!accountId || !label || !email || !parsedFirebase || !parsedFcm) {
      toast.error("Complete all fields first");
      return;
    }
    setSaving(true);
    try {
      await updateLinkedAccount(accountId, {
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
      toast.success("Account updated!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-6">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl bg-card border border-border/50 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-black text-foreground">Edit Account</h1>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">Step {step} of 2</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          {[1, 2].map((s) => (
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
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-foreground mt-3">Firebase Config</h2>
                <p className="text-[11px] text-muted-foreground">Update your firebaseConfig object</p>
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
                  placeholder={'const firebaseConfig = {\n  apiKey: "...",\n  ...}'}
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

              <Button onClick={() => setStep(2)} disabled={!parsedFirebase || !label || !email || !accPassword} className="w-full">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <FileJson className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-foreground mt-3">FCM Service Account</h2>
                <p className="text-[11px] text-muted-foreground">Update the service account JSON</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold">Service Account JSON *</Label>
                  {parsedFcm && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Parsed</span>}
                </div>
                <textarea
                  value={fcmJsonRaw}
                  onChange={(e) => parseFcmJson(e.target.value)}
                  placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "...",\n  ...\n}'}
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
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)} className="w-full text-xs text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EditAccountPage;
