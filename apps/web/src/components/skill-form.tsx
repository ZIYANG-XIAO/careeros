"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { SkillSummary } from "@/lib/types";

type SkillFormProps = {
  initial?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function SkillForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: SkillFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t("skill.form.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={500}
        placeholder={t("skill.form.namePlaceholder")}
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
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

export { SkillForm };
