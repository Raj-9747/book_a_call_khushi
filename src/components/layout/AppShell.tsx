"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NAV_ITEMS_BY_SECTION, type NavSection } from "./nav-config";

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
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            Z
          </div>
          <span className="text-base font-semibold text-neutral-900">Zaptly</span>
        </div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-neutral-900/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              Z
            </div>
            <span className="text-base font-semibold text-neutral-900">Zaptly</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/dashboard/requests" && pendingRequestsCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                    {pendingRequestsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <Avatar name={userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
              <p className="truncate text-xs capitalize text-neutral-500">{userRole.replace("_", " ")}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              title="Sign out"
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
