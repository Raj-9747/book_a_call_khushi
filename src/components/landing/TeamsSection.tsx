import { LayoutDashboard, ShieldCheck, Users } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const CARDS = [
  {
    icon: Users,
    title: "A page each",
    body: "Add as many admins as you need. Everyone gets their own link, their own hours, their own session types and their own prices.",
  },
  {
    icon: ShieldCheck,
    title: "Kept separate",
    body: "One admin cannot see another admin's bookings, clients or notes. That separation is enforced by the database, not by hiding a button.",
  },
  {
    icon: LayoutDashboard,
    title: "Every booking is a lead",
    body: "Notes, tags and the answers to your intake questions sit on each booking — searchable, filterable, and yours to work through.",
  },
];

export function TeamsSection() {
  return (
    <section className="border-t border-border bg-surface-muted py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="For teams"
          title="Built for more than one calendar"
          description="Sales, delivery, founders — each running their own schedule, under one roof."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {CARDS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-6 shadow-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
