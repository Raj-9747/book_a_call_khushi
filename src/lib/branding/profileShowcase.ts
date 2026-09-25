/** Extra, hand-curated content for a public profile page — the social proof
 * and personality that the admin profile table doesn't model (testimonials,
 * follower counts, credentials, FAQs).
 *
 * Keyed by admin slug. Every field is optional and the page renders cleanly
 * without an entry, so an admin with no showcase just gets the plain
 * profile. Move this into the database if it ever needs editing from the
 * dashboard. */
export interface ProfileShowcase {
  /** Short, friendly line under the name — the page's hook. */
  tagline?: string;
  /** Rendered as small chips: "Engineer", "MBA · IIM Udaipur", … */
  credentials?: string[];
  location?: string;
  stats?: { value: string; label: string }[];
  rating?: { score: string; count: number };
  /** Event-type slugs to flag with a "Popular" badge. */
  popularEventSlugs?: string[];
  testimonials?: { quote: string; name: string; role?: string }[];
  faqs?: { question: string; answer: string }[];
}

const KHUSHI: ProfileShowcase = {
  tagline: "Let's have a conversation about content 🎙️",
  location: "Gujju girl in Mumbai",
  credentials: ["Engineer", "MBA · IIM Udaipur", "Ex-Amazon", "Content strategist"],
  stats: [
    { value: "192K", label: "on Instagram" },
    { value: "45+", label: "sessions" },
    { value: "28", label: "testimonials" },
  ],
  rating: { score: "5.0", count: 30 },
  popularEventSlugs: ["content-strategy-for-creators"],
  testimonials: [
    {
      quote:
        "Had a great session with Khushi! She was super friendly, patient, and really understood where I was getting stuck. I left the call with much more clarity and a couple of great content ideas that I'm excited to work on.",
      name: "Manthan",
    },
    {
      quote:
        "Loved chatting with Khushbu about getting started in the digital world. She's talented, knowledgeable, and explains things really clearly. It's refreshing to meet someone with real experience instead of just social media hype.",
      name: "Bharat Chacha",
    },
    {
      quote: "Helped me clear my mind, and at the same time asked questions that were on point.",
      name: "Rishabh Chhaya",
    },
    {
      quote: "It was lovely talking and taking guidance from such an expert.",
      name: "Ali Asaria",
    },
  ],
  faqs: [
    {
      question: "What happens after I book?",
      answer:
        "You'll get a confirmation on email and WhatsApp with a Google Meet link, plus a reminder an hour before we talk.",
    },
    {
      question: "How should I prepare?",
      answer:
        "Come with your questions, your page/profile link, or whatever you're stuck on. The more context you share in the booking form, the more useful our time together.",
    },
    {
      question: "Can I reschedule?",
      answer: "Yes — use the link in your confirmation email to request a new time.",
    },
    {
      question: "Is this a course or a coaching program?",
      answer:
        "Neither! It's a one-on-one conversation. I'm not a guru — just someone who's been around long enough to help with a few things here and there ✨",
    },
  ],
};

// TODO(before launch): confirm Khushi's admin slug and keep only the real one.
const SHOWCASES: Record<string, ProfileShowcase> = {
  khushi: KHUSHI,
  khushbu: KHUSHI,
  "khushbu-chandarana": KHUSHI,
  chashmishkhushi: KHUSHI,
};

export function getProfileShowcase(adminSlug: string): ProfileShowcase {
  return SHOWCASES[adminSlug] ?? {};
}
