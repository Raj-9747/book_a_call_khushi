import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200", className)} />;
}

/** Shown by the route-level `loading.tsx` files while a dashboard page's
 * server component renders.
 *
 * Without one of these, Next.js holds the old page on screen until the new
 * one is ready, so a navigation reads as "nothing happened" for however
 * long the round trip to Supabase takes. This makes the transition
 * immediate — the layout stays put and the content area swaps to a skeleton
 * roughly the shape of what's coming. */
export function PageSkeleton() {
  return (
    <>
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-8 sm:py-5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="mt-2 h-3.5 w-64" />
      </div>
      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Shimmer className="h-10 flex-1" />
          <Shimmer className="h-10 sm:w-44" />
          <Shimmer className="h-10 sm:w-48" />
        </div>
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-6 py-3">
            <Shimmer className="h-3.5 w-full max-w-md" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0">
              <Shimmer className="h-3.5 w-1/4" />
              <Shimmer className="h-3.5 w-1/5" />
              <Shimmer className="h-3.5 w-1/6" />
              <Shimmer className="ml-auto h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Card-shaped variant for the settings-style pages (Profile, Availability)
 * whose content is stacked cards rather than a table. */
export function CardsSkeleton() {
  return (
    <>
      <div className="border-b border-border bg-surface px-4 py-4 sm:px-8 sm:py-5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="mt-2 h-3.5 w-64" />
      </div>
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-surface p-6">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="mt-3 h-3 w-56" />
              <Shimmer className="mt-6 h-10 w-full" />
              <Shimmer className="mt-3 h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
