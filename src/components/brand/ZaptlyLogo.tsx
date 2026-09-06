import { cn } from "@/lib/utils";
import { ZaptlyMark } from "./ZaptlyMark";

/** Mark + wordmark lockup. Callers wrap this in a `<Link>` where it should
 * navigate — keeping it presentational means the same lockup works in the
 * nav, the footer, the sidebar and the sign-in screen without each needing
 * its own link behaviour. */
export function ZaptlyLogo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ZaptlyMark className={markClassName} />
      <span className={cn("text-base font-semibold tracking-tight text-neutral-900", wordmarkClassName)}>
        Zaptly
      </span>
    </span>
  );
}
