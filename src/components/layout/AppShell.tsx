"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { ZaptlyLogo } from "@/components/brand/ZaptlyLogo";
import { ZaptlyMark } from "@/components/brand/ZaptlyMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { NAV_ITEMS_BY_SECTION, type NavSection } from "./nav-config";

const SIDEBAR_STORAGE_KEY = "zaptly-sidebar-collapsed";

export function AppShell({
  section,
  userName,
  userRole,
  pendingRequestsCount = 0,
  children,
}: {
  section: NavSection;
  userName: string;
  userRole: string;
  /** Shown as a badge on the "Requests" nav item. Fetched server-side in
   * the layout so it's ready on first paint, not a client-side afterthought. */
  pendingRequestsCount?: number;
  children: React.ReactNode;
}) {
  const navItems = NAV_ITEMS_BY_SECTION[section];
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the desktop collapse preference. Deliberately not part of the
  // boot script in `layout.tsx` (unlike the theme): a brief width animation
  // is far less jarring than a colour flash, and this keeps that script
  // down to the one thing that genuinely can't wait for hydration.
  useEffect(() => {
    function restoreCollapsed() {
      try {
        setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
      } catch {
        // Storage unavailable — just stay expanded.
      }
    }
    restoreCollapsed();
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Preference just won't persist; the toggle still works this session.
      }
      return next;
    });
  }

  // Pick the longest matching href so a parent route (e.g. "/dashboard")
  // doesn't also light up when a more specific child route (e.g.
  // "/dashboard/event-types") is the one actually active.
  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    // h-screen + overflow-hidden makes <main> the only scroll container, so
    // the sidebar stays put instead of scrolling away with long pages.
    <div className="flex h-screen overflow-hidden">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-200/60"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <ZaptlyLogo markClassName="h-7 w-7" />
      </div>

      {/* Mobile backdrop. slate-900, not neutral-900 — the neutral scale
          inverts in dark mode, which would turn this into a light wash. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          "transition-[transform,width] duration-200 md:static md:z-auto md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border",
            collapsed ? "md:justify-center md:px-0" : "justify-between px-6"
          )}
        >
          {/* Collapsed: mark only — the full lockup would overflow a 4rem
              rail. The mark doubles as the expand control, swapping to the
              panel icon on hover, so the toggle stays anchored in the header
              in both states instead of jumping to the footer when collapsed.
              Branding at rest, control on demand. */}
          {collapsed ? (
            <>
              <span className="md:hidden">
                <ZaptlyLogo />
              </span>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                className="group relative hidden h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-neutral-200/60 md:flex"
              >
                <ZaptlyMark className="h-8 w-8 transition-opacity duration-150 group-hover:opacity-0" />
                <PanelLeftOpen className="absolute h-4 w-4 text-neutral-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </button>
            </>
          ) : (
            <ZaptlyLogo />
          )}

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-200/60 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>

          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="hidden rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-700 md:block"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Only the nav list scrolls, and only if it ever outgrows the
            viewport — the logo and account footer stay pinned. */}
        <nav className={cn("flex-1 space-y-1 overflow-y-auto py-4", collapsed ? "md:px-2" : "px-3")}>
          {navItems.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            const badgeCount = item.href === "/dashboard/requests" ? pendingRequestsCount : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "md:justify-center md:px-0",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900"
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {/* Collapsed rail has no room for the count inline, so it
                      becomes a dot on the icon instead of disappearing. */}
                  {collapsed && badgeCount > 0 && (
                    <span className="absolute -right-1 -top-1 hidden h-2 w-2 rounded-full bg-brand-600 md:block" />
                  )}
                </span>

                <span className={cn("flex-1", collapsed && "md:hidden")}>{item.label}</span>

                {badgeCount > 0 && (
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white",
                      collapsed && "md:hidden"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}

                {/* Custom hover label for the collapsed rail — a native
                    `title` tooltip is browser-drawn chrome we can't style
                    (see DEVELOPMENT.md §2). */}
                {collapsed && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-neutral-700 opacity-0 shadow-md transition-opacity md:block md:group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={cn("shrink-0 space-y-1 border-t border-sidebar-border p-3", collapsed && "md:px-2")}>
          <ThemeToggle collapsed={collapsed} />

          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5",
              collapsed && "md:flex-col md:gap-1 md:px-0"
            )}
          >
            <Avatar name={userName} />
            <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
              <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
              <p className="truncate text-xs capitalize text-neutral-500">{userRole.replace("_", " ")}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-700"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-surface-muted pt-14 md:pt-0">{children}</main>
    </div>
  );
}
