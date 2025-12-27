import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "white";
  linkTo?: string;
  className?: string;
}

export const Logo = forwardRef<HTMLSpanElement, LogoProps>(
  ({ size = "md", variant = "dark", linkTo = "/", className = "" }, ref) => {
    const sizeClasses = {
      sm: "text-2xl",
      md: "text-3xl",
      lg: "text-4xl",
    };

    const iconSizeClasses = {
      sm: "w-5 h-5",
      md: "w-6 h-6",
      lg: "w-7 h-7",
    };

    const colorClasses = variant === "white" 
      ? "text-white" 
      : "text-[#0f2a4a]";

    const logoElement = (
      <span 
        ref={ref}
        className={`font-extrabold tracking-tight flex items-center gap-1 ${sizeClasses[size]} ${colorClasses} ${className}`}
        style={{ fontFamily: "'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
      >
        <Sparkles className={`${iconSizeClasses[size]} ${variant === "white" ? "text-secondary" : "text-primary"}`} />
        Cleanda
      </span>
    );

    if (linkTo) {
      return (
        <Link to={linkTo} className="flex items-center">
          {logoElement}
        </Link>
      );
    }

    return logoElement;
  }
);

Logo.displayName = "Logo";
