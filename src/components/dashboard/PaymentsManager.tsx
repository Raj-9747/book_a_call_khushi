"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { Download, Receipt, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, Card, CardContent, Input, Pagination, Select, Spinner } from "@/components/ui";
import {
  fetchPaymentsForExport,
  getPaymentSummary,
  listPayments,
  paymentsToCsv,
  type PaymentRow,
  type PaymentStatusFilter,
  type PaymentSummary,
} from "@/lib/api/payments";

const IST = "Asia/Kolkata";
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

const RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_90", label: "Last 90 days" },
];

/** Month boundaries are computed in IST, matching every other date the
 * admin sees — otherwise "this month" would shift for anyone whose browser
 * sits in a different zone. */
function rangeToDates(range: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (range === "last_90") {
    return { from: new Date(now.getTime() - 90 * 86_400_000), to: null };
  }
  if (range === "this_month" || range === "last_month") {
    const [year, month] = formatInTimeZone(now, IST, "yyyy-MM").split("-").map(Number);
    const startOfThis = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
    if (range === "this_month") return { from: startOfThis, to: null };

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startOfLast = new Date(`${prevYear}-${String(prevMonth).padStart(2, "0")}-01T00:00:00+05:30`);
    return { from: startOfLast, to: startOfThis };
  }
  return { from: null, to: null };
}

function money(amount: number | null): string {
  if (amount === null) return "—";
  return `₹${amount.toLocaleString("en-IN")}`;
}

function statusBadge(row: PaymentRow): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "brand" } {
  switch (row.payment_status) {
    case "paid":
      return { label: "Paid", tone: "success" };
    case "refunded":
      return { label: "Refunded", tone: "neutral" };
    case "partially_refunded":
      return { label: "Part refunded", tone: "warning" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "pending":
      return { label: "Pending", tone: "warning" };
    default:
      return { label: row.payment_status, tone: "neutral" };
  }
}

export function PaymentsManager({ adminId }: { adminId: string }) {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatusFilter>("all");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function handleStatusChange(value: string) {
    setStatus(value as PaymentStatusFilter);
    setPage(1);
  }
  function handleRangeChange(value: string) {
    setRange(value);
    setPage(1);
  }

  useEffect(() => {
    const dates = rangeToDates(range);
    let cancelled = false;

    listPayments(adminId, { page, pageSize: PAGE_SIZE, status, search, from: dates.from, to: dates.to })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setTotalCount(result.totalCount);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load payments");
      });

    // Totals follow the date range only — the status and search filters
    // narrow the list, but "collected this month" should stay the real
    // figure rather than shifting as you search.
    getPaymentSummary(dates.from, dates.to)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        /* Non-fatal — the table is still useful without the totals strip. */
      });

    return () => {
      cancelled = true;
    };
  }, [adminId, page, status, search, range]);

  async function handleExport() {
    setExporting(true);
    try {
      const dates = rangeToDates(range);
      const all = await fetchPaymentsForExport(adminId, { status, search, from: dates.from, to: dates.to });
      if (all.length === 0) {
        toast.info("Nothing to export for these filters.");
        return;
      }

      const blob = new Blob([paymentsToCsv(all)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zaptly-payments-${formatInTimeZone(new Date(), IST, "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} transactions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = search.trim() !== "" || status !== "all" || range !== "all";

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every transaction, and what actually reached you"
        actions={
          <Button variant="outline" isLoading={exporting} onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-8">
        {/* Totals follow the selected date range — the reconciliation view. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Collected</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(summary?.collected ?? 0)}</p>
              <p className="mt-1 text-xs text-neutral-500">{summary?.transactions ?? 0} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Refunded</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(summary?.refunded ?? 0)}</p>
              <p className="mt-1 text-xs text-neutral-500">Returned to clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Net</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">{money(summary?.net ?? 0)}</p>
              <p className="mt-1 text-xs text-neutral-500">Collected minus refunds</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search name, email or payment ID..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select className="sm:w-48" value={status} onChange={handleStatusChange} options={STATUS_OPTIONS} />
          <Select className="sm:w-40" value={range} onChange={handleRangeChange} options={RANGE_OPTIONS} />
        </div>

        {rows === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6 text-neutral-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
            <Receipt className="h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-900">
              {hasFilters ? "No transactions match your filters" : "No payments yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              {hasFilters
                ? "Try a different status or date range."
                : "Paid bookings will show up here once clients start booking."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    <th className="w-12 px-4 py-3">#</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Session</th>
                    <th className="px-6 py-3 text-right">Gross</th>
                    <th className="px-6 py-3 text-right">Paid</th>
                    <th className="px-6 py-3 text-right">Refunded</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Payment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const badge = statusBadge(row);
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0 hover:bg-neutral-50">
                        <td className="px-4 py-3.5 text-neutral-400">{(page - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="px-6 py-3.5 whitespace-nowrap text-neutral-600">
                          {formatInTimeZone(new Date(row.created_at), IST, "MMM d, yyyy")}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-neutral-900">{row.client_name}</p>
                          <p className="break-all text-xs text-neutral-500">{row.client_email}</p>
                        </td>
                        <td className="px-6 py-3.5 text-neutral-600">{row.event_types?.name ?? "—"}</td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap text-neutral-600">
                          {money(row.base_amount)}
                          {row.discount_percent ? (
                            <span className="ml-1.5 text-xs text-success-700">−{row.discount_percent}%</span>
                          ) : null}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap font-medium text-neutral-900">
                          {money(row.amount_paid)}
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap text-neutral-600">
                          {row.refund_amount ? money(row.refund_amount) : "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          {/* The webhook settles this from "processing" to
                              "processed" — surfacing it is the only way to
                              know a refund actually completed. */}
                          {row.refund_status === "processing" && (
                            <p className="mt-1 text-xs text-neutral-400">Refund pending at Razorpay</p>
                          )}
                          {row.refund_status === "failed" && (
                            <p className="mt-1 text-xs text-danger-600">Refund failed — retry from Bookings</p>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="break-all font-mono text-xs text-neutral-500">
                            {row.razorpay_payment_id ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
          </div>
        )}
      </div>
    </>
  );
}
