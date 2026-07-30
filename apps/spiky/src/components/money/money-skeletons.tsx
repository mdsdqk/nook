import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/5",
        className,
      )}
      aria-hidden
    />
  );
}

export function MoneySkeletons() {
  return (
    <div
      className="flex flex-col gap-stack-lg"
      role="status"
      aria-label="Loading money data"
    >
      <section>
        <div className="mb-stack-sm flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 min-w-[220px] flex-1 rounded-lg" />
          ))}
        </div>
      </section>

      <Skeleton className="h-64 w-full rounded-lg" />

      <section>
        <div className="mb-stack-sm flex items-end justify-between gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="mb-3 h-10 w-72" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </section>
    </div>
  );
}
