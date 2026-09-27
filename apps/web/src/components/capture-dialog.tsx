"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createApplication } from "@/lib/api";
import { applicationStatusLabel, useI18n } from "@/lib/i18n";
import type { Application, ApplicationStatus } from "@/lib/types";

const STATUSES: ApplicationStatus[] = [
  "PREPARING",
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "FINAL",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

type CaptureDialogProps = {
  open: boolean;
  onClose: () => void;
  onCaptured?: (application: Application) => void;
};

function CaptureDialog({ open, onClose, onCaptured }: CaptureDialogProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("PREPARING");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCompany("");
    setRole("");
    setApplicationUrl("");
    setStatus("PREPARING");
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const created = await createApplication(token, {
        idempotency_key: crypto.randomUUID(),
        origin: "MANUAL",
        company,
        role,
        application_url: applicationUrl.trim() || null,
        status,
        answers: [],
      });
      onCaptured?.(created);
      reset();
      onClose();
    } catch {
      setError(t("capture.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={t("shell.capture")}>
      <p className="text-sm text-ink-2">{t("capture.description")}</p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-4 space-y-3"
      >
        <Input
          label={t("jobs.company")}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          required
        />
        <Input
          label={t("applications.role")}
          value={role}
          onChange={(event) => setRole(event.target.value)}
          required
        />
        <Input
          label={t("jobs.applicationUrl")}
          type="url"
          value={applicationUrl}
          onChange={(event) => setApplicationUrl(event.target.value)}
        />
        <label className="block text-sm font-medium text-ink-2">
          {t("panel.stage")}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ApplicationStatus)
            }
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            {STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {applicationStatusLabel(candidate, t)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-[#8A4530]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            {t("record.cancel")}
          </Button>
          <Button type="submit" loading={submitting}>
            {t("capture.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export { CaptureDialog };
