import { forwardRef } from "react";
import { Link } from "react-router-dom";
import logoPng from "@/assets/cleanda-logo-generated.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  className?: string;
}

export const Logo = forwardRef<HTMLImageElement, LogoProps>(
  ({ size = "md", linkTo = "/", className = "" }, ref) => {
    const sizeClasses = {
      sm: "h-7",
      md: "h-9",
      lg: "h-11",
    };

    const logoElement = (
      <img 
        ref={ref}
        src={logoPng} 
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