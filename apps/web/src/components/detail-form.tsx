"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        label="Detail"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        placeholder="Describe what you did..."
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
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

export { DetailForm };
