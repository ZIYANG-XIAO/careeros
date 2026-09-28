"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { downloadActivityCalendar } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { useI18n } from "@/lib/i18n";

/** Downloads open follow-ups and interviews as an .ics file for any calendar. */
function CalendarDownloadButton() {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setBusy(true);
    setFailed(false);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing authentication token");
      downloadBlob(
        await downloadActivityCalendar(token),
        "careeros-calendar.ics",
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      title={t("calendar.downloadHint")}
      className="text-sm font-semibold text-accent hover:underline disabled:opacity-50"
    >
      {failed ? t("calendar.downloadError") : t("calendar.download")}
    </button>
  );
}

export { CalendarDownloadButton };
