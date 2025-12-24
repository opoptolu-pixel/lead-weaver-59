import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export const PageLoader = ({ message = "Loading..." }: PageLoaderProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-secondary mb-4" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
};

export default PageLoader;
