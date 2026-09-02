import { type LucideIcon, LayoutDashboard, Users } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Icon components can't cross the server -> client boundary as props, so the
// nav config lives here and is imported directly by the client-side AppShell
// instead of being passed down from a server layout.
export const NAV_ITEMS_BY_SECTION = {
  admin: [{ label: "Admins", href: "/admin", icon: Users }] satisfies NavItem[],
  dashboard: [{ label: "Overview", href: "/dashboard", icon: LayoutDashboard }] satisfies NavItem[],
} as const;

export type NavSection = keyof typeof NAV_ITEMS_BY_SECTION;
