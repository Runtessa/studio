import React from 'react';
import { Button } from '@/components/ui/Button';

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  total,
  limit,
  onPageChange,
}) => {
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex items-center justify-between px-2 mt-4">
      <div className="text-sm text-textMuted">
        Page {page} of {totalPages}
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
