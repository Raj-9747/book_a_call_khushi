import type { ReactNode } from "react";
import { CalendarCheck, ChevronDown, MousePointerClick, Quote, Star, Video } from "lucide-react";
import type { ProfileShowcase } from "@/lib/branding/profileShowcase";
import { GlassesDoodle, SparkleDoodle } from "./doodles";

/** Consistent heading for every block on the public profile. */
export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">
        <SparkleDoodle className="h-3 w-3" />
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-neutral-900 [font-variation-settings:'SOFT'_100]">
        {title}
      </h2>
      {children && <p className="mt-2 text-[15px] text-neutral-500">{children}</p>}
    </div>
  );
}

export function Testimonials({
  items,
  rating,
}: {
  items: NonNullable<ProfileShowcase["testimonials"]>;
  rating?: ProfileShowcase["rating"];
}) {
  const [featured, ...rest] = items;
  return (
    <section>
      <SectionHeading eyebrow="Kind words" title="What people say">
        {rating ? `Rated ${rating.score}/5 by ${rating.count} people who've booked a session.` : undefined}
      </SectionHeading>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {/* The strongest quote gets a full-width, coloured card; the rest
            sit beneath it as a quieter grid. */}
        <figure className="relative overflow-hidden rounded-3xl bg-neutral-900 p-7 text-white sm:col-span-2 2xl:col-span-3 2xl:p-9">
          <Quote aria-hidden="true" className="absolute -right-2 -top-2 h-28 w-28 rotate-180 text-white/5" />
          <Stars className="text-marigold-400" />
          <blockquote className="relative mt-4 font-display text-xl leading-snug [font-variation-settings:'SOFT'_100] sm:text-2xl">
            “{featured.quote}”
          </blockquote>
          <figcaption className="mt-5 flex items-center gap-3 text-sm">
            <Initial name={featured.name} className="bg-brand-500 text-white" />
            <span className="font-medium">{featured.name}</span>
          </figcaption>
        </figure>

        {rest.map((t) => (
          <figure key={t.name} className="flex flex-col rounded-3xl border border-border bg-surface p-6">
            <Stars className="text-marigold-400" />
            <blockquote className="mt-3 text-[15px] leading-relaxed text-neutral-700">“{t.quote}”</blockquote>
            <figcaption className="mt-auto flex items-center gap-3 pt-5 text-sm">
              <Initial name={t.name} className="bg-brand-100 text-brand-700" />
              <span className="font-medium text-neutral-900">{t.name}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Stars({ className }: { className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className ?? ""}`} aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="h-4 w-4 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

function Initial({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${className}`}
    >
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function AboutSection({ name, about }: { name: string; about: string }) {
  const firstName = name.trim().split(/\s+/)[0];
  return (
    <section>
      <SectionHeading eyebrow="About" title={`Hi, I'm ${firstName}`} />
      <div className="relative rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <GlassesDoodle aria-hidden="true" className="absolute right-6 top-6 h-5 w-10 text-brand-300" />
        {/* whitespace-pre-line so the admin's own paragraph breaks survive. */}
        <p className="whitespace-pre-line pr-10 text-[15px] leading-7 text-neutral-700">{about}</p>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: MousePointerClick, title: "Pick a session", body: "Choose what you'd like to talk about." },
  { icon: CalendarCheck, title: "Grab a slot", body: "Times are shown in your own timezone." },
  { icon: Video, title: "Hop on the call", body: "Your Google Meet link lands on email and WhatsApp." },
];

export function HowItWorks() {
  return (
    <section>
      <SectionHeading eyebrow="How it works" title="Three steps, zero fuss" />
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="rounded-3xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-display text-3xl font-semibold text-neutral-200">0{i + 1}</span>
            </div>
            <p className="mt-4 font-semibold text-neutral-900">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FaqList({ items }: { items: NonNullable<ProfileShowcase["faqs"]> }) {
  return (
    <section>
      <SectionHeading eyebrow="FAQ" title="Good questions" />
      <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {items.map((f) => (
          // Native <details>: accessible, keyboard-friendly and works with
          // no client JS on an otherwise server-rendered page.
          <details key={f.question} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-neutral-900">
              {f.question}
              <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="-mt-1 pb-5 text-sm leading-relaxed text-neutral-600">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
