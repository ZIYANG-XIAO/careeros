"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmResumeImport,
  removeResumeDraftItem,
  updateResumeDraftItem,
} from "@/lib/api";
import type { ResumeDraftItem, ResumeImport } from "@/lib/types";

const editableFields: Record<ResumeDraftItem["item_type"], string[]> = {
  EDUCATION: [
    "institution",
    "degree",
    "field_of_study",
    "location",
    "start_date",
    "end_date",
  ],
  EXPERIENCE: [
    "company",
    "title",
    "location",
    "start_date",
    "end_date",
    "is_current",
  ],
  EXPERIENCE_DETAIL: ["content"],
  PROJECT: ["name", "description", "url", "start_date", "end_date"],
  PROJECT_DETAIL: ["content"],
  SKILL: ["name"],
};

const labels: Record<string, string> = {
  institution: "Institution",
  degree: "Degree",
  field_of_study: "Field of study",
  location: "Location",
  start_date: "Start date",
  end_date: "End date",
  company: "Company",
  title: "Title",
  is_current: "Current role",
  name: "Name",
  description: "Description",
  url: "URL",
  content: "Detail",
};

const sectionNames: Record<string, string> = {
  EDUCATION: "Education",
  EXPERIENCE: "Experience",
  EXPERIENCE_DETAIL: "Experience details",
  PROJECT: "Projects",
  PROJECT_DETAIL: "Project details",
  SKILL: "Skills",
};

function DraftCard({
  item,
  importId,
  onChange,
}: {
  item: ResumeDraftItem;
  importId: string;
  onChange: (item: ResumeDraftItem) => void;
}) {
  const { getToken } = useAuth();
  const [data, setData] = useState<Record<string, unknown>>(item.data);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const updated = await updateResumeDraftItem(
        token,
        importId,
        item.id,
        data,
      );
      setData(updated.data);
      onChange(updated);
    } catch {
      setError("Could not save this correction.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      onChange(await removeResumeDraftItem(token, importId, item.id));
    } catch {
      setError("Could not remove this item.");
      setSaving(false);
    }
  }

  if (item.status === "REMOVED") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Removed from this import
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        {editableFields[item.item_type].map((field) => {
          if (field === "is_current") {
            return (
              <label
                key={field}
                className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean(data[field])}
                  onChange={(event) =>
                    setData({ ...data, [field]: event.target.checked })
                  }
                  disabled={item.status !== "ACTIVE"}
                />
                {labels[field]}
              </label>
            );
          }
          return (
            <Input
              key={field}
              label={labels[field]}
              value={typeof data[field] === "string" ? data[field] : ""}
              onChange={(event) =>
                setData({ ...data, [field]: event.target.value || null })
              }
              disabled={item.status !== "ACTIVE"}
            />
          );
        })}
      </div>
      {item.status === "ACTIVE" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save correction"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void remove()}
            disabled={saving}
          >
            Remove
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function ResumeReview({
  initialImport,
  onConfirmed,
}: {
  initialImport: ResumeImport;
  onConfirmed?: (resumeImport: ResumeImport) => void;
}) {
  const { getToken } = useAuth();
  const [resumeImport, setResumeImport] = useState(initialImport);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, ResumeDraftItem[]>();
    for (const item of resumeImport.items) {
      const section = sectionNames[item.item_type];
      groups.set(section, [...(groups.get(section) ?? []), item]);
    }
    return [...groups.entries()];
  }, [resumeImport.items]);

  function replaceItem(updated: ResumeDraftItem) {
    setResumeImport((current) => {
      const removedIds = new Set(
        updated.status === "REMOVED" ? [updated.id] : [],
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of current.items) {
          if (
            item.parent_item_id &&
            removedIds.has(item.parent_item_id) &&
            !removedIds.has(item.id)
          ) {
            removedIds.add(item.id);
            changed = true;
          }
        }
      }
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id === updated.id) return updated;
          return removedIds.has(item.id)
            ? { ...item, status: "REMOVED" as const }
            : item;
        }),
      };
    });
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const confirmed = await confirmResumeImport(token, resumeImport.id);
      setResumeImport(confirmed);
      onConfirmed?.(confirmed);
    } catch {
      setError(
        "Could not confirm this import. Your Career Brain was not changed.",
      );
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {grouped.map(([section, items]) => (
        <section key={section} aria-labelledby={`section-${section}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2
              id={`section-${section}`}
              className="text-lg font-semibold text-slate-950"
            >
              {section}
            </h2>
            <span className="text-xs text-slate-500">
              {items.filter((item) => item.status === "ACTIVE").length} included
            </span>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <DraftCard
                key={item.id}
                item={item}
                importId={resumeImport.id}
                onChange={replaceItem}
              />
            ))}
          </div>
        </section>
      ))}

      {resumeImport.status === "CONFIRMED" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          Confirmed. Accepted facts are now in your Career Brain.
        </div>
      ) : (
        <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between">
          <p className="mb-3 text-sm text-slate-600 sm:mb-0">
            Nothing enters your Career Brain until you confirm.
          </p>
          <Button onClick={() => void confirm()} disabled={confirming}>
            {confirming ? "Confirming…" : "Confirm accepted facts"}
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
