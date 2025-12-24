import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Skeleton className="h-8 w-32 bg-primary-foreground/20" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-24 bg-primary-foreground/20" />
              <Skeleton className="h-9 w-9 rounded-full bg-primary-foreground/20" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title skeleton */}
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Verification banner skeleton */}
        <Skeleton className="h-24 w-full rounded-xl mb-8" />

        {/* Search skeleton */}
        <div className="mb-6">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>

        {/* Lead cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default DashboardSkeleton;
