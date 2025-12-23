import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SignedUrlResult {
  signedUrl: string;
  expiresIn: number;
}

export function useSignedUrl() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSignedUrl = useCallback(async (
    filePath: string,
    bucket: string = "verification-documents",
    expiresIn: number = 3600
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<SignedUrlResult>(
        "get-signed-url",
        {
          body: { filePath, bucket, expiresIn },
        }
      );

      if (invokeError) {
        console.error("Error fetching signed URL:", invokeError);
        setError(invokeError.message);
        return null;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(err instanceof Error ? err.message : "Failed to get signed URL");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Extract file path from a full URL (if stored as public URL)
  const extractFilePath = useCallback((url: string): string => {
    // Handle full Supabase storage URLs
    const storageMatch = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/);
    if (storageMatch) {
      const fullPath = storageMatch[1];
      // Remove bucket name prefix if present
      const parts = fullPath.split("/");
      if (parts[0] === "verification-documents") {
        return parts.slice(1).join("/");
      }
      return fullPath;
    }
    // Assume it's already a file path
    return url;
  }, []);

  return {
    getSignedUrl,
    extractFilePath,
    loading,
    error,
  };
}
