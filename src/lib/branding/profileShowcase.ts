/** Extra, hand-curated copy for a public profile page — the parts of the
 * "Chai Menu" design that the admin profile table doesn't model (the
 * wordmark, the hero line, the highlight chips, a YouTube link, reviews).
 *
 * Keyed by admin slug. Every field is optional and the page falls back to
 * the admin's own profile fields, so an admin with no entry still gets a
 * complete page. Move this into the database if it ever needs editing from
 * the dashboard. */
export interface ProfileShowcase {
  /** Lower-case wordmark in the top bar, e.g. "chashmish khushi". */
  brandName?: string;
  /** The big hero line. */
  heroTitle?: string;
  /** Hero paragraph under the title. */
  intro?: string;
  /** Dashed chips under the intro: credentials, audience size, … */
  highlights?: string[];
  /** Not an admin profile column, so it lives here. */
  youtubeUrl?: string;
  /** Aggregate shown beside the testimonials heading. */
  rating?: { score: number; count: number; source: string };
  testimonials?: Testimonial[];
}

export interface Testimonial {
  quote: string;
  name: string;
  /** Out of 5. */
  rating: number;
  /** Display string, as the review was dated at its source. */
  date: string;
}

// Copied verbatim (spelling and all) from her Topmate reviews on 26 Sep
// 2026 — a stopgap until testimonials are stored per admin in the database.
const KHUSHI_TESTIMONIALS: Testimonial[] = [
  {
    name: "Manthan",
    rating: 5,
    date: "17 Jul 2026",
    quote:
      "Had a great session with Khushi! She was super friendly, patient, and really understood where I was getting stuck. I left the call with much more clarity and a couple of great content ideas that I'm excited to work on. Definitely recommend her if you're looking for honest, practical guidance on your content journey.",
  },
  {
    name: "Atharva Chandkapure",
    rating: 5,
    date: "28 May 2026",
    quote:
      "Had a really insightful conversation with Khushbu. The session was practical, honest, and full of real insights about the creator ecosystem in a very simple and relatable way that helped to gain clarity and direction. She was also very friendly and patient throughout the discussion, which made it super comfortable to ask questions openly. It felt more like a genuine conversation than a formal consultation. Definitely worth it!",
  },
  {
    name: "Bharat Chacha",
    rating: 5,
    date: "19 Aug 2026",
    quote:
      "Loved chatting with Khushbu about getting started in the digital world. Her honest conversation is really attractive. She’s talented, knowledgeable, and explains things really clearly. It’s refreshing to meet someone with real experience instead of just social media hype.",
  },
  {
    name: "Jenil Pipalia",
    rating: 5,
    date: "31 May 2026",
    quote:
      "Khushbu explained the entire process of becoming a content creator so beautifully, clearly and perfectly. She made a complicated process feel very easy to understand. The way she explained things like finding a niche, how to put up with the trend and overcoming camera shyness really clicked for me. Super excited to get started!!!",
  },
  {
    name: "Vivek Tanna",
    rating: 5,
    date: "23 Feb 2026",
    quote:
      "Khushi demonstrated exceptional clarity about my business and problem statements, backed by thorough research. She asked insightful questions about the key challenges I wanted to address through content, and it was clear she already had a well-thought-out strategy blueprint in mind during the call. She patiently addressed all our random queries and provided clear, structured answers throughout. Her content suggestions and references to similar pages and ideas truly testify to her deep knowledge of the field. We genuinely appreciate every piece of advice, Khushi. Thank you so much—kudos to you, and keep going.",
  },
  {
    name: "Priya Vohera",
    rating: 5,
    date: "9 May 2026",
    quote:
      "Hey Khushbu, the session was genuinely very insightful, and also got a very clear path and a whole lot of ideas. And you’re very friendly and also heard me out completely and in fact even motivated me. It was amazing, definitely worth it. Thank you!!",
  },
  {
    name: "Nikhilkumar",
    rating: 5,
    date: "10 Jan 2026",
    quote:
      "I had an amazing and insightful session with Khushbu as a Content Business Strategist. The conversation was extremely valuable and worth my time. She shared practical suggestions, clear advice, and relevant references that helped me gain new clarity and direction. Her approach is thoughtful, well-structured, and grounded in real-world experience. I would highly recommend her to anyone looking to build or scale a content-driven business.",
  },
  {
    name: "Swarup Varu",
    rating: 5,
    date: "28 Apr 2026",
    quote:
      "She knows exactly where you get stuck at the beginning, how you are thinking as a creator, so she will correct you and give solution from her own experience to make your journey smooth and relatable to your audience.",
  },
  {
    name: "Isha Jain",
    rating: 5,
    date: "15 Jan 2026",
    quote:
      "I connected with Khushi for the second time, and once again, I loved her insights. We built on what we discussed in our first call and also addressed other doubts I had. As always, Khushi is friendly, warm, and makes you feel instantly comfortable. She has great insights into media, career transitions, and how to navigate them. Really loved connecting with her!",
  },
  {
    name: "Vishwa Joshi",
    rating: 5,
    date: "10 Jan 2026",
    quote:
      "I had a wonderful discussion with Khushi. She took the time to study my content in depth, pointing out both my strengths and areas for improvement, which was extremely helpful. She also shared her personal experiences, making it easy for me to relate and reflect. Above all, she has a very warm and charming vibe, which made me feel comfortable sharing my concerns openly.",
  },
  {
    name: "Rishabh Chhaya",
    rating: 5,
    date: "17 Jul 2026",
    quote: "Helped me clear my mind, at the same time asked questions that were on point",
  },
  {
    name: "Naimish Pandya",
    rating: 5,
    date: "23 Aug 2025",
    quote:
      "I had a wonderful discussion with Khushbu, where she shared her journey and gave me clear, practical feedback on content creation in the tech world. Her insights on creating authentic content with the right mindset were truly inspiring. Highly recommend connecting with her!",
  },
  {
    name: "Kunj Jaydeep Rathi",
    rating: 5,
    date: "29 Oct 2025",
    quote:
      "Very Good, she was so perfect on each and every point helped me the main this is she listened me very carefully and when durations goes above time limit she said don’t worry you ask all your questions I will answer you which felt so good genuinely my heart is full with here helping nature and friendly nature. The Perfect Person to approach when you are blank in life or cannot make decisions. Thanks Alot Khushi ❤️✨",
  },
  {
    name: "Ankusha Patil",
    rating: 5,
    date: "19 Aug 2025",
    quote:
      "Hey Khushi, It was so refreshing to connect with you. Your insights on content creation gave me a new perspective on pursuing it as a career. Thank you for your valuable time — it was indeed great connecting with you.",
  },
  {
    name: "Jay Bhatt",
    rating: 5,
    date: "10 Apr 2025",
    quote:
      "Thank you very much Khushi for your valuable knowledge and feedback,it really helped me to know more things about content creation and what strategy I should use to grow more, will connect with you in future to learn even more things 🤝",
  },
];

const KHUSHI: ProfileShowcase = {
  brandName: "chashmish khushi",
  heroTitle: "Let's talk over a cutting chai.",
  intro:
    "Hi, I'm Khushbu — Gujju girl in Mumbai and the creator behind @chashmishkhushi. Pick what you need and grab a time that works for you.",
  highlights: ["IIM Udaipur", "ex-Amazon", "ex-Media", "181K on Instagram"],
  youtubeUrl: "https://www.youtube.com/@chashmishkhushi",
  rating: { score: 5, count: 30, source: "Topmate" },
  testimonials: KHUSHI_TESTIMONIALS,
};

const SHOWCASES: Record<string, ProfileShowcase> = {
  "khushbu-chandarana": KHUSHI,
};

export function getProfileShowcase(adminSlug: string): ProfileShowcase {
  return SHOWCASES[adminSlug] ?? {};
}
