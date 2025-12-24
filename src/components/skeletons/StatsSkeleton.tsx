import { Skeleton } from "@/components/ui/skeleton";

interface StatsSkeletonProps {
  count?: number;
}

export const StatsSkeleton = ({ count = 4 }: StatsSkeletonProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="bg-card rounded-xl border border-border p-5 animate-fade-in-up"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
};

export const KPISkeleton = () => (
  <div className="bg-card rounded-xl border border-border p-6 animate-fade-in-up">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="w-10 h-10 rounded-lg" />
    </div>
    <Skeleton className="h-10 w-24 mb-2" />
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-20" />
    </div>
  </div>
);
