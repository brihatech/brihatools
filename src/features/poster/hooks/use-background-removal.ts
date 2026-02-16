import { useState, useCallback, useEffect, useRef } from "react";
import { removeBackground, type BackgroundRemovalQuality } from "../lib/background";

export function useBackgroundRemoval() {
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Use a ref to track the latest image URL for safe cleanup on unmount/re-renders
  // This avoids stale closures in cleanup functions
  const currentUrlRef = useRef<string | null>(null);

  // Helper to cleanup the current object URL
  const cleanup = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
      setProcessedImage(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
    };
  }, []);

  const removeBg = useCallback(
    async (photoSrc: string, quality: BackgroundRemovalQuality = "standard") => {
      setIsProcessing(true);
      setError(null);
      
      try {
        const url = await removeBackground(photoSrc, quality);
        
        // Revoke the previous URL if it exists
        if (currentUrlRef.current) {
          URL.revokeObjectURL(currentUrlRef.current);
        }
        
        currentUrlRef.current = url;
        setProcessedImage(url);
        
        return url;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to remove background");
        setError(error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {processedImage, isProcessing, error, removeBg, cleanup};
}

