"use client";

import { useAuth } from "@clerk/nextjs";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateContactInfo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ContactInfo } from "@/lib/types";

type ContactInfoSectionProps = {
  contactInfo: ContactInfo;
  onSaved: (contactInfo: ContactInfo) => void;
};

type FormState = {
  first_name: string;
  last_name: string;
  preferred_name: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  postal_code: string;
  country_code: string;
  linkedin_url: string;
  portfolio_url: string;
};

function toFormState(contactInfo: ContactInfo): FormState {
  return {
    first_name: contactInfo.first_name ?? "",
    last_name: contactInfo.last_name ?? "",
    preferred_name: contactInfo.preferred_name ?? "",
    phone: contactInfo.phone ?? "",
    address_line_1: contactInfo.address_line_1 ?? "",
    address_line_2: contactInfo.address_line_2 ?? "",
    city: contactInfo.city ?? "",
    region: contactInfo.region ?? "",
    postal_code: contactInfo.postal_code ?? "",
    country_code: contactInfo.country_code ?? "",
    linkedin_url: contactInfo.linkedin_url ?? "",
    portfolio_url: contactInfo.portfolio_url ?? "",
  };
}

function toPayload(form: FormState): Partial<ContactInfo> {
  return {
    first_name: form.first_name.trim() || null,
    last_name: form.last_name.trim() || null,
    preferred_name: form.preferred_name.trim() || null,
    phone: form.phone.trim() || null,
    address_line_1: form.address_line_1.trim() || null,
    address_line_2: form.address_line_2.trim() || null,
    city: form.city.trim() || null,
    region: form.region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country_code: form.country_code.trim().toUpperCase() || null,
    linkedin_url: form.linkedin_url.trim() || null,
    portfolio_url: form.portfolio_url.trim() || null,
  };
}

function ContactInfoSection({ contactInfo, onSaved }: ContactInfoSectionProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const serverForm = toFormState(contactInfo);
  const [localEdits, setLocalEdits] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = localEdits !== null;
  const form = localEdits ?? serverForm;

  function setForm(next: FormState) {
    setLocalEdits(next);
  }

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

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
        setSaveError(t("contactInfo.saveError"));
        return;
      }
      const saved = await updateContactInfo(token, toPayload(form));
      setLocalEdits(null);
      setSaveSuccess(true);
      onSaved(saved);
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setSaveError(t("contactInfo.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="contact-info-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2
          id="contact-info-heading"
          className="text-lg font-semibold text-slate-900"
        >
          {t("contactInfo.title")}
        </h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {t("contactInfo.description")}
        </p>
        <p className="mt-2 text-sm leading-5 text-slate-500">
          {t("contactInfo.distinction")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
        aria-busy={saving}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("contactInfo.firstName")}
            value={form.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            autoComplete="given-name"
          />
          <Input
            label={t("contactInfo.lastName")}
            value={form.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            autoComplete="family-name"
          />
        </div>

        <Input
          label={t("contactInfo.preferredName")}
          value={form.preferred_name}
          onChange={(event) =>
            updateField("preferred_name", event.target.value)
          }
          autoComplete="nickname"
        />

        <Input
          label={t("contactInfo.phone")}
          type="tel"
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          autoComplete="tel"
        />

        <Input
          label={t("contactInfo.addressLine1")}
          value={form.address_line_1}
          onChange={(event) =>
            updateField("address_line_1", event.target.value)
          }
          autoComplete="address-line1"
        />

        <Input
          label={t("contactInfo.addressLine2")}
          value={form.address_line_2}
          onChange={(event) =>
            updateField("address_line_2", event.target.value)
          }
          autoComplete="address-line2"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("contactInfo.city")}
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            autoComplete="address-level2"
          />
          <Input
            label={t("contactInfo.region")}
            value={form.region}
            onChange={(event) => updateField("region", event.target.value)}
            autoComplete="address-level1"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("contactInfo.postalCode")}
            value={form.postal_code}
            onChange={(event) => updateField("postal_code", event.target.value)}
            autoComplete="postal-code"
          />
          <Input
            label={t("contactInfo.countryCode")}
            value={form.country_code}
            onChange={(event) =>
              updateField("country_code", event.target.value)
            }
            autoComplete="country"
            maxLength={2}
          />
        </div>

        <Input
          label={t("contactInfo.linkedinUrl")}
          type="url"
          value={form.linkedin_url}
          onChange={(event) => updateField("linkedin_url", event.target.value)}
          autoComplete="url"
        />

        <Input
          label={t("contactInfo.portfolioUrl")}
          type="url"
          value={form.portfolio_url}
          onChange={(event) => updateField("portfolio_url", event.target.value)}
          autoComplete="url"
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? t("contactInfo.saving") : t("contactInfo.save")}
          </Button>
          {saveSuccess && (
            <p
              className="text-sm font-medium text-green-700"
              role="status"
              aria-live="polite"
            >
              {t("contactInfo.saveSuccess")}
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

export { ContactInfoSection };
