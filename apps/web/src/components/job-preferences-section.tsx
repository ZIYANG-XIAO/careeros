"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateJobPreferences } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { JobPreferences } from "@/lib/types";

type JobPreferencesSectionProps = {
  jobPreferences: JobPreferences;
  onSaved: (jobPreferences: JobPreferences) => void;
};

type FormState = {
  target_roles: string;
  cities: string;
  company_sizes: string;
  industries_include: string;
  industries_exclude: string;
  company_blocklist: string;
  minimum_salary: string;
  security_clearance_interest: boolean;
};

const LIST_FIELDS = [
  "target_roles",
  "cities",
  "company_sizes",
  "industries_include",
  "industries_exclude",
  "company_blocklist",
] as const;

function toFormState(preferences: JobPreferences): FormState {
  return {
    target_roles: preferences.target_roles.join(", "),
    cities: preferences.cities.join(", "),
    company_sizes: preferences.company_sizes.join(", "),
    industries_include: preferences.industries_include.join(", "),
    industries_exclude: preferences.industries_exclude.join(", "),
    company_blocklist: preferences.company_blocklist.join(", "),
    minimum_salary: preferences.minimum_salary?.toString() ?? "",
    security_clearance_interest: preferences.security_clearance_interest,
  };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toPayload(form: FormState): Partial<JobPreferences> {
  const parsedSalary = Number.parseInt(form.minimum_salary, 10);
  return {
    target_roles: splitList(form.target_roles),
    cities: splitList(form.cities),
    company_sizes: splitList(form.company_sizes),
    industries_include: splitList(form.industries_include),
    industries_exclude: splitList(form.industries_exclude),
    company_blocklist: splitList(form.company_blocklist),
    minimum_salary: Number.isNaN(parsedSalary) ? null : parsedSalary,
    security_clearance_interest: form.security_clearance_interest,
  };
}

function JobPreferencesSection({
  jobPreferences,
  onSaved,
}: JobPreferencesSectionProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const serverForm = toFormState(jobPreferences);
  const [localEdits, setLocalEdits] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = localEdits !== null;
  const form = localEdits ?? serverForm;

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setSaveSuccess(false);
    setSaveError(null);
    setLocalEdits((current) => ({ ...(current ?? serverForm), [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const token = await getToken();
      if (!token) {
        setSaveError(t("jobPreferences.saveError"));
        return;
      }
      const saved = await updateJobPreferences(token, toPayload(form));
      setLocalEdits(null);
      setSaveSuccess(true);
      onSaved(saved);
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError(t("jobPreferences.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="job-preferences-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2
          id="job-preferences-heading"
          className="text-lg font-semibold text-slate-900"
        >
          {t("jobPreferences.title")}
        </h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {t("jobPreferences.description")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
        aria-busy={saving}
      >
        <p className="text-sm leading-5 text-slate-500">
          {t("jobPreferences.listHint")}
        </p>

        {LIST_FIELDS.map((field) => (
          <Input
            key={field}
            label={t(
              `jobPreferences.${toLabelKey(field)}` as Parameters<typeof t>[0],
            )}
            value={form[field]}
            onChange={(event) => updateField(field, event.target.value)}
          />
        ))}

        <Input
          label={t("jobPreferences.minimumSalary")}
          type="number"
          min={0}
          value={form.minimum_salary}
          onChange={(event) =>
            updateField("minimum_salary", event.target.value)
          }
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.security_clearance_interest}
            onChange={(event) =>
              updateField("security_clearance_interest", event.target.checked)
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          {t("jobPreferences.securityClearanceInterest")}
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? t("jobPreferences.saving") : t("jobPreferences.save")}
          </Button>
          {saveSuccess && (
            <p
              className="text-sm font-medium text-green-700"
              role="status"
              aria-live="polite"
            >
              {t("jobPreferences.saveSuccess")}
            </p>
          )}
          {saveError && (
            <p className="text-sm font-medium text-red-700" role="alert">
              {saveError}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function toLabelKey(field: (typeof LIST_FIELDS)[number]): string {
  const map: Record<(typeof LIST_FIELDS)[number], string> = {
    target_roles: "targetRoles",
    cities: "cities",
    company_sizes: "companySizes",
    industries_include: "industriesInclude",
    industries_exclude: "industriesExclude",
    company_blocklist: "companyBlocklist",
  };
  return map[field];
}

export { JobPreferencesSection };
