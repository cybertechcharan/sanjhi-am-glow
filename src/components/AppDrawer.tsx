import { X, FileText, ChevronRight, Link2, Send, Palette, Info, History, Sparkles, ScanSearch, Download, BookOpen, ShieldCheck, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelName } from "@/hooks/useCustomization";
import ProfileSection from "@/components/ProfileSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenAllForms?: () => void;
}

interface DrawerItemProps {
  icon: React.ElementType;
  label: string;
  desc: string;
  onClick: () => void;
}

const DrawerItem = ({ icon: Icon, label, desc, onClick }: DrawerItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-primary/10 transition-colors group"
  >
    <div className="h-9 w-9 rounded-xl bg-secondary group-hover:bg-primary/20 flex items-center justify-center transition-all">
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
    <div className="flex-1 text-left">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
  </button>
);

const AppDrawer = ({ open, onClose, onOpenAllForms }: AppDrawerProps) => {
  const navigate = useNavigate();
  const [showReseller, setShowReseller] = useState(false);
  

  if (!open) return null;

  const go = (path: string) => { onClose(); navigate(path); };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-card animate-in slide-in-from-left duration-300 flex flex-col">
        {/* Close button */}
        <div className="absolute top-5 right-5 z-10">
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Profile section at top */}
        <ProfileSection onClose={onClose} />

        <div className="flex-1 p-3 space-y-1 overflow-y-auto pb-20">
          <DrawerItem icon={FileText} label="All Forms" desc="View forms from all devices" onClick={() => { onClose(); onOpenAllForms?.(); }} />
          <DrawerItem icon={Link2} label="Manage Links" desc="View, revoke & manage device links" onClick={() => go("/manage-links")} />
          <DrawerItem icon={Send} label="All Sent SMS" desc="View sent messages from all devices" onClick={() => go("/all-sent-sms")} />
          <DrawerItem icon={Send} label="Bulk SMS" desc="Send SMS across multiple devices" onClick={() => go("/bulk-sms")} />
          <DrawerItem icon={Palette} label="Customize" desc="Colors, name & background" onClick={() => go("/customize")} />
          <DrawerItem icon={History} label="Login History" desc="View all login sessions & IPs" onClick={() => go("/login-history")} />
          <DrawerItem icon={Info} label="About" desc="Meet the team behind the panel" onClick={() => go("/about")} />
          <DrawerItem icon={Download} label="Export Data" desc="Download devices, forms, SMS as JSON" onClick={() => go("/export-data")} />

          <div className="my-2 border-t border-border" />

          <DrawerItem icon={Sparkles} label="Magic Clear" desc="Auto-remove devices with uninstalled app" onClick={() => go("/magic-clear")} />
          <DrawerItem icon={ScanSearch} label="Magic Scan" desc="Find highest credit messages across devices" onClick={() => go("/magic-scan")} />

        </div>
      </div>
    </>
  );
};

export default AppDrawer;
