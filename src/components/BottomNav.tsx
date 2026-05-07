import { LayoutDashboard, TabletSmartphone, MessagesSquare, Send } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Devices", icon: TabletSmartphone, path: "/devices" },
  { label: "Messages", icon: MessagesSquare, path: "/messages" },
  { label: "Bulk SMS", icon: Send, path: "/bulk-sms" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-card/95 backdrop-blur-2xl safe-area-pb lg:hidden">
      <div className="flex items-center justify-around h-[62px] max-w-2xl mx-auto px-1">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-0 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <tab.icon className={`h-5 w-5 relative z-10 ${isActive ? "text-primary" : ""}`} />
              </div>
              <span className={`text-[9px] font-semibold ${isActive ? "text-primary" : ""}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
