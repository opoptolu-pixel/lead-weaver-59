import { forwardRef } from "react";
import { Link } from "react-router-dom";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "white";
  linkTo?: string;
  className?: string;
}

export const Logo = forwardRef<HTMLSpanElement, LogoProps>(
  ({ size = "md", variant = "dark", linkTo = "/", className = "" }, ref) => {
    const sizeClasses = {
      sm: "text-xl",
      md: "text-2xl",
      lg: "text-3xl",
    };

    const colorClasses = variant === "white" 
      ? "text-white" 
      : "text-[#0f2a4a]";

    const logoElement = (
      <span 
        ref={ref}
        className={`font-bold tracking-tight ${sizeClasses[size]} ${colorClasses} ${className}`}
        style={{ fontFamily: "'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
      >
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
