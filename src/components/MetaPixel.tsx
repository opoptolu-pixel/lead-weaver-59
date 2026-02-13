import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const META_PIXEL_ID = "1204767561831151";

const EXCLUDED_ROUTES = [
  "/admin",
  "/admin-login",
  "/dashboard",
  "/leads",
  "/settings",
  "/billing",
  "/disputes",
  "/performance",
  "/verification",
  "/onboarding",
  "/support",
  "/auth",
  "/credits-success",
  "/payment-success",
];

export default function MetaPixel() {
  const location = useLocation();

  useEffect(() => {
    const isExcluded = EXCLUDED_ROUTES.some(
      (route) =>
        location.pathname === route || location.pathname.startsWith(`${route}/`)
    );

    if (isExcluded) return;

    if (!window.fbq) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);

      window.fbq = function (...args: unknown[]) {
        // Queue calls until the real fbq loads
        (window.fbq as any).callMethod
          ? (window.fbq as any).callMethod(...args)
          : (window.fbq as any).queue.push(args);
      };
      (window.fbq as any).push = window.fbq;
      (window.fbq as any).loaded = true;
      (window.fbq as any).version = "2.0";
      (window.fbq as any).queue = [] as unknown[][];

      window.fbq("init", META_PIXEL_ID);
    }

    window.fbq("track", "PageView");
  }, [location.pathname]);

  const isExcluded = EXCLUDED_ROUTES.some(
    (route) =>
      location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  if (isExcluded) return null;

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
