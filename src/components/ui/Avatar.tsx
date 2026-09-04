import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Shows the admin's uploaded photo when there is one, and falls back to
 * their initials otherwise — so a profile with no photo still looks
 * deliberate rather than broken.
 *
 * Plain `<img>` rather than `next/image`: the source is a Supabase Storage
 * public URL on a bucket the admin controls, so it can't be enumerated at
 * build time and doesn't benefit from the loader's static optimization. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see note above
      <img
        src={src}
        alt={name}
        className={cn(base, "bg-neutral-100 object-cover", className)}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={cn(base, "bg-brand-100 text-sm font-semibold text-brand-700", className)} aria-hidden="true">
      {initials(name) || "?"}
    </div>
  );
}
