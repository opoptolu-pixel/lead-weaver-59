import { useState, useMemo } from "react";

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
) {
  const { initialPage = 1, initialPageSize = 25 } = options;
  
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const goToPage = (page: number) => {
    const validPage = Math.min(Math.max(1, page), totalPages || 1);
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Reset to page 1 when data changes significantly
  const resetPage = () => setCurrentPage(1);

  return {
    paginatedData,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
