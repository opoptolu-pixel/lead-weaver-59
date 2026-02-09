import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  children,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted/60 flex items-center justify-center mb-5">
        <Icon className="w-9 h-9 text-muted-foreground/70" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground mb-2 tracking-[-0.02em]">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} variant="default" className="h-11 px-6 font-medium">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
};

export default EmptyState;
