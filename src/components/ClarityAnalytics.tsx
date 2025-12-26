import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Routes where Clarity should NOT record (admin/authenticated areas)
const EXCLUDED_ROUTES = [
  "/admin",
  "/dashboard",
  "/leads",
  "/settings",
  "/billing",
  "/disputes",
  "/performance",
  "/verification",
  "/onboarding",
  "/auth",
  "/credits-success",
  "/payment-success",
];

export default function ClarityAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Check if current route should be excluded
    const isExcludedRoute = EXCLUDED_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
    );

    if (isExcludedRoute) {
      // Stop Clarity recording on excluded routes
      if (window.clarity) {
        window.clarity("stop");
      }
      return;
    }

    // Initialize or resume Clarity on public routes
    if (!window.clarity) {
      // Load Clarity script if not already loaded
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = `
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "ur4axhic6w");
      `;
      document.head.appendChild(script);
    } else {
      // Resume recording if Clarity exists
      window.clarity("start");
    }
  }, [location.pathname]);

  return null;
}

// TypeScript declaration for Clarity
declare global {
  interface Window {
    clarity?: (command: string, ...args: unknown[]) => void;
  }
}
