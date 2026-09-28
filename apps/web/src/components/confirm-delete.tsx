"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type ConfirmDeleteProps = {
  /** Button label, e.g. "Delete job". */
  label: string;
  /** What will be lost, shown before the user confirms. */
  warning: string;
  onConfirm: () => Promise<void>;
};

/**
 * Two-step inline delete: the first click only reveals the warning, so a
 * destructive action never happens on a single mis-click and no browser
 * confirm() dialog is needed.
 */
function ConfirmDelete({ label, warning, onConfirm }: ConfirmDeleteProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : t("delete.failed"),
      );
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        className="self-start text-[#8A4530]"
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 rounded-lg border border-[#8A4530]/40 p-3"
    >
      <p className="text-sm text-ink">{warning}</p>
      {error && (
        <p role="alert" className="text-sm text-[#8A4530]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="danger"
          loading={deleting}
          onClick={() => void handleConfirm()}
        >
          {t("delete.confirm")}
        </Button>
        <Button
          variant="secondary"
          disabled={deleting}
          onClick={() => setConfirming(false)}
        >
          {t("delete.cancel")}
        </Button>
      </div>
    </div>
  );
}

export { ConfirmDelete };
