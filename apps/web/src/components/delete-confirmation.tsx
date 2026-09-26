"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t("delete.titlePrefix")} ${entityName}`}
    >
      <p className="text-sm text-slate-600">{description}</p>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {t("common.delete")}
        </Button>
      </div>
    </Dialog>
  );
}

export { DeleteConfirmation };
