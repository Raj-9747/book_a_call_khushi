"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

/** Simple prev/next + range indicator — not a page-number strip. With
 * server-side paging the total can be large, and "1 2 3 ... 48 49 50"
 * controls add complexity this app doesn't need yet. */
export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
      <p className="text-sm text-neutral-500">
        <span className="font-medium text-neutral-900">{from}</span>–
        <span className="font-medium text-neutral-900">{to}</span> of{" "}
        <span className="font-medium text-neutral-900">{totalCount}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-neutral-500">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
