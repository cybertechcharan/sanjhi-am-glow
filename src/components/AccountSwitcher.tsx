import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, ChevronDown, Plus, Check, Loader2, Trash2, Database, LogOut, Pencil, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLinkedAccounts, LinkedAccount, getActiveAccountId, switchToAccount, switchToDefault, removeLinkedAccount, syncSettingsToAllAccounts } from "@/lib/multiAccount";
import { usePanelConfig } from "@/hooks/usePanelConfig";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SWITCH_OVERLAY_ID = "dxp-switch-overlay";

function showSwitchOverlay(label: string) {
  // Create a fullscreen overlay that persists through reload
  const overlay = document.createElement("div");
  overlay.id = SWITCH_OVERLAY_ID;
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    background:var(--background, #000);
    opacity:0;transition:opacity 0.25s ease;
  `;
  overlay.innerHTML = `
    <div style="h-20 w-20 rounded-3xl bg-gradient-to-br" class="flex items-center justify-center">
      <svg style="width:36px;height:36px;animation:spin 1s linear infinite;color:hsl(var(--primary))" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    </div>
    <p style="font-size:13px;font-weight:700;color:hsl(var(--foreground));letter-spacing:0.02em">Switching to ${label}...</p>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = "1"; });
}

const AccountSwitcher = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getActiveAccountId());
  const [switching, setSwitching] = useState<string | null>(null);
  const [showPassDialog, setShowPassDialog] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<LinkedAccount | null>(null);
  const [password, setPassword] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { config } = usePanelConfig();

  // Store default panel name when on default account
  useEffect(() => {
    if (!activeId && config.admin_name) {
      localStorage.setItem("dxp_default_panel_name", config.admin_name);
    }
  }, [activeId, config.admin_name]);

  const defaultPanelName = activeId
    ? (localStorage.getItem("dxp_default_panel_name") || "Default")
    : (config.admin_name || "Default");

  const loadAccounts = async () => {
    try {
      const accs = await getLinkedAccounts();
      setAccounts(accs);
    } catch {}
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const doSwitch = (label: string) => {
    setOpen(false);
    showSwitchOverlay(label);
    setTimeout(() => window.location.reload(), 350);
  };

  const handleSwitch = async (account: LinkedAccount) => {
    setSwitching(account.id);
    const result = await switchToAccount(account, localStorage.getItem("dxp_login_pass") || undefined);
    setSwitching(null);
    if (result.success) {
      setActiveId(account.id);
      toast.success(`Switching to ${account.label}...`);
      doSwitch(account.label);
      return;
    }
    setPendingAccount(account);
    setPassword("");
    setShowPassDialog(true);
  };

  const handlePasswordSubmit = async () => {
    if (!pendingAccount || !password) return;
    setSwitching(pendingAccount.id);
    const result = await switchToAccount(pendingAccount, password);
    setSwitching(null);
    if (result.success) {
      setActiveId(pendingAccount.id);
      setShowPassDialog(false);
      toast.success(`Switching to ${pendingAccount.label}...`);
      doSwitch(pendingAccount.label);
    } else {
      toast.error(result.error || "Auth failed");
    }
  };

  const handleSwitchDefault = async () => {
    setSwitching("default");
    await switchToDefault();
    setActiveId(null);
    toast.success("Switching to default...");
    doSwitch(defaultPanelName);
  };

  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeLinkedAccount(id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Account removed");
  };

  const firstLetter = defaultPanelName.charAt(0).toUpperCase();

  return (
    <>
      <div className="relative z-50">
        <button
          onClick={() => setOpen(!open)}
          className="relative h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-black active:scale-90 transition-all ring-2 ring-primary/20 ring-offset-1 ring-offset-background"
        >
          {firstLetter}
        </button>

        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div 
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" 
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="absolute right-0 top-full mt-2.5 w-72 bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 pt-3.5 pb-2.5 border-b border-border/30">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Switch Account</p>
                </div>

                <div className="py-1.5">
                  {/* Default account */}
                  <button
                    onClick={handleSwitchDefault}
                    disabled={switching !== null}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
                      !activeId ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                      !activeId 
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card" 
                        : "bg-primary/15 text-primary"
                    }`}>
                      {firstLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{defaultPanelName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Default Panel</p>
                    </div>
                    {!activeId && <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-primary" /></div>}
                    {switching === "default" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  </button>

                  {/* Linked accounts */}
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => handleSwitch(acc)}
                      disabled={switching !== null}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 group ${
                        activeId === acc.id ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                        activeId === acc.id
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card"
                          : "bg-muted/60 border border-border/50"
                      }`}>
                        {activeId === acc.id 
                          ? <span className="text-xs font-black">{acc.label.charAt(0).toUpperCase()}</span>
                          : <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-foreground truncate">{acc.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{acc.projectId}</p>
                      </div>
                      {activeId === acc.id && <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Check className="h-3 w-3 text-primary" /></div>}
                      {switching === acc.id && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpen(false); navigate(`/edit-account/${acc.id}`); }}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center hover:bg-primary/10 transition-all shrink-0"
                      >
                        <Pencil className="h-3 w-3 text-primary" />
                      </button>
                      <button
                        onClick={(e) => handleRemove(acc.id, e)}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-all shrink-0"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="px-3 py-2.5 border-t border-border/30 flex gap-2">
                  <button
                    onClick={async () => {
                      if (accounts.length === 0) {
                        toast.error("No linked accounts to sync");
                        return;
                      }
                      setSyncing(true);
                      setOpen(false);
                      try {
                        const result = await syncSettingsToAllAccounts();
                        if (result.failed.length > 0) {
                          toast.warning(`Synced ${result.synced} accounts. Failed: ${result.failed.join(", ")}`);
                        } else {
                          toast.success(`Settings synced to ${result.synced} account${result.synced > 1 ? "s" : ""}`);
                        }
                      } catch (err: any) {
                        toast.error("Sync failed: " + (err.message || "Unknown error"));
                      }
                      setSyncing(false);
                    }}
                    disabled={syncing || accounts.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-muted-foreground bg-muted/30 hover:bg-muted/50 border border-border/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                  >
                    {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sync All
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate("/add-account"); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all duration-200 active:scale-[0.98]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Account
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      

      {/* Password dialog */}
      <Dialog open={showPassDialog} onOpenChange={setShowPassDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Enter Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            Password is required to authenticate with <span className="font-bold text-foreground">{pendingAccount?.label}</span>
          </p>
          <Input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
            className="text-xs"
          />
          <Button onClick={handlePasswordSubmit} disabled={!password || switching !== null} className="text-xs">
            {switching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Authenticate & Switch
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountSwitcher;
