import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: {
    value: number;
    positive: boolean;
  };
  trend?: ReactNode;
  className?: string;
  href?: string;
}

export default function KPICard({ title, value, icon, change, trend, className, href }: KPICardProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (href) {
      navigate(href);
    }
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-xl border border-border/60 p-5 md:p-6 transition-all duration-200",
        href && "cursor-pointer hover:shadow-md hover:border-secondary/40",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{value}</p>
            {trend}
          </div>
          {change && (
            <p
              className={cn(
                "text-xs font-medium mt-0.5",
                change.positive ? "text-green-600 dark:text-green-400" : "text-red-500"
              )}
            >
              {change.positive ? "↑" : "↓"} {change.value}% vs last period
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
