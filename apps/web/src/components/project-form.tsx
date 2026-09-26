"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/types";

type ProjectFormData = {
  name: string;
  description: string | null;
  url: string | null;
  start_date: string | null;
  end_date: string | null;
};

type ProjectFormProps = {
  initial?: ProjectSummary;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: ProjectFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await onSubmit({
      name: trimmedName,
      description: description.trim() || null,
      url: url.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t("project.form.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={500}
        placeholder={t("project.form.namePlaceholder")}
      />
      <Textarea
        label={t("common.form.description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("project.form.descriptionPlaceholder")}
      />
      <Input
        label={t("common.form.url")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={2000}
        placeholder={t("project.form.urlPlaceholder")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("common.form.startDate")}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          maxLength={10}
          placeholder={t("project.form.startDatePlaceholder")}
        />
        <Input
          label={t("common.form.endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          maxLength={10}
          placeholder={t("project.form.endDatePlaceholder")}
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

export { ProjectForm };
export type { ProjectFormData };
