import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: {
    value: number;
    positive: boolean;
  };
  className?: string;
}

export default function KPICard({ title, value, icon, change, className }: KPICardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-6", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {change && (
            <p
              className={cn(
                "text-xs mt-1",
                change.positive ? "text-green-500" : "text-red-500"
              )}
            >
              {change.positive ? "+" : ""}
              {change.value}% from last period
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}