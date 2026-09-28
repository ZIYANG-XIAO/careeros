"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createApplicationActivity,
  updateApplicationActivity,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ApplicationActivity, ApplicationActivityType } from "@/lib/types";

function activityDate(locale: string, value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function datetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function ApplicationActivitySection({
  applicationId,
  initialActivities,
}: {
  applicationId: string;
  initialActivities: ApplicationActivity[];
}) {
  const { getToken } = useAuth();
  const { locale, t } = useI18n();
  const [activities, setActivities] = useState(initialActivities);
  const [type, setType] = useState<ApplicationActivityType>("FOLLOW_UP");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const scheduledValue = String(data.get("scheduled_at") ?? "");
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const created = await createApplicationActivity(token, applicationId, {
        idempotency_key: crypto.randomUUID(),
        activity_type: type,
        title: String(data.get("title") ?? ""),
        body: String(data.get("body") ?? "") || null,
        scheduled_at:
          type === "NOTE" ? null : new Date(scheduledValue).toISOString(),
      });
      setActivities((current) => [...current, created]);
      form.reset();
      setType("FOLLOW_UP");
    } catch {
      setError(t("activity.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted(activity: ApplicationActivity) {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateApplicationActivity(
        token,
        applicationId,
        activity.id,
        { completed: activity.completed_at === null },
      );
      setActivities((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError(t("activity.saveError"));
    }
  }

  async function handleEdit(
    event: FormEvent<HTMLFormElement>,
    activity: ApplicationActivity,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const scheduledValue = String(data.get("scheduled_at") ?? "");
    setEditingId(activity.id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateApplicationActivity(
        token,
        applicationId,
        activity.id,
        {
          title: String(data.get("title") ?? ""),
          body: String(data.get("body") ?? "") || null,
          ...(activity.activity_type === "NOTE"
            ? {}
            : { scheduled_at: new Date(scheduledValue).toISOString() }),
        },
      );
      setActivities((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      form.closest("details")?.removeAttribute("open");
    } catch {
      setError(t("activity.saveError"));
    } finally {
      setEditingId(null);
    }
  }

  const ordered = activities.slice().sort((a, b) => {
    const aTime = a.scheduled_at || a.created_at;
    const bTime = b.scheduled_at || b.created_at;
    return bTime.localeCompare(aTime);
  });

  return (
    <section aria-labelledby="application-activity-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
            {t("activity.eyebrow")}
          </p>
          <h3
            id="application-activity-heading"
            className="mt-1 text-sm font-semibold text-ink"
          >
            {t("activity.title")}
          </h3>
        </div>
        <span className="text-xs text-ink-3">{activities.length}</span>
      </div>

      <details className="mt-3 rounded-lg border border-border bg-rail">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-accent marker:hidden">
          {t("activity.add")}
        </summary>
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="space-y-3 border-t border-border p-3"
        >
          <label className="block space-y-1 text-sm font-medium text-ink-2">
            <span>{t("activity.type")}</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as ApplicationActivityType)
              }
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-focus-ring"
            >
              <option value="FOLLOW_UP">{t("activity.type.followUp")}</option>
              <option value="INTERVIEW">{t("activity.type.interview")}</option>
              <option value="NOTE">{t("activity.type.note")}</option>
            </select>
          </label>
          <Input
            id="new-activity-title"
            name="title"
            label={t("activity.label")}
            required
            maxLength={200}
          />
          {type !== "NOTE" && (
            <Input
              id="new-activity-scheduled-at"
              name="scheduled_at"
              label={t("activity.when")}
              type="datetime-local"
              required
            />
          )}
          <Textarea
            id="new-activity-body"
            name="body"
            label={t("activity.details")}
            rows={3}
            maxLength={4000}
          />
          {error && (
            <p role="alert" className="text-sm text-[#6F3627]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? t("activity.saving") : t("activity.save")}
          </Button>
        </form>
      </details>

      {ordered.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">{t("activity.empty")}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {ordered.map((activity) => {
            const completed = activity.completed_at !== null;
            return (
              <li
                key={activity.id}
                className={`rounded-lg border border-border p-3 ${
                  completed ? "bg-rail opacity-70" : "bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      {t(
                        `activity.type.${
                          activity.activity_type === "FOLLOW_UP"
                            ? "followUp"
                            : activity.activity_type === "INTERVIEW"
                              ? "interview"
                              : "note"
                        }` as never,
                      )}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold text-ink ${completed ? "line-through" : ""}`}
                    >
                      {activity.title}
                    </p>
                    {activity.body && (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink-2">
                        {activity.body}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-ink-3">
                      {activityDate(
                        locale,
                        activity.scheduled_at || activity.created_at,
                      )}
                    </p>
                  </div>
                  {activity.activity_type === "FOLLOW_UP" && (
                    <button
                      type="button"
                      onClick={() => void toggleCompleted(activity)}
                      className="shrink-0 text-xs font-semibold text-accent hover:underline"
                    >
                      {completed
                        ? t("activity.reopen")
                        : t("activity.complete")}
                    </button>
                  )}
                </div>
                <details className="mt-3 border-t border-border pt-2">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-accent marker:hidden">
                    {t("activity.edit")}
                  </summary>
                  <form
                    onSubmit={(event) => void handleEdit(event, activity)}
                    className="mt-3 space-y-3"
                  >
                    <Input
                      id={`activity-${activity.id}-title`}
                      name="title"
                      label={t("activity.label")}
                      defaultValue={activity.title}
                      required
                      maxLength={200}
                    />
                    {activity.activity_type !== "NOTE" && (
                      <Input
                        id={`activity-${activity.id}-scheduled-at`}
                        name="scheduled_at"
                        label={t("activity.when")}
                        type="datetime-local"
                        defaultValue={datetimeLocalValue(activity.scheduled_at)}
                        required
                      />
                    )}
                    <Textarea
                      id={`activity-${activity.id}-body`}
                      name="body"
                      label={t("activity.details")}
                      defaultValue={activity.body ?? ""}
                      rows={3}
                      maxLength={4000}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={editingId === activity.id}
                    >
                      {editingId === activity.id
                        ? t("activity.saving")
                        : t("activity.saveChanges")}
                    </Button>
                  </form>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export { ApplicationActivitySection };
