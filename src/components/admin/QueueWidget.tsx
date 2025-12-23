import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueWidgetProps {
  title: string;
  count: number;
  href: string;
  color?: "default" | "warning" | "danger";
}

export default function QueueWidget({ title, count, href, color = "default" }: QueueWidgetProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-muted/50",
        color === "warning" && "border-amber-500/30 bg-amber-500/5",
        color === "danger" && "border-destructive/30 bg-destructive/5",
        color === "default" && "border-border"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold",
            color === "warning" && "bg-amber-500/20 text-amber-500",
            color === "danger" && "bg-destructive/20 text-destructive",
            color === "default" && "bg-secondary/20 text-secondary"
          )}
        >
          {count}
        </div>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}