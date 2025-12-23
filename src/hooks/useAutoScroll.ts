import { useState, useEffect, useRef, useCallback } from "react";

interface UseAutoScrollOptions {
  speed?: number; // pixels per second
  pauseOnHover?: boolean;
  pauseOnTouch?: boolean;
}

export function useAutoScroll(options: UseAutoScrollOptions = {}) {
  const { speed = 30, pauseOnHover = true, pauseOnTouch = true } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const scrollPositionRef = useRef<number>(0);

  const animate = useCallback((timestamp: number) => {
    if (!containerRef.current) return;
    
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }
    
    const deltaTime = (timestamp - lastTimeRef.current) / 1000; // Convert to seconds
    lastTimeRef.current = timestamp;
    
    if (!isPaused) {
      scrollPositionRef.current += speed * deltaTime;
      
      const container = containerRef.current;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const maxScroll = scrollHeight - clientHeight;
      
      // Reset to top when reaching bottom (seamless loop)
      if (scrollPositionRef.current >= maxScroll) {
        scrollPositionRef.current = 0;
      }
      
      container.scrollTop = scrollPositionRef.current;
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [isPaused, speed]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    lastTimeRef.current = 0; // Reset time to prevent jump
  }, []);

  const handleMouseEnter = pauseOnHover ? pause : undefined;
  const handleMouseLeave = pauseOnHover ? resume : undefined;
  const handleTouchStart = pauseOnTouch ? pause : undefined;
  const handleTouchEnd = pauseOnTouch ? resume : undefined;
  const handleFocus = pause;
  const handleBlur = resume;

  return {
    containerRef,
    isPaused,
    pause,
    resume,
    containerProps: {
      ref: containerRef,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}
