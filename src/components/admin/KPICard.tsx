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
        "bg-card rounded-xl border border-border/30 p-5 md:p-7 transition-all duration-300",
        "shadow-[0_1px_3px_hsl(var(--foreground)/0.04),0_1px_2px_hsl(var(--foreground)/0.03)]",
        "hover:shadow-[0_8px_25px_-5px_hsl(var(--foreground)/0.08),0_4px_10px_-4px_hsl(var(--foreground)/0.04)]",
        "hover:-translate-y-0.5",
        href && "cursor-pointer hover:border-secondary/20 active:scale-[0.995]",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">{title}</p>
          <div className="flex items-baseline gap-2.5">
            <p className="text-[1.875rem] md:text-[2.25rem] font-bold text-foreground tracking-[-0.04em] leading-none">{value}</p>
            {trend}
          </div>
          {change && (
            <p
              className={cn(
                "text-xs font-medium mt-1.5 flex items-center gap-1",
                change.positive ? "text-green-600 dark:text-green-400" : "text-red-500"
              )}
            >
              {change.positive ? "↑" : "↓"} {change.value}% vs last period
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-secondary/8 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
