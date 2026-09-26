"use client";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-error-message";
import type { ApiError } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";

type LoadErrorBannerProps = {
  error: ApiError;
  onRetry: () => void;
  retryLabel?: string;
  t?: (key: MessageKey) => string;
};

function LoadErrorBanner({
  error,
  onRetry,
  retryLabel,
  t,
}: LoadErrorBannerProps) {
  const label = retryLabel ?? (t ? t("errors.retryDefault") : "Try again");

  return (
    <div
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      role="alert"
    >
      <p>{getApiErrorMessage(error, t)}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        {label}
      </Button>
    </div>
  );
}

export { LoadErrorBanner };
