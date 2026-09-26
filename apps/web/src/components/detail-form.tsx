"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

type DetailFormProps = {
  initial?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
};

function DetailForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: DetailFormProps) {
  const { t } = useI18n();
  const [content, setContent] = useState(initial ?? "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        label={t("detail.heading")}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        placeholder={t("detail.form.placeholder")}
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

export { DetailForm };
