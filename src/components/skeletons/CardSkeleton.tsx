import { Skeleton } from "@/components/ui/skeleton";

interface CardSkeletonProps {
  showImage?: boolean;
  showActions?: boolean;
  lines?: number;
}

export const CardSkeleton = ({ 
  showImage = false, 
  showActions = true,
  lines = 3 
}: CardSkeletonProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in-up">
      {showImage && (
        <Skeleton className="w-full h-40 rounded-lg mb-4" />
      )}
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-4" 
              style={{ width: `${Math.random() * 30 + 50}%` }} 
            />
          ))}
        </div>
      </div>
      {showActions && (
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  );
};

export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};
