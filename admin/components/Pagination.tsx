'use client';

type PaginationProps = {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function Pagination({
  currentPage,
  pageSize,
  totalItems,
  pageSizes = [10, 25, 50],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  const pageButtons = [];
  for (let i = 1; i <= pageCount; i += 1) {
    if (i <= 3 || i > pageCount - 3 || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pageButtons.push(i);
    } else if (pageButtons[pageButtons.length - 1] !== -1) {
      pageButtons.push(-1);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-900">{start}</span>–<span className="font-semibold text-gray-900">{end}</span> of <span className="font-semibold text-gray-900">{totalItems}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ←
          </button>
          {pageButtons.map((page) =>
            page === -1 ? (
              <span key={`dots-${Math.random()}`} className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-2xl text-sm text-gray-500">
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-2xl border px-3 text-sm transition ${
                  page === currentPage
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => onPageChange(currentPage + 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
