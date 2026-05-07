import { usePanelConfig } from "@/hooks/usePanelConfig";
import { Clock, ChevronRight, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProfileSectionProps {
  onClose?: () => void;
}

const ProfileSection = ({ onClose }: ProfileSectionProps) => {
  const { config, daysRemaining } = usePanelConfig();
  const navigate = useNavigate();
  const firstLetter = config.admin_name?.charAt(0)?.toUpperCase() || "?";

  const handleClick = () => {
    onClose?.();
    navigate("/profile");
  };

  return (
    <button onClick={handleClick} className="w-full p-5 border-b border-border flex items-center gap-3 hover:bg-primary/5 transition-colors text-left">
      <div className="h-11 w-11 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-lg font-black">
        {firstLetter}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{config.admin_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {daysRemaining !== null && daysRemaining > 0 ? (() => {
            if (daysRemaining > 10000) return <span className="inline-flex items-center gap-1 text-[10px] font-black"><Crown className="h-3 w-3 text-yellow" /><span className="bg-gradient-to-r from-yellow to-primary bg-clip-text text-transparent">VIP3 · Premium</span></span>;
            if (daysRemaining > 25) return <span className="inline-flex items-center gap-1 text-[10px] font-black"><Crown className="h-3 w-3 text-yellow drop-shadow-[0_0_3px_rgba(234,179,8,0.5)]" /><span className="bg-gradient-to-r from-yellow to-amber-400 bg-clip-text text-transparent">Gold · {daysRemaining}d</span></span>;
            if (daysRemaining >= 7) return <span className="inline-flex items-center gap-1 text-[10px] font-black"><Crown className="h-3 w-3 text-slate-300 drop-shadow-[0_0_3px_rgba(148,163,184,0.5)]" /><span className="bg-gradient-to-r from-slate-200 to-gray-400 bg-clip-text text-transparent">Silver · {daysRemaining}d</span></span>;
            return <span className="inline-flex items-center gap-1 text-[10px] font-black"><Crown className="h-3 w-3 text-orange" /><span className="bg-gradient-to-r from-orange to-amber-700 bg-clip-text text-transparent">Bronze · {daysRemaining}d</span></span>;
          })() : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold"><Clock className="h-3 w-3 text-destructive" /><span className="text-destructive">Expired</span></span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

export default ProfileSection;
