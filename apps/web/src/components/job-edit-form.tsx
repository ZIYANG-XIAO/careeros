"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateJob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Job } from "@/lib/types";

/** Edits a job's listing fields; the captured description stays immutable. */
function JobEditForm({
  job,
  onSaved,
  onCancel,
}: {
  job: Job;
  onSaved: (job: Job) => void;
  onCancel: () => void;
}) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [company, setCompany] = useState(job.company);
  const [title, setTitle] = useState(job.title);
  const [location, setLocation] = useState(job.location ?? "");
  const [applicationUrl, setApplicationUrl] = useState(
    job.application_url ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      onSaved(
        await updateJob(token, job.id, {
          company: company.trim(),
          title: title.trim(),
          location: location.trim() || null,
          application_url: applicationUrl.trim() || null,
        }),
      );
    } catch {
      setError(t("jobs.edit.error"));
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <Input
        id="job-edit-title"
        label={t("jobs.jobTitle")}
        value={title}
        required
        maxLength={500}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        id="job-edit-company"
        label={t("jobs.company")}
        value={company}
        required
        maxLength={500}
        onChange={(event) => setCompany(event.target.value)}
      />
      <Input
        id="job-edit-location"
        label={t("jobs.location")}
        value={location}
        maxLength={500}
        onChange={(event) => setLocation(event.target.value)}
      />
      <Input
        id="job-edit-url"
        type="url"
        label={t("jobs.applicationUrl")}
        value={applicationUrl}
        onChange={(event) => setApplicationUrl(event.target.value)}
      />
      <p className="text-xs text-ink-3">{t("jobs.edit.descriptionFixed")}</p>
      {error && (
        <p role="alert" className="text-sm text-[#8A4530]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {t("jobs.edit.save")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={onCancel}
        >
          {t("delete.cancel")}
        </Button>
      </div>
    </form>
  );
}

export { JobEditForm };
