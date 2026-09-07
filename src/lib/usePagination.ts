"use client";

import { useEffect, useMemo, useState } from "react";

/** Client-side pagination over an already-loaded list.
 *
 * Deliberately different from the Bookings page, which paginates on the
 * server: bookings grow without bound as history accumulates, so fetching
 * them all would get slower forever. Discount codes, enquiries and change
 * requests are small-N by nature — a few dozen at most — so slicing an
 * array that's already in memory is the right trade here, and avoids
 * rebuilding each of those queries.
 *
 * Switch a list to server-side paging if it ever realistically reaches the
 * high hundreds. */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Deleting the last row on the final page would otherwise strand the user
  // on an empty page with no way back except the Prev button.
  useEffect(() => {
    function clampPage() {
      setPage((current) => Math.min(current, totalPages));
    }
    clampPage();
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    return items.slice(from, from + pageSize);
  }, [items, page, pageSize, totalPages]);

  return { page, setPage, pageSize, totalCount, pageItems };
}
