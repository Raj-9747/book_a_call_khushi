/** The `admins` columns any logged-in client is allowed to read.
 *
 * `select("*")` can't be used here: `google_refresh_token` has a
 * column-level REVOKE against the `authenticated` role (see 0001_init.sql),
 * so a star-select fails outright. Every admin query shares this list so a
 * new column only has to be added in one place.
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
