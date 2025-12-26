import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // Only scroll if pathname changed (not on initial mount with same path)
    const pathnameChanged = prevPathname.current !== pathname;
    prevPathname.current = pathname;

    if (hash) {
      // Wait for the page to render, then scroll to the element
      setTimeout(() => {
        const element = document.getElementById(hash.slice(1));
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } else if (pathnameChanged) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
};
