"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { deleteAccount, exportAccountData } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { useI18n } from "@/lib/i18n";

import { MeTabs } from "../me-tabs";

const CONFIRM_WORD = "DELETE";

export default function AccountPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) {
    return <p className="text-sm text-ink-2">{t("home.signInRequired")}</p>;
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      downloadBlob(
        await exportAccountData(token),
        `careeros-export-${new Date().toISOString().slice(0, 10)}.json`,
      );
    } catch {
      setExportError(t("account.exportError"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      await deleteAccount(token);
      await signOut({ redirectUrl: "/" });
    } catch {
      setDeleteError(t("account.deleteError"));
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />

      {user?.primaryEmailAddress?.emailAddress && (
        <section className="space-y-1 rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">
            {t("account.identityTitle")}
          </h2>
          <p className="text-sm text-ink-2">
            {user.primaryEmailAddress.emailAddress}
          </p>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">
          {t("account.exportTitle")}
        </h2>
        <p className="text-sm text-ink-2">{t("account.exportDescription")}</p>
        {exportError && (
          <p role="alert" className="text-sm text-[#8A4530]">
            {exportError}
          </p>
        )}
        <Button onClick={() => void handleExport()} loading={exporting}>
          {t("account.exportAction")}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-[#8A4530]/40 bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">
          {t("account.deleteTitle")}
        </h2>
        <p className="text-sm text-ink-2">{t("account.deleteDescription")}</p>
        <p className="text-sm text-ink-3">{t("account.deleteIdentityNote")}</p>
        <Input
          id="account-delete-confirm"
          label={t("account.deleteConfirmLabel", { word: CONFIRM_WORD })}
          value={confirmText}
          autoComplete="off"
          onChange={(event) => setConfirmText(event.target.value)}
        />
        {deleteError && (
          <p role="alert" className="text-sm text-[#8A4530]">
            {deleteError}
          </p>
        )}
        <Button
          variant="danger"
          disabled={confirmText !== CONFIRM_WORD}
          loading={deleting}
          onClick={() => void handleDelete()}
        >
          {t("account.deleteAction")}
        </Button>
      </section>
    </div>
  );
}
