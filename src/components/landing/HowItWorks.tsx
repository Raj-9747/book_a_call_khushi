import { SectionHeading } from "./SectionHeading";

const STEPS = [
  {
    number: "01",
    title: "Share your link",
    body: "Every admin gets their own page at /book/your-name, listing the sessions you offer with their duration and price.",
  },
  {
    number: "02",
    title: "The client books and pays",
    body: "They pick from slots that are genuinely open, answer whatever you asked, apply a discount code if they have one, and pay.",
  },
  {
    number: "03",
    title: "Everything else runs itself",
    body: "The Meet link gets created, both calendars get the invite, the confirmation goes out, and an hour before the call the reminder does too.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, then it is hands-off"
          description="The point is that after you have shared the link, there is nothing left for you to do manually."
        />

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line between steps on wide screens */}
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[calc(2.5rem+1px)] top-10 hidden h-px w-[calc(100%-2.5rem)] bg-border md:block"
                />
              )}
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-semibold text-brand-700">
                {step.number}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-neutral-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
