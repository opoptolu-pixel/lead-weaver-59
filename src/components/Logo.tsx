import { forwardRef } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.svg";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  className?: string;
}

export const Logo = forwardRef<HTMLImageElement, LogoProps>(
  ({ size = "md", linkTo = "/", className = "" }, ref) => {
    const sizeClasses = {
      sm: "h-8",
      md: "h-12",
      lg: "h-14",
    };

    const logoElement = (
      <img 
        ref={ref}
        src={logo} 
        alt="Deep Clean UK" 
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
