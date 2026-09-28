"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createApplicationContact,
  deleteApplicationContact,
  listApplicationContacts,
} from "@/lib/api";
import { type MessageKey, useI18n } from "@/lib/i18n";
import type {
  ApplicationContact,
  ApplicationContactRelationship,
} from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

const RELATIONSHIPS: ApplicationContactRelationship[] = [
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "REFERRER",
  "OTHER",
];

const RELATIONSHIP_KEYS: Record<ApplicationContactRelationship, MessageKey> = {
  RECRUITER: "contacts.type.recruiter",
  HIRING_MANAGER: "contacts.type.hiringManager",
  INTERVIEWER: "contacts.type.interviewer",
  REFERRER: "contacts.type.referrer",
  OTHER: "contacts.type.other",
};

/** People the user deals with for one application — only what they type. */
function ApplicationContactsSection({
  applicationId,
}: {
  applicationId: string;
}) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    return listApplicationContacts(token, applicationId);
  }, [getToken, applicationId]);

  const { data, setData, loadError } = useDataFetch<ApplicationContact[]>({
    enabled: true,
    resetKey: applicationId,
    initialData: [],
    fetch: fetchContacts,
    deps: [fetchContacts],
  });

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = (name: string) => String(values.get(name) ?? "").trim();
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      const created = await createApplicationContact(token, applicationId, {
        name: text("name"),
        relationship_type: text(
          "relationship_type",
        ) as ApplicationContactRelationship,
        email: text("email") || null,
        profile_url: text("profile_url") || null,
        notes: text("notes") || null,
      });
      setData((current) => [...current, created]);
      form.reset();
      setAdding(false);
    } catch {
      setError(t("contacts.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contactId: string) {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await deleteApplicationContact(token, applicationId, contactId);
      setData((current) => current.filter((item) => item.id !== contactId));
    } catch {
      setError(t("contacts.saveError"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">
          {t("contacts.title")} · {data.length}
        </p>
        {!adding && (
          <button
            type="button"
            className="text-sm font-semibold text-accent hover:underline"
            onClick={() => setAdding(true)}
          >
            {t("contacts.add")}
          </button>
        )}
      </div>
      {loadError ? (
        <p className="text-sm text-ink-3">{t("contacts.loadError")}</p>
      ) : data.length === 0 && !adding ? (
        <p className="text-sm text-ink-3">{t("contacts.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((contact) => (
            <li
              key={contact.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">
                  {contact.name}{" "}
                  <span className="font-normal text-ink-3">
                    · {t(RELATIONSHIP_KEYS[contact.relationship_type])}
                  </span>
                </p>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="block truncate text-accent hover:underline"
                  >
                    {contact.email}
                  </a>
                )}
                {contact.profile_url && (
                  <a
                    href={contact.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-accent hover:underline"
                  >
                    {contact.profile_url}
                  </a>
                )}
                {contact.notes && (
                  <p className="mt-1 whitespace-pre-wrap text-ink-2">
                    {contact.notes}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-ink-3 hover:text-[#8A4530]"
                aria-label={t("contacts.removeLabel", { name: contact.name })}
                onClick={() => void handleDelete(contact.id)}
              >
                {t("contacts.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <Input
            id={`contact-name-${applicationId}`}
            name="name"
            label={t("contacts.name")}
            required
            maxLength={200}
          />
          <label className="text-sm font-medium text-ink-2">
            {t("contacts.relationship")}
            <select
              name="relationship_type"
              defaultValue="RECRUITER"
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              {RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {t(RELATIONSHIP_KEYS[value])}
                </option>
              ))}
            </select>
          </label>
          <Input
            id={`contact-email-${applicationId}`}
            name="email"
            type="email"
            label={t("contacts.email")}
            maxLength={320}
          />
          <Input
            id={`contact-url-${applicationId}`}
            name="profile_url"
            type="url"
            label={t("contacts.profileUrl")}
          />
          <Textarea
            id={`contact-notes-${applicationId}`}
            name="notes"
            label={t("contacts.notes")}
            rows={2}
            maxLength={5000}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={saving}>
              {t("contacts.save")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setAdding(false)}
            >
              {t("delete.cancel")}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#8A4530]">
          {error}
        </p>
      )}
    </div>
  );
}

export { ApplicationContactsSection };
