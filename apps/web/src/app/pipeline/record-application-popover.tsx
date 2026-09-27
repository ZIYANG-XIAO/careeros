"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  applicationStatusLabel,
  formatResumeVersionLabel,
  useI18n,
} from "@/lib/i18n";
import type { ApplicationStatus, ResumeSummary } from "@/lib/types";

type RecordApplicationPopoverProps = {
  open: boolean;
  jobTitle: string;
  targetStage: ApplicationStatus;
  resumes: ResumeSummary[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (resumeVersionId: string | null) => void;
};

function RecordApplicationPopover({
  open,
  jobTitle,
  targetStage,
  resumes,
  submitting,
  onCancel,
  onConfirm,
}: RecordApplicationPopoverProps) {
  const { t } = useI18n();
  const versions = resumes.flatMap((resume) =>
    resume.versions.map((version) => ({ resume, version })),
  );
  const [selected, setSelected] = useState(() => versions[0]?.version.id ?? "");

  return (
    <Dialog open={open} onClose={onCancel} title={t("record.title")}>
      <p className="text-sm text-ink-2">{t("record.body")}</p>
      <p className="mt-2 text-xs text-ink-3">
        {jobTitle} → {applicationStatusLabel(targetStage, t)}
      </p>
      {versions.length > 0 ? (
        <label className="mt-4 block text-sm font-medium text-ink-2">
          {t("record.resumeLabel")}
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
          >
            {versions.map(({ resume, version }) => (
              <option key={version.id} value={version.id}>
                {formatResumeVersionLabel(
                  resume.name,
                  version.version_number,
                  t,
                )}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-4 text-sm text-ink-3">{t("record.noResume")}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t("record.cancel")}
        </Button>
        <Button
          onClick={() => onConfirm(selected || null)}
          loading={submitting}
        >
          {t("record.confirm")}
        </Button>
      </div>
    </Dialog>
  );
}

export { RecordApplicationPopover };
