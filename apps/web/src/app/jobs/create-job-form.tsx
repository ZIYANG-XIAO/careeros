import { type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MessageKey } from "@/lib/i18n";

import { selectClass } from "./job-filters";

export function CreateJobForm({
  creating,
  onCreate,
  t,
}: {
  creating: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <details
      id="add-job"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 marker:hidden sm:px-6">
        {t("jobs.addManual")}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {t("jobs.addManualHint")}
        </span>
      </summary>
      <form
        className="grid gap-4 border-t border-slate-100 p-5 sm:grid-cols-2 sm:p-6"
        onSubmit={onCreate}
      >
        <Input
          label={t("jobs.company")}
          name="company"
          required
          maxLength={500}
        />
        <Input
          label={t("jobs.jobTitle")}
          name="title"
          required
          maxLength={500}
        />
        <Input
          label={t("jobs.optionalLocation")}
          name="location"
          maxLength={500}
        />
        <Input
          label={t("jobs.sourceUrl")}
          name="source_url"
          type="url"
          placeholder="https://…"
        />
        <div className="sm:col-span-2">
          <Input
            label={t("jobs.applicationUrl")}
            name="application_url"
            type="url"
            placeholder="https://…"
          />
        </div>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.market")}</span>
          <select className={selectClass} name="market" defaultValue="UNKNOWN">
            <option value="UNKNOWN">{t("jobs.unknown")}</option>
            <option value="NORTH_AMERICA">{t("jobs.northAmerica")}</option>
            <option value="CHINA">{t("jobs.china")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.country")}</span>
          <select
            className={selectClass}
            name="country_code"
            defaultValue="UNKNOWN"
          >
            <option value="UNKNOWN">{t("jobs.unknown")}</option>
            <option value="US">{t("jobs.us")}</option>
            <option value="CA">{t("jobs.ca")}</option>
            <option value="CN">{t("jobs.cn")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.workplace")}</span>
          <select
            className={selectClass}
            name="workplace_type"
            defaultValue="UNKNOWN"
          >
            <option value="UNKNOWN">{t("jobs.unknown")}</option>
            <option value="REMOTE">{t("jobs.remote")}</option>
            <option value="HYBRID">{t("jobs.hybrid")}</option>
            <option value="ONSITE">{t("jobs.onsite")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span className="block">{t("jobs.employment")}</span>
          <select
            className={selectClass}
            name="employment_type"
            defaultValue="UNKNOWN"
          >
            <option value="UNKNOWN">{t("jobs.unknown")}</option>
            <option value="FULL_TIME">{t("jobs.fullTime")}</option>
            <option value="PART_TIME">{t("jobs.partTime")}</option>
            <option value="CONTRACT">{t("jobs.contract")}</option>
            <option value="INTERNSHIP">{t("jobs.internship")}</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Textarea
            label={t("jobs.description")}
            name="description"
            required
            minLength={20}
            rows={10}
            placeholder={t("jobs.descriptionPlaceholder")}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">{t("jobs.manualPrivacy")}</p>
          <Button type="submit" disabled={creating}>
            {creating ? t("jobs.parsing") : t("jobs.addJob")}
          </Button>
        </div>
      </form>
    </details>
  );
}
