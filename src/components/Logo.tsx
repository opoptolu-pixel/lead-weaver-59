import { forwardRef } from "react";
import { Link } from "react-router-dom";
import logoDark from "@/assets/cleanda-logo-dark.png";
import logoWhite from "@/assets/cleanda-logo-white.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "white";
  linkTo?: string;
  className?: string;
}

export const Logo = forwardRef<HTMLImageElement, LogoProps>(
  ({ size = "md", variant = "dark", linkTo = "/", className = "" }, ref) => {
    const sizeClasses = {
      sm: "h-7",
      md: "h-9",
      lg: "h-11",
    };

    const logoSrc = variant === "white" ? logoWhite : logoDark;

    const logoElement = (
      <img 
        ref={ref}
        src={logoSrc} 
        alt="Cleanda" 
        className={`${sizeClasses[size]} w-auto ${className}`}
      />
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
