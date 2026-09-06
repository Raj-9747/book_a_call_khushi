import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl", className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-neutral-600">{description}</p>}
    </div>
  );
}
