"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type DeleteConfirmationProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  entityName: string;
  description?: string;
  error?: string | null;
};

function DeleteConfirmation({
  open,
  onClose,
  onConfirm,
  loading,
  entityName,
  description,
  error,
}: DeleteConfirmationProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`Delete ${entityName}`}>
      <p className="text-sm text-slate-600">
        {description ??
          `Are you sure you want to delete this ${entityName.toLowerCase()}? This action cannot be undone.`}
      </p>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Delete
        </Button>
      </div>
    </Dialog>
  );
}

export { DeleteConfirmation };
