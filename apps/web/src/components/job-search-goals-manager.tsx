"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createJobSearchGoal, updateJobSearchGoal } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  CreateJobSearchGoalRequest,
  JobSearchGoal,
  JobSearchGoalMarket,
  ResumeSummary,
} from "@/lib/types";

type FormState = {
  name: string;
  market: JobSearchGoalMarket;
  country_codes: string[];
  target_roles: string;
  cities: string;
  workplace_types: Array<"ONSITE" | "HYBRID" | "REMOTE">;
  employment_types: Array<
    "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP"
  >;
  minimum_salary: string;
  salary_currency: string;
  default_resume_id: string;
  security_clearance_interest: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  market: "NORTH_AMERICA",
  country_codes: ["US"],
  target_roles: "",
  cities: "",
  workplace_types: [],
  employment_types: ["FULL_TIME"],
  minimum_salary: "",
  salary_currency: "USD",
  default_resume_id: "",
  security_clearance_interest: false,
};

function splitList(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formFromGoal(goal: JobSearchGoal): FormState {
  return {
    name: goal.name,
    market: goal.market,
    country_codes: goal.country_codes,
    target_roles: goal.target_roles.join(", "),
    cities: goal.cities.join(", "),
    workplace_types: goal.workplace_types,
    employment_types: goal.employment_types,
    minimum_salary: goal.minimum_salary?.toString() ?? "",
    salary_currency: goal.salary_currency ?? "",
    default_resume_id: goal.default_resume_id ?? "",
    security_clearance_interest: goal.security_clearance_interest,
  };
}

function payloadFromForm(form: FormState): CreateJobSearchGoalRequest {
  const minimumSalary = Number.parseInt(form.minimum_salary, 10);
  return {
    name: form.name.trim(),
    market: form.market,
    country_codes: form.country_codes,
    target_roles: splitList(form.target_roles),
    cities: splitList(form.cities),
    workplace_types: form.workplace_types,
    employment_types: form.employment_types,
    company_sizes: [],
    industries_include: [],
    industries_exclude: [],
    company_blocklist: [],
    minimum_salary: Number.isNaN(minimumSalary) ? null : minimumSalary,
    salary_currency: Number.isNaN(minimumSalary)
      ? null
      : form.salary_currency || null,
    default_resume_id: form.default_resume_id || null,
    security_clearance_interest: form.security_clearance_interest,
    is_active: false,
  };
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function JobSearchGoalsManager({
  initialGoals,
  resumes,
}: {
  initialGoals: JobSearchGoal[];
  resumes: ResumeSummary[];
}) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [goals, setGoals] = useState(initialGoals);
  const [editingId, setEditingId] = useState<string | null>(
    initialGoals.find((goal) => goal.is_active)?.id ??
      initialGoals[0]?.id ??
      null,
  );
  const selectedGoal = goals.find((goal) => goal.id === editingId) ?? null;
  const [draft, setDraft] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form =
    draft ?? (selectedGoal ? formFromGoal(selectedGoal) : EMPTY_FORM);
  const activeGoal = useMemo(
    () => goals.find((goal) => goal.is_active) ?? null,
    [goals],
  );

  function chooseGoal(goal: JobSearchGoal) {
    setEditingId(goal.id);
    setDraft(null);
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_FORM, country_codes: [...EMPTY_FORM.country_codes] });
    setError(null);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setDraft((current) => ({ ...(current ?? form), [key]: value }));
    setError(null);
  }

  function changeMarket(market: JobSearchGoalMarket) {
    updateForm("market", market);
    setDraft((current) => ({
      ...(current ?? form),
      market,
      country_codes:
        market === "CHINA" ? ["CN"] : market === "NORTH_AMERICA" ? ["US"] : [],
      salary_currency:
        market === "CHINA" ? "CNY" : market === "NORTH_AMERICA" ? "USD" : "",
      security_clearance_interest:
        market === "NORTH_AMERICA"
          ? (current ?? form).security_clearance_interest
          : false,
    }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const payload = payloadFromForm(form);
      const saved = selectedGoal
        ? await updateJobSearchGoal(token, selectedGoal.id, payload)
        : await createJobSearchGoal(token, payload);
      setGoals((current) => {
        const exists = current.some((goal) => goal.id === saved.id);
        const next = exists
          ? current.map((goal) => (goal.id === saved.id ? saved : goal))
          : [...current, saved];
        return next.sort((a, b) => Number(b.is_active) - Number(a.is_active));
      });
      setEditingId(saved.id);
      setDraft(null);
    } catch {
      setError(t("goals.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function activate(goal: JobSearchGoal) {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const active = await updateJobSearchGoal(token, goal.id, {
        is_active: true,
      });
      setGoals((current) =>
        current
          .map((item) => ({
            ...item,
            is_active: item.id === active.id,
            updated_at:
              item.id === active.id ? active.updated_at : item.updated_at,
          }))
          .sort((a, b) => Number(b.is_active) - Number(a.is_active)),
      );
      setEditingId(active.id);
      setDraft(null);
    } catch {
      setError(t("goals.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {t("goals.eyebrow")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {t("goals.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
            {t("goals.description")}
          </p>
        </div>
        <Button onClick={startNew}>{t("goals.add")}</Button>
      </header>

      {activeGoal && (
        <div className="rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-sm text-ink-2">
          {t("goals.activeSummary", { name: activeGoal.name })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {goals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-ink-3">
              {t("goals.empty")}
            </div>
          ) : (
            goals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => chooseGoal(goal)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  editingId === goal.id
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface hover:bg-rail"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{goal.name}</span>
                  {goal.is_active && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {t("goals.active")}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-ink-3">
                  {t(`goals.market.${goal.market}` as never)}
                  {goal.target_roles.length > 0
                    ? ` · ${goal.target_roles.join(", ")}`
                    : ""}
                </span>
              </button>
            ))
          )}
        </aside>

        <form
          onSubmit={(event) => void handleSave(event)}
          className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              {selectedGoal ? t("goals.edit") : t("goals.create")}
            </h2>
            {selectedGoal && !selectedGoal.is_active && (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void activate(selectedGoal)}
              >
                {t("goals.makeActive")}
              </Button>
            )}
          </div>

          <Input
            id="goal-name"
            label={t("goals.name")}
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            required
            maxLength={100}
          />

          <label className="block space-y-1 text-sm font-medium text-ink-2">
            <span>{t("goals.market")}</span>
            <select
              value={form.market}
              onChange={(event) =>
                changeMarket(event.target.value as JobSearchGoalMarket)
              }
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="NORTH_AMERICA">
                {t("goals.market.NORTH_AMERICA")}
              </option>
              <option value="CHINA">{t("goals.market.CHINA")}</option>
            </select>
          </label>

          {form.market === "NORTH_AMERICA" && (
            <fieldset>
              <legend className="text-sm font-medium text-ink-2">
                {t("goals.countries")}
              </legend>
              <div className="mt-2 flex gap-4">
                {["US", "CA"].map((country) => (
                  <label
                    key={country}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.country_codes.includes(country)}
                      onChange={() =>
                        updateForm(
                          "country_codes",
                          toggleValue(form.country_codes, country),
                        )
                      }
                    />
                    {t(`goals.country.${country}` as never)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="goal-roles"
              label={t("goals.roles")}
              value={form.target_roles}
              onChange={(event) =>
                updateForm("target_roles", event.target.value)
              }
              placeholder={t("goals.rolesPlaceholder")}
              required
            />
            <Input
              id="goal-cities"
              label={t("goals.cities")}
              value={form.cities}
              onChange={(event) => updateForm("cities", event.target.value)}
              placeholder={t("goals.citiesPlaceholder")}
            />
          </div>

          <ChoiceGroup
            legend={t("goals.workplace")}
            values={form.workplace_types}
            choices={["ONSITE", "HYBRID", "REMOTE"]}
            label={(choice) => t(`goals.workplace.${choice}` as never)}
            onToggle={(choice) =>
              updateForm(
                "workplace_types",
                toggleValue(form.workplace_types, choice),
              )
            }
          />
          <ChoiceGroup
            legend={t("goals.employment")}
            values={form.employment_types}
            choices={["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]}
            label={(choice) => t(`goals.employment.${choice}` as never)}
            onToggle={(choice) =>
              updateForm(
                "employment_types",
                toggleValue(form.employment_types, choice),
              )
            }
          />

          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Input
              id="goal-minimum-salary"
              label={t("goals.minimumSalary")}
              type="number"
              min={0}
              value={form.minimum_salary}
              onChange={(event) =>
                updateForm("minimum_salary", event.target.value)
              }
            />
            <Input
              id="goal-currency"
              label={t("goals.currency")}
              value={form.salary_currency}
              onChange={(event) =>
                updateForm("salary_currency", event.target.value.toUpperCase())
              }
              maxLength={3}
              placeholder={form.market === "CHINA" ? "CNY" : "USD"}
            />
          </div>

          <label className="block space-y-1 text-sm font-medium text-ink-2">
            <span>{t("goals.defaultResume")}</span>
            <select
              value={form.default_resume_id}
              onChange={(event) =>
                updateForm("default_resume_id", event.target.value)
              }
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{t("goals.noDefaultResume")}</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.name}
                </option>
              ))}
            </select>
          </label>

          {form.market === "NORTH_AMERICA" && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={form.security_clearance_interest}
                onChange={(event) =>
                  updateForm(
                    "security_clearance_interest",
                    event.target.checked,
                  )
                }
              />
              {t("goals.securityClearance")}
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-[#6F3627]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving ? t("goals.saving") : t("goals.save")}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  values,
  choices,
  label,
  onToggle,
}: {
  legend: string;
  values: T[];
  choices: T[];
  label: (choice: T) => string;
  onToggle: (choice: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink-2">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {choices.map((choice) => (
          <label
            key={choice}
            className="flex items-center gap-2 text-sm text-ink-2"
          >
            <input
              type="checkbox"
              checked={values.includes(choice)}
              onChange={() => onToggle(choice)}
            />
            {label(choice)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { JobSearchGoalsManager };
