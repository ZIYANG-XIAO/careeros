"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { ContactInfoSection } from "@/components/contact-info-section";
import { Spinner } from "@/components/ui/spinner";
import { getContactInfo } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ContactInfo } from "@/lib/types";

import { SavedAnswersSection } from "@/components/saved-answers-section";
import { MeTabs } from "../me-tabs";

const EMPTY_CONTACT_INFO: ContactInfo = {
  first_name: null,
  last_name: null,
  preferred_name: null,
  given_name_native: null,
  family_name_native: null,
  full_name_native: null,
  contact_email: null,
  phone: null,
  wechat_id: null,
  address_line_1: null,
  address_line_2: null,
  city: null,
  district: null,
  region: null,
  postal_code: null,
  country_code: null,
  linkedin_url: null,
  github_url: null,
  portfolio_url: null,
  confirmed_at: null,
};

export default function MeContactPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setContactInfo(null);
    setError(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Missing authentication token");
        const contact = await getContactInfo(token);
        if (!cancelled) {
          setContactInfo(contact);
          setError(null);
        }
      } catch {
        if (!cancelled) setError(t("contactInfo.loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, userId, fetchKey, t]);

  if (!isLoaded || (isLoaded && isSignedIn && !contactInfo && !error)) {
    return <Spinner />;
  }
  if (!isSignedIn) {
    return (
      <p className="text-sm text-ink-2">
        {t("career.signInRequired.description")}
      </p>
    );
  }
  if (error || !contactInfo) {
    return (
      <div className="rounded-xl border border-evidence-gap-border bg-evidence-gap-bg p-6 text-center">
        <p className="text-sm font-medium text-[#6F3627]">
          {error || t("errors.unknown")}
        </p>
        <button
          onClick={() => setFetchKey((k) => k + 1)}
          className="mt-3 text-sm font-medium text-[#8A4530] underline hover:text-[#6F3627]"
        >
          {t("errors.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />
      <ContactInfoSection
        contactInfo={contactInfo ?? EMPTY_CONTACT_INFO}
        onSaved={setContactInfo}
      />
      <SavedAnswersSection />
    </div>
  );
}
