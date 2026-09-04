/** The `admins` columns these functions return to the browser.
 *
 * These functions run with the service_role key, so `select("*")` would
 * succeed — and would hand `google_refresh_token` straight back to the
 * client. The explicit list is the safeguard. Mirrors
 * `src/lib/api/adminColumns.ts` on the frontend; keep the two in sync.
 */
export const ADMIN_COLUMNS = [
  "id",
  "name",
  "email",
  "phone",
  "slug",
  "role",
  "is_active",
  "timezone",
  "google_calendar_connected",
  "photo_url",
  "headline",
  "about",
  "linkedin_url",
  "instagram_url",
  "accepting_bookings",
  "unavailable_message",
  "min_notice_minutes",
  "booking_window_days",
  "created_at",
].join(", ");
