"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CalendarClock, Check, Clock, ListChecks, UserRound } from "lucide-react";
import { Button, Card, CardContent, Modal } from "@/components/ui";
import { GoogleCalendarConnect } from "@/components/dashboard/GoogleCalendarConnect";
import { dismissOnboarding } from "@/lib/api/admins";
import { cn } from "@/lib/utils";

/** Each flag is derived from real data on the server (see the overview
 * page), never from "the user clicked through this" — so a step can't read
 * as done when it isn't. */
export interface OnboardingSteps {
  calendarConnected: boolean;
  profileDone: boolean;
  availabilityDone: boolean;
  eventTypeDone: boolean;
}

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  icon: typeof CalendarClock;
  /** Either an in-app destination, or a custom control (the Google connect
   * button needs its own OAuth redirect, not a route change). */
  href?: string;
  cta?: string;
  custom?: ReactNode;
}

function buildSteps(steps: OnboardingSteps): Step[] {
  return [
    {
      id: "calendar",
      title: "Connect Google Calendar",
      description: "So Zaptly can create a Meet link for every booking and never double-book you.",
      done: steps.calendarConnected,
      icon: CalendarCheck2,
      custom: <GoogleCalendarConnect connected={false} />,
    },
    {
      id: "profile",
      title: "Update your profile",
      description: "Add a photo, headline and a short intro — it's what clients see on your booking page.",
      done: steps.profileDone,
      icon: UserRound,
      href: "/dashboard/profile",
      cta: "Update profile",
    },
    {
      id: "availability",
      title: "Set your availability",
      description: "Choose the days and hours clients can book. Until you do, no slots are shown.",
      done: steps.availabilityDone,
      icon: Clock,
      href: "/dashboard/availability",
      cta: "Set availability",
    },
    {
      id: "event",
      title: "Create your first event type",
      description: "The session clients pick when they book — a name, a duration and a price (or free).",
      done: steps.eventTypeDone,
      icon: ListChecks,
      href: "/dashboard/event-types",
      cta: "Create event type",
    },
  ];
}

function StepRow({
  step,
  index,
  onNavigate,
}: {
  step: Step;
  index: number;
  onNavigate: (href: string) => void;
}) {
  const Icon = step.icon;
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          step.done ? "bg-success-100 text-success-700" : "bg-brand-100 text-brand-700"
        )}
      >
        {step.done ? <Check className="h-4 w-4" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            step.done ? "text-neutral-400 line-through" : "text-neutral-900"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {step.title}
        </p>
        {!step.done && <p className="mt-0.5 text-sm text-neutral-500">{step.description}</p>}
      </div>
      {!step.done && (
        <div className="shrink-0">
          {step.custom ??
            (step.href && (
              <Button variant="outline" size="sm" onClick={() => onNavigate(step.href!)}>
                {step.cta}
              </Button>
            ))}
        </div>
      )}
    </li>
  );
}

/** First-run setup help, in two forms driven by the same steps:
 *
 *  - a popup that opens once, on an admin's first visit, and never again
 *    once they close or skip it (the timestamp lives on the admins row, so
 *    it holds across devices);
 *  - a "Getting started" card on the overview that stays until every step
 *    is genuinely complete — the way back if they skipped the popup.
 *
 * Renders nothing once all four steps are done. */
export function OnboardingGuide({
  adminId,
  firstName,
  steps,
  dismissed,
}: {
  adminId: string;
  firstName: string;
  steps: OnboardingSteps;
  dismissed: boolean;
}) {
  const router = useRouter();
  const list = buildSteps(steps);
  const doneCount = list.filter((s) => s.done).length;
  const allDone = doneCount === list.length;

  const [open, setOpen] = useState(!dismissed && !allDone);

  function close() {
    setOpen(false);
    // Fire and forget — if this write fails the popup just shows once more,
    // which is a far smaller problem than blocking the close on a network call.
    dismissOnboarding(adminId).catch(() => {});
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  if (allDone) return null;

  const percent = Math.round((doneCount / list.length) * 100);

  return (
    <>
      <Card className="border-brand-200 bg-brand-50">
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand-900">Getting started</p>
              <p className="text-sm text-brand-700">
                {doneCount} of {list.length} steps done — finish setup so clients can start booking you.
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-brand-700">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-200">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <ul className="divide-y divide-brand-200/70">
            {list.map((step, i) => (
              <StepRow key={step.id} step={step} index={i} onNavigate={go} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={`Welcome to Zaptly, ${firstName}`}
        description="Four quick steps and clients can start booking you."
        className="max-w-lg"
      >
        <ul className="divide-y divide-border">
          {list.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} onNavigate={go} />
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-neutral-500">This checklist stays on your Overview until you&apos;re done.</p>
          <Button variant="ghost" onClick={close}>
            I&apos;ll do this later
          </Button>
        </div>
      </Modal>
    </>
  );
}
