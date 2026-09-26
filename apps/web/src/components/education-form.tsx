"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { EducationSummary } from "@/lib/types";

type EducationFormProps = {
  initial?: EducationSummary;
  onSubmit: (data: {
    institution: string;
    degree: string | null;
    field_of_study: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function EducationForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: EducationFormProps) {
  const { t } = useI18n();
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [degree, setDegree] = useState(initial?.degree ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(
    initial?.field_of_study ?? "",
  );
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedInstitution = institution.trim();
    if (!trimmedInstitution) return;
    await onSubmit({
      institution: trimmedInstitution,
      degree: degree.trim() || null,
      field_of_study: fieldOfStudy.trim() || null,
      location: location.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t("education.form.institution")}
        value={institution}
        onChange={(e) => setInstitution(e.target.value)}
        required
        maxLength={500}
        placeholder={t("education.form.institutionPlaceholder")}
      />
      <Input
        label={t("education.form.degree")}
        value={degree}
        onChange={(e) => setDegree(e.target.value)}
        maxLength={500}
        placeholder={t("education.form.degreePlaceholder")}
      />
      <Input
        label={t("education.form.fieldOfStudy")}
        value={fieldOfStudy}
        onChange={(e) => setFieldOfStudy(e.target.value)}
        maxLength={500}
        placeholder={t("education.form.fieldOfStudyPlaceholder")}
      />
      <Input
        label={t("common.form.location")}
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={500}
        placeholder={t("education.form.locationPlaceholder")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("common.form.startDate")}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          maxLength={10}
          placeholder={t("education.form.startDatePlaceholder")}
        />
        <Input
          label={t("common.form.endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          maxLength={10}
          placeholder={t("education.form.endDatePlaceholder")}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? t("common.save") : t("common.add")}
        </Button>
      </div>
    </form>
  );
}

export { EducationForm };
