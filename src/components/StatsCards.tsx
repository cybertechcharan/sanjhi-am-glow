import { Smartphone, Activity, Users } from "lucide-react";

interface StatsCardsProps {
  totalUsers: number;
  onlineUsers: number;
}

const stats_config = [
  { label: "Total", icon: Smartphone, gradient: "gradient-purple-pink" },
  { label: "Online", icon: Activity, gradient: "gradient-green-cyan" },
  { label: "Offline", icon: Users, gradient: "gradient-orange-yellow" },
];

const StatsCards = ({ totalUsers, onlineUsers }: StatsCardsProps) => {
  const values = [totalUsers, onlineUsers, totalUsers - onlineUsers];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats_config.map((stat, i) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-card p-3 transition-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`h-7 w-7 rounded-lg ${stat.gradient} flex items-center justify-center`}>
              <stat.icon className="h-3.5 w-3.5 text-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
          <p className="text-xl font-bold text-foreground">{values[i]}</p>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
