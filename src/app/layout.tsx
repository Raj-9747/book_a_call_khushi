import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
// From a plain module, not the "use client" ThemeProvider — see the note in
// src/lib/theme.ts for why that distinction matters here.
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zaptly",
  description: "Zaptly — schedule and manage your calls, leads, and clients.",
};

// Runs before first paint, ahead of React hydrating, so a dark-mode user
// never sees a white flash on load. Deliberately tiny and dependency-free —
// it only reads one localStorage key and toggles one class. Wrapped in
// try/catch because storage access throws outright in some privacy modes.
const THEME_BOOT_SCRIPT = `
(function() {
  try {
    if (localStorage.getItem('${THEME_STORAGE_KEY}') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ConfirmProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
