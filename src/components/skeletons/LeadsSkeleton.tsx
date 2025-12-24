import { Skeleton } from "@/components/ui/skeleton";

export const LeadsSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Skeleton className="h-8 w-32 bg-primary-foreground/20" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-24 bg-primary-foreground/20" />
              <Skeleton className="h-9 w-24 bg-primary-foreground/20" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title and credits skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        {/* Search skeleton */}
        <div className="mb-8">
          <Skeleton className="h-12 w-full max-w-lg mx-auto rounded-xl" />
        </div>

        {/* Desktop table skeleton */}
        <div className="hidden md:block max-w-5xl mx-auto">
          <div className="bg-card rounded-2xl shadow-elevated overflow-hidden border border-border">
            {/* Table header */}
            <div className="grid grid-cols-5 gap-4 bg-primary px-6 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-5 w-20 bg-primary-foreground/20" />
              ))}
            </div>
            
            {/* Table rows */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="grid grid-cols-5 gap-4 px-6 py-5 items-center border-b border-border"
              >
                <Skeleton className="h-6 w-16 rounded-lg" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-28 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile cards skeleton */}
        <div className="md:hidden space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-xl p-5 border border-border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Skeleton className="h-6 w-16 rounded-lg mb-2" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="text-right">
                  <Skeleton className="h-7 w-16 mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default LeadsSkeleton;
