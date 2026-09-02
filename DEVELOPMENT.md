# Zaptly — Development Conventions

Standing rules for how this codebase gets built, checked before every feature is considered done. Read this before starting new work and before wrapping up a change.

## 1. Responsiveness is not optional

Every screen and component must work at mobile widths (~375px), tablet (~768px), and desktop — not just desktop. Concretely:

- New pages: use `p-4 sm:p-8` (or similar) content padding, never a flat `p-8`.
- New tables: wrap in `overflow-x-auto` with a `min-w-[…]` on the `<table>` so it scrolls horizontally instead of squashing on narrow screens — see `AdminsTable.tsx`.
- Prefer stacking cards over dense tables when content is variable-length (descriptions, multi-line data) — better mobile UX, see `EventTypesList`.
- Modals (`Modal.tsx`) already constrain to `max-w-*` with outer padding — keep new modal content scrollable (`max-h-[…] overflow-y-auto`) if it can grow long (e.g. dynamic form fields).
- The app shell (`AppShell.tsx`) already handles the sidebar → mobile drawer pattern — don't rebuild navigation per-section, extend `nav-config.tsx` instead.
- Headers use `PageHeader` (already responsive: stacks title/actions on narrow screens) — reuse it, don't hand-roll new page headers.

## 2. Edge cases to check after every functionality change

Not exhaustive, but the standing checklist before calling a feature "done":

- **Empty states**: what does the screen look like with zero rows/items?
- **Loading states**: is there a spinner/skeleton instead of a blank flash?
- **Error states**: does a failed request show a clear toast, not a silent failure or raw error dump?
- **Duplicate/conflict data**: does creating something with an already-used unique value (email, slug) give a clean message, not a raw DB error?
- **Permission boundaries**: does RLS actually block a role from seeing/editing data it shouldn't (test by trying, not just by reading the policy)?
- **Destructive actions**: is there a confirmation before delete/remove? Does delete correctly cascade or correctly *not* cascade where it shouldn't (e.g. event types with existing bookings)?
- **Long content**: names/descriptions that are very long — do they truncate/wrap instead of breaking layout?
- **Portal/dropdown/modal interactions**: does closing-on-outside-click still allow clicking the menu/modal's own contents? (Known past bug — see `ActionsMenu.tsx`.)

## 3. Quick regression pass (run after any change, not just in the area you touched)

Because features share the auth/layout foundation, a change in one area can silently break another. After any change, spot-check:

1. **Login** — super-admin and a regular admin can both log in and land on the correct section (`/admin` vs `/dashboard`).
2. **Nav/logout** — sidebar nav links work, logout works, mobile hamburger opens/closes the drawer.
3. **Manage Admins** (super-admin) — add, edit (name/email/password reset), deactivate/reactivate, remove all still work; duplicate email gives the clean error.
4. **Settings** — change-password form works for both roles.
5. **Responsive check** — resize to ~375px width on at least the page you changed and one you didn't, confirm nothing overflows/clips.
6. **Build check** — `npm run lint` and `npm run build` both pass clean before considering a change finished.

## 4. Where things live (avoid duplicating)

- Reusable primitives: `src/components/ui/` (Button, Input, Modal, ActionsMenu, Switch, etc.) — check here before writing a new one-off.
- Layout shell: `src/components/layout/` (AppShell, PageHeader, nav-config).
- Per-domain API calls: `src/lib/api/` (one file per resource, e.g. `admins.ts`, `eventTypes.ts`) — plain Supabase client calls, RLS does the authorization.
- Validation schemas: `src/lib/validations/`.
- Server-only Supabase clients/helpers: `src/lib/supabase/`.
- Anything needing the `service_role` key: a Supabase Edge Function in `supabase/functions/`, never in frontend code.
