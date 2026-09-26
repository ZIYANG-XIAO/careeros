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
  full_name_native: string;
  full_name_latin: string;
  name_order: ContactInfo["name_order"];
  contact_email: string;
  phone: string;
  wechat_id: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  district: string;
  region: string;
  postal_code: string;
  country_code: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
};

function toFormState(contactInfo: ContactInfo): FormState {
  return {
    first_name: contactInfo.first_name ?? "",
    last_name: contactInfo.last_name ?? "",
    preferred_name: contactInfo.preferred_name ?? "",
    full_name_native: contactInfo.full_name_native ?? "",
    full_name_latin: contactInfo.full_name_latin ?? "",
    name_order: contactInfo.name_order,
    contact_email: contactInfo.contact_email ?? "",
    phone: contactInfo.phone ?? "",
    wechat_id: contactInfo.wechat_id ?? "",
    address_line_1: contactInfo.address_line_1 ?? "",
    address_line_2: contactInfo.address_line_2 ?? "",
    city: contactInfo.city ?? "",
    district: contactInfo.district ?? "",
    region: contactInfo.region ?? "",
    postal_code: contactInfo.postal_code ?? "",
    country_code: contactInfo.country_code ?? "",
    linkedin_url: contactInfo.linkedin_url ?? "",
    github_url: contactInfo.github_url ?? "",
    portfolio_url: contactInfo.portfolio_url ?? "",
  };
}

function toPayload(form: FormState): Partial<ContactInfo> {
  return {
    first_name: form.first_name.trim() || null,
    last_name: form.last_name.trim() || null,
    preferred_name: form.preferred_name.trim() || null,
    full_name_native: form.full_name_native.trim() || null,
    full_name_latin: form.full_name_latin.trim() || null,
    name_order: form.name_order,
    contact_email: form.contact_email.trim() || null,
    phone: form.phone.trim() || null,
    wechat_id: form.wechat_id.trim() || null,
    address_line_1: form.address_line_1.trim() || null,
    address_line_2: form.address_line_2.trim() || null,
    city: form.city.trim() || null,
    district: form.district.trim() || null,
    region: form.region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country_code: form.country_code.trim().toUpperCase() || null,
    linkedin_url: form.linkedin_url.trim() || null,
    github_url: form.github_url.trim() || null,
    portfolio_url: form.portfolio_url.trim() || null,
  };
}

function ContactInfoSection({ contactInfo, onSaved }: ContactInfoSectionProps) {
  const { getToken } = useAuth();
  const { locale, t } = useI18n();
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
            label={t("contactInfo.fullNameNative")}
            value={form.full_name_native}
            onChange={(event) =>
              updateField("full_name_native", event.target.value)
            }
            autoComplete="name"
          />
          <Input
            label={t("contactInfo.fullNameLatin")}
            value={form.full_name_latin}
            onChange={(event) =>
              updateField("full_name_latin", event.target.value)
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(locale === "zh-CN"
            ? [
                ["last_name", "contactInfo.lastName", "family-name"],
                ["first_name", "contactInfo.firstName", "given-name"],
              ]
            : [
                ["first_name", "contactInfo.firstName", "given-name"],
                ["last_name", "contactInfo.lastName", "family-name"],
              ]
          ).map(([field, label, autoComplete]) => (
            <Input
              key={field}
              label={t(label as Parameters<typeof t>[0])}
              value={form[field as "first_name" | "last_name"]}
              onChange={(event) =>
                updateField(
                  field as "first_name" | "last_name",
                  event.target.value,
                )
              }
              autoComplete={autoComplete}
            />
          ))}
        </div>

        <label className="block text-sm font-medium text-slate-700">
          <span className="mb-1.5 block">{t("contactInfo.nameOrder")}</span>
          <select
            value={form.name_order}
            onChange={(event) =>
              updateField(
                "name_order",
                event.target.value as ContactInfo["name_order"],
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="UNKNOWN">
              {t("contactInfo.nameOrder.unknown")}
            </option>
            <option value="FAMILY_GIVEN">
              {t("contactInfo.nameOrder.familyGiven")}
            </option>
            <option value="GIVEN_FAMILY">
              {t("contactInfo.nameOrder.givenFamily")}
            </option>
          </select>
        </label>

        <Input
          label={t("contactInfo.preferredName")}
          value={form.preferred_name}
          onChange={(event) =>
            updateField("preferred_name", event.target.value)
          }
          autoComplete="nickname"
        />

        <Input
          label={t("contactInfo.contactEmail")}
          type="email"
          value={form.contact_email}
          onChange={(event) => updateField("contact_email", event.target.value)}
          autoComplete="email"
        />

        <Input
          label={t("contactInfo.phone")}
          type="tel"
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          autoComplete="tel"
        />

        <Input
          label={t("contactInfo.wechatId")}
          value={form.wechat_id}
          onChange={(event) => updateField("wechat_id", event.target.value)}
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
            label={t("contactInfo.district")}
            value={form.district}
            onChange={(event) => updateField("district", event.target.value)}
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
          label={t("contactInfo.githubUrl")}
          type="url"
          value={form.github_url}
          onChange={(event) => updateField("github_url", event.target.value)}
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
