import { createClient } from "@/lib/supabase/client";

export type PaymentStatusFilter = "all" | "paid" | "pending" | "failed" | "refunded" | "partially_refunded";

export interface PaymentRow {
  id: string;
  created_at: string;
  start_time: string;
  client_name: string;
  client_email: string;
  status: string;
  payment_status: string;
  base_amount: number | null;
  discount_percent: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  refund_amount: number | null;
  refund_status: string | null;
  refunded_at: string | null;
  razorpay_payment_id: string | null;
  event_types: { name: string } | null;
}

export interface PaymentSummary {
  collected: number;
  refunded: number;
  net: number;
  transactions: number;
}

export interface ListPaymentsParams {
  page: number;
  pageSize: number;
  status: PaymentStatusFilter;
  search?: string;
  from?: Date | null;
  to?: Date | null;
}

const SELECT =
  "id, created_at, start_time, client_name, client_email, status, payment_status, base_amount, " +
  "discount_percent, amount_due, amount_paid, refund_amount, refund_status, refunded_at, " +
  "razorpay_payment_id, event_types(name)";

function normalize(row: Record<string, unknown>): PaymentRow {
  // Postgres `numeric` arrives as a string over PostgREST — coerce every
  // money field once here so no caller has to remember which are numeric.
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...row,
    base_amount: num(row.base_amount),
    amount_due: num(row.amount_due),
    amount_paid: num(row.amount_paid),
    refund_amount: num(row.refund_amount),
  } as unknown as PaymentRow;
}

/** Applies the shared filters. Kept in one place so the paginated list and
 * the CSV export can never drift into exporting a different set than the
 * one on screen. */
function applyFilters<T extends { eq: (c: string, v: unknown) => T; gte: (c: string, v: string) => T; lt: (c: string, v: string) => T; or: (f: string) => T; not: (c: string, op: string, v: unknown) => T }>(
  query: T,
  params: Pick<ListPaymentsParams, "status" | "search" | "from" | "to">
): T {
  // A payments page lists transactions — a free booking never had one.
  let q = query.not("amount_paid", "is", null);

  if (params.status !== "all") q = q.eq("payment_status", params.status);
  if (params.from) q = q.gte("created_at", params.from.toISOString());
  if (params.to) q = q.lt("created_at", params.to.toISOString());

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%,]/g, "\\$&");
    q = q.or(`client_name.ilike.%${escaped}%,client_email.ilike.%${escaped}%,razorpay_payment_id.ilike.%${escaped}%`);
  }
  return q;
}

export async function listPayments(
  adminId: string,
  params: ListPaymentsParams
): Promise<{ rows: PaymentRow[]; totalCount: number }> {
  const supabase = createClient();
  const from = (params.page - 1) * params.pageSize;

  let query = supabase
    .from("bookings")
    .select(SELECT, { count: "exact" })
    .eq("admin_id", adminId);

  query = applyFilters(query as never, params) as never;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + params.pageSize - 1);

  if (error) throw error;
  return {
    rows: (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>)),
    totalCount: count ?? 0,
  };
}

export async function getPaymentSummary(from?: Date | null, to?: Date | null): Promise<PaymentSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_payment_summary", {
    p_from: from?.toISOString() ?? null,
    p_to: to?.toISOString() ?? null,
  });
  if (error) throw error;

  const summary = (data ?? {}) as Record<string, unknown>;
  return {
    collected: Number(summary.collected ?? 0),
    refunded: Number(summary.refunded ?? 0),
    net: Number(summary.net ?? 0),
    transactions: Number(summary.transactions ?? 0),
  };
}

/** Fetches every row matching the current filters, ignoring pagination —
 * used only for the CSV export, where "just this page" would be useless for
 * reconciliation or filing. */
export async function fetchPaymentsForExport(
  adminId: string,
  params: Pick<ListPaymentsParams, "status" | "search" | "from" | "to">
): Promise<PaymentRow[]> {
  const supabase = createClient();
  let query = supabase.from("bookings").select(SELECT).eq("admin_id", adminId);
  query = applyFilters(query as never, params) as never;

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as unknown as Record<string, unknown>));
}

/** RFC-4180-ish escaping: wrap in quotes and double any inner quote, so a
 * client name containing a comma can't shift every later column. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function paymentsToCsv(rows: PaymentRow[]): string {
  const header = [
    "Date",
    "Client",
    "Email",
    "Session",
    "Session date",
    "Gross",
    "Discount %",
    "Charged",
    "Paid",
    "Refunded",
    "Status",
    "Razorpay payment ID",
  ];

  const lines = rows.map((row) =>
    [
      new Date(row.created_at).toISOString(),
      row.client_name,
      row.client_email,
      row.event_types?.name ?? "",
      new Date(row.start_time).toISOString(),
      row.base_amount ?? "",
      row.discount_percent ?? "",
      row.amount_due ?? "",
      row.amount_paid ?? "",
      row.refund_amount ?? "",
      row.payment_status,
      row.razorpay_payment_id ?? "",
    ]
      .map(csvCell)
      .join(",")
  );

  return [header.map(csvCell).join(","), ...lines].join("\n");
}
