import { useEffect, useRef, useState } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  fallbackDelay?: number; // Fallback to show content if IntersectionObserver doesn't trigger
}

export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollAnimationOptions = {}
) {
  const { 
    threshold = 0.1, 
    rootMargin = "0px", 
    triggerOnce = true,
    fallbackDelay = 1500 // Show content after 1.5s if not already visible (helps with Clarity recordings)
  } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference - skip animations entirely
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    // Fallback timer for screen recorders (Clarity, etc.) that don't trigger IntersectionObserver
    const fallbackTimer = setTimeout(() => {
      setIsVisible(true);
    }, fallbackDelay);

    return () => {
      observer.unobserve(element);
      clearTimeout(fallbackTimer);
    };
  }, [threshold, rootMargin, triggerOnce, fallbackDelay]);

  return { ref, isVisible };
}
