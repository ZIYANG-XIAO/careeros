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
import { type MessageKey, useI18n } from "@/lib/i18n";
import type {
  ContactInfo,
  ContactInfoField,
  ResumeDraftItem,
  ResumeImport,
} from "@/lib/types";

const contactFields: Array<{
  field: ContactInfoField;
  label: MessageKey;
}> = [
  { field: "first_name", label: "contactInfo.firstName" },
  { field: "last_name", label: "contactInfo.lastName" },
  { field: "preferred_name", label: "contactInfo.preferredName" },
  { field: "given_name_native", label: "contactInfo.givenNameNative" },
  { field: "family_name_native", label: "contactInfo.familyNameNative" },
  { field: "full_name_native", label: "contactInfo.fullNameNative" },
  { field: "contact_email", label: "contactInfo.contactEmail" },
  { field: "phone", label: "contactInfo.phone" },
  { field: "wechat_id", label: "contactInfo.wechatId" },
  { field: "address_line_1", label: "contactInfo.addressLine1" },
  { field: "address_line_2", label: "contactInfo.addressLine2" },
  { field: "city", label: "contactInfo.city" },
  { field: "district", label: "contactInfo.district" },
  { field: "region", label: "contactInfo.region" },
  { field: "postal_code", label: "contactInfo.postalCode" },
  { field: "country_code", label: "contactInfo.countryCode" },
  { field: "linkedin_url", label: "contactInfo.linkedinUrl" },
  { field: "github_url", label: "contactInfo.githubUrl" },
  { field: "portfolio_url", label: "contactInfo.portfolioUrl" },
];

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

const sectionKeys: Record<ResumeDraftItem["item_type"], MessageKey> = {
  EDUCATION: "resumeReview.section.EDUCATION",
  EXPERIENCE: "resumeReview.section.EXPERIENCE",
  EXPERIENCE_DETAIL: "resumeReview.section.EXPERIENCE_DETAIL",
  PROJECT: "resumeReview.section.PROJECT",
  PROJECT_DETAIL: "resumeReview.section.PROJECT_DETAIL",
  SKILL: "resumeReview.section.SKILL",
};

const fieldKeys: Record<string, MessageKey> = {
  institution: "resumeReview.field.institution",
  degree: "resumeReview.field.degree",
  field_of_study: "resumeReview.field.field_of_study",
  location: "resumeReview.field.location",
  start_date: "resumeReview.field.start_date",
  end_date: "resumeReview.field.end_date",
  company: "resumeReview.field.company",
  title: "resumeReview.field.title",
  is_current: "resumeReview.field.is_current",
  name: "resumeReview.field.name",
  description: "resumeReview.field.description",
  url: "resumeReview.field.url",
  content: "resumeReview.field.content",
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
  const { t } = useI18n();
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
      setError(t("resumeReview.error.save"));
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
      setError(t("resumeReview.error.remove"));
      setSaving(false);
    }
  }

  if (item.status === "REMOVED") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        {t("resumeReview.removedFromImport")}
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
                {t(fieldKeys[field])}
              </label>
            );
          }
          return (
            <Input
              key={field}
              label={t(fieldKeys[field])}
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
            {saving
              ? t("resumeReview.saving")
              : t("resumeReview.saveCorrection")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void remove()}
            disabled={saving}
          >
            {t("resumeReview.remove")}
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
  currentContactInfo = {},
  onConfirmed,
}: {
  initialImport: ResumeImport;
  currentContactInfo?: Partial<ContactInfo>;
  onConfirmed?: (resumeImport: ResumeImport) => void;
}) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [resumeImport, setResumeImport] = useState(initialImport);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactValues, setContactValues] = useState<
    Partial<Record<ContactInfoField, string>>
  >(initialImport.contact_info_candidate ?? {});
  const [selectedContactFields, setSelectedContactFields] = useState<
    Set<ContactInfoField>
  >(
    () =>
      new Set(
        contactFields
          .map(({ field }) => field)
          .filter(
            (field) =>
              Boolean(initialImport.contact_info_candidate?.[field]) &&
              !currentContactInfo[field],
          ),
      ),
  );

  const availableContactFields = contactFields.filter(({ field }) =>
    Boolean(contactValues[field]),
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, ResumeDraftItem[]>();
    for (const item of resumeImport.items) {
      const section = t(sectionKeys[item.item_type]);
      groups.set(section, [...(groups.get(section) ?? []), item]);
    }
    return [...groups.entries()];
  }, [resumeImport.items, t]);

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
      const confirmedContactInfo: Partial<ContactInfo> = {};
      for (const field of selectedContactFields) {
        const value = contactValues[field]?.trim();
        if (value) confirmedContactInfo[field] = value;
      }
      const confirmed = await confirmResumeImport(
        token,
        resumeImport.id,
        confirmedContactInfo,
      );
      setResumeImport(confirmed);
      onConfirmed?.(confirmed);
    } catch {
      setError(t("resumeReview.error.confirm"));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {availableContactFields.length > 0 && (
        <section
          aria-labelledby="resume-contact-heading"
          className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5"
        >
          <h2
            id="resume-contact-heading"
            className="text-lg font-semibold text-slate-950"
          >
            {t("resumeReview.contact.title")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t("resumeReview.contact.description")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {availableContactFields.map(({ field, label }) => {
              const currentValue = currentContactInfo[field];
              return (
                <div
                  key={field}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <label className="mb-2 flex items-start gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedContactFields.has(field)}
                      disabled={resumeImport.status === "CONFIRMED"}
                      onChange={(event) => {
                        setSelectedContactFields((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(field);
                          else next.delete(field);
                          return next;
                        });
                      }}
                    />
                    {t("resumeReview.contact.useField")} {t(label)}
                  </label>
                  <Input
                    label={t(label)}
                    value={contactValues[field] ?? ""}
                    disabled={resumeImport.status === "CONFIRMED"}
                    onChange={(event) =>
                      setContactValues((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                  />
                  {currentValue && (
                    <p className="mt-2 text-xs text-slate-500">
                      {t("resumeReview.contact.currentValue")} {currentValue}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-600">
            {t("resumeReview.contact.selectionHint")}
          </p>
        </section>
      )}

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
              {items.filter((item) => item.status === "ACTIVE").length}{" "}
              {t("resumeReview.included")}
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
          {t("resumeReview.confirmed")}
        </div>
      ) : (
        <div className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex sm:items-center sm:justify-between">
          <p className="mb-3 text-sm text-slate-600 sm:mb-0">
            {t("resumeReview.confirmHint")}
          </p>
          <Button onClick={() => void confirm()} disabled={confirming}>
            {confirming
              ? t("resumeReview.confirming")
              : t("resumeReview.confirmButton")}
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
