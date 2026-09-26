"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui";
import type { ProfileShowcase, Testimonial } from "@/lib/branding/profileShowcase";

/** The strip shows only the top few; the rest live in the "Show all"
 * overlay so reviews support the menu rather than compete with it. */
const STRIP_COUNT = 5;

/** Past this length the strip's 3-line clamp will cut the quote off, so the
 * card gets a "Read more" that opens it in the overlay. */
const CLAMP_CHARS = 140;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 text-marigold-400" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className={cn("h-3.5 w-3.5", i < rating ? "fill-current" : "opacity-30")} />
      ))}
    </span>
  );
}

function QuoteMark() {
  return (
    <span aria-hidden="true" className="block h-6 font-display text-4xl leading-none text-marigold-400">
      “
    </span>
  );
}

export function Testimonials({
  items,
  rating,
}: {
  items: Testimonial[];
  rating?: ProfileShowcase["rating"];
}) {
  const stripRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  /** Which review to bring into view when the overlay opens from a card's
   * "Read more" — null when opened from "Show all". */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const strip = items.slice(0, STRIP_COUNT);

  const updateArrows = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);

  useEffect(() => {
    if (!overlayOpen || focusIndex === null) return;
    // After the portal has mounted.
    requestAnimationFrame(() =>
      document.getElementById(`testimonial-${focusIndex}`)?.scrollIntoView({ block: "start" })
    );
  }, [overlayOpen, focusIndex]);

  function scrollByCard(direction: 1 | -1) {
    const el = stripRef.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    // One card plus the gap, so each click lands the next card flush left.
    el.scrollBy({ left: direction * (card.getBoundingClientRect().width + 20), behavior: "smooth" });
  }

  function openOverlay(index: number | null) {
    setFocusIndex(index);
    setOverlayOpen(true);
  }

  return (
    <section aria-labelledby="testimonials-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="testimonials-heading" className="font-display text-[28px] leading-tight text-brand-700">
          Kind words
        </h2>
        {rating && (
          <p className="flex items-center gap-1.5 text-[15px] text-neutral-700">
            <Star aria-hidden="true" className="h-4 w-4 fill-current text-marigold-400" />
            <span className="font-semibold text-brand-700">{rating.score}/5</span>
            from {rating.count} ratings on {rating.source}
          </p>
        )}
      </div>

      <ul
        ref={stripRef}
        onScroll={updateArrows}
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {strip.map((t, i) => (
          <li
            key={`${t.name}-${t.date}`}
            className="flex w-[85%] shrink-0 snap-start flex-col rounded-3xl border-[1.5px] border-border bg-surface p-6 sm:w-[340px] lg:w-[360px]"
          >
            <QuoteMark />
            <blockquote className="mt-2 line-clamp-3 text-base leading-relaxed text-neutral-800">{t.quote}</blockquote>
            <div className="mt-auto pt-4">
              <p className="font-bold text-brand-700">{t.name}</p>
              <p className="mt-0.5 text-sm text-neutral-500">{t.date}</p>
              {t.quote.length > CLAMP_CHARS && (
                <button
                  type="button"
                  onClick={() => openOverlay(i)}
                  className="mt-3 text-sm font-semibold text-neutral-600 underline-offset-4 hover:text-brand-700 hover:underline"
                >
                  Read more
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <ArrowButton label="Previous testimonials" disabled={!canPrev} onClick={() => scrollByCard(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </ArrowButton>
          <ArrowButton label="Next testimonials" disabled={!canNext} onClick={() => scrollByCard(1)}>
            <ChevronRight className="h-4 w-4" />
          </ArrowButton>
        </div>
        <button
          type="button"
          onClick={() => openOverlay(null)}
          className="rounded-full border-[1.5px] border-brand-600 px-5 py-2 text-[15px] font-semibold text-brand-600 transition-colors hover:bg-brand-600/5 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
        >
          Show all {items.length}
        </button>
      </div>

      <Modal
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Testimonials"
        description={
          rating
            ? `★ ${rating.score} (${rating.count} ratings) · ${items.length} testimonials`
            : `${items.length} testimonials`
        }
        className="max-w-2xl"
      >
        <ul className="space-y-3 py-1">
          {items.map((t, i) => (
            <li
              key={`${t.name}-${t.date}`}
              id={`testimonial-${i}`}
              className="scroll-mt-2 rounded-2xl border-[1.5px] border-border bg-surface p-5"
            >
              <QuoteMark />
              <blockquote className="mt-2 text-[15px] leading-relaxed text-neutral-800">{t.quote}</blockquote>
              <p className="mt-3 font-bold text-brand-700">{t.name}</p>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-neutral-500">
                <Stars rating={t.rating} />
                {t.rating}/5 · {t.date}
              </p>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-brand-600 bg-surface text-brand-600 transition-colors hover:bg-brand-600/5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-surface"
    >
      {children}
    </button>
  );
}
