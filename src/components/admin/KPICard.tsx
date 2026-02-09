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
        "bg-card rounded-2xl border border-border/40 p-5 md:p-6 transition-all duration-300 hover:shadow-[0_4px_24px_-4px_hsl(var(--foreground)/0.06)]",
        href && "cursor-pointer hover:border-secondary/30 active:scale-[0.99]",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl md:text-[2rem] font-bold text-foreground tracking-[-0.03em] leading-none">{value}</p>
            {trend}
          </div>
          {change && (
            <p
              className={cn(
                "text-[11px] font-semibold mt-1",
                change.positive ? "text-green-600 dark:text-green-400" : "text-red-500"
              )}
            >
              {change.positive ? "↑" : "↓"} {change.value}% vs last period
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-2xl bg-secondary/8 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
