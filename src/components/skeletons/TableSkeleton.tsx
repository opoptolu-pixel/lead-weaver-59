import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
}

export const TableSkeleton = ({ 
  columns = 5, 
  rows = 6,
  showHeader = true 
}: TableSkeletonProps) => {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-fade-in-up">
      {showHeader && (
        <div 
          className="grid gap-4 bg-muted px-6 py-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
      )}
      
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 px-6 py-4 border-t border-border"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className="h-5"
              style={{ width: colIndex === 0 ? '80%' : `${Math.random() * 40 + 40}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
