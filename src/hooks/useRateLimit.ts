import { useRef, useCallback } from "react";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
};

// Store rate limit data per action
const rateLimitStore = new Map<string, { timestamps: number[] }>();

export const useRateLimit = (action: string, config: Partial<RateLimitConfig> = {}) => {
  const { maxRequests, windowMs } = { ...defaultConfig, ...config };
  const configRef = useRef({ maxRequests, windowMs });
  configRef.current = { maxRequests, windowMs };

  const checkRateLimit = useCallback((): RateLimitResult => {
    const now = Date.now();
    const key = action;
    const { maxRequests, windowMs } = configRef.current;
    
    // Get or create rate limit data for this action
    let data = rateLimitStore.get(key);
    if (!data) {
      data = { timestamps: [] };
      rateLimitStore.set(key, data);
    }

    // Remove expired timestamps
    data.timestamps = data.timestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );

    const remainingRequests = Math.max(0, maxRequests - data.timestamps.length);
    const oldestTimestamp = data.timestamps[0] || now;
    const resetTime = oldestTimestamp + windowMs;

    if (data.timestamps.length >= maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime,
      };
    }

    return {
      allowed: true,
      remainingRequests: remainingRequests - 1,
      resetTime,
    };
  }, [action]);

  const recordRequest = useCallback(() => {
    const key = action;
    let data = rateLimitStore.get(key);
    if (!data) {
      data = { timestamps: [] };
      rateLimitStore.set(key, data);
    }
    data.timestamps.push(Date.now());
  }, [action]);

  const executeWithRateLimit = useCallback(
    async <T>(fn: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: string }> => {
      const result = checkRateLimit();
      
      if (!result.allowed) {
        const waitSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait ${waitSeconds} seconds before trying again.`,
        };
      }

      recordRequest();
      
      try {
        const data = await fn();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "An error occurred",
        };
      }
    },
    [checkRateLimit, recordRequest]
  );

  const getRemainingRequests = useCallback((): number => {
    return checkRateLimit().remainingRequests;
  }, [checkRateLimit]);

  const getResetTime = useCallback((): number => {
    return checkRateLimit().resetTime;
  }, [checkRateLimit]);

  return {
    checkRateLimit,
    recordRequest,
    executeWithRateLimit,
    getRemainingRequests,
    getResetTime,
  };
};

// Preset configurations for common actions
export const RATE_LIMIT_PRESETS = {
  unlockLead: { maxRequests: 5, windowMs: 60000 },      // 5 per minute
  buyCredits: { maxRequests: 3, windowMs: 60000 },      // 3 per minute
  submitDispute: { maxRequests: 3, windowMs: 300000 },  // 3 per 5 minutes
  sendVerification: { maxRequests: 3, windowMs: 300000 }, // 3 per 5 minutes
  updateProfile: { maxRequests: 10, windowMs: 60000 },  // 10 per minute
  search: { maxRequests: 30, windowMs: 60000 },         // 30 per minute
};

export default useRateLimit;
