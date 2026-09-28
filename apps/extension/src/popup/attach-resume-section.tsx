import { useState } from "react";

import type {
  AttachResumeResult,
  ExtensionResponse,
  PageDetection,
  PopupRequest,
  ResumeVersionOption,
  TabContext,
} from "../shared/messages";
import { t } from "../shared/i18n";
import { attachResultMessage, resumeUploadFieldId } from "./tool-copy";

async function send<T>(request: PopupRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

/** Attaches the exact selected Resume Version to the page on explicit request. */
export function AttachResumeSection({
  tab,
  detection,
  resumeVersionId,
  resumeVersions,
}: {
  tab: TabContext | null;
  detection: PageDetection;
  resumeVersionId: string;
  resumeVersions: ResumeVersionOption[];
}) {
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "attaching" }
    | { state: "done"; message: string; ok: boolean }
  >({ state: "idle" });
  const fieldId = resumeUploadFieldId(detection);
  if (!fieldId || !tab) return null;
  const selected = resumeVersions.find(
    (option) => option.id === resumeVersionId,
  );

  const attach = async () => {
    setStatus({ state: "attaching" });
    try {
      const response = await send<AttachResumeResult>({
        type: "CAREEROS_ATTACH_RESUME",
        fieldId,
        resumeVersionId,
        expectedTabId: tab.tabId,
        expectedPageUrl: tab.tabUrl,
      });
      setStatus(
        response.ok
          ? {
              state: "done",
              message: attachResultMessage(response.data.state),
              ok: response.data.state === "FILLED",
            }
          : {
              state: "done",
              message:
                response.error === "STALE_PAGE"
                  ? t("This tab changed. Close and reopen the popup.")
                  : t("The resume could not be attached."),
              ok: false,
            },
      );
    } catch {
      setStatus({
        state: "done",
        message: t("The resume could not be attached."),
        ok: false,
      });
    }
  };

  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={!selected || status.state === "attaching"}
        onClick={() => void attach()}
      >
        {status.state === "attaching"
          ? t("Attaching resume…")
          : selected
            ? t("Attach resume: {label}", { label: selected.label })
            : t("Choose a resume below to attach it")}
      </button>
      {status.state === "done" ? (
        <p className={status.ok ? "memory-note" : "memory-error"}>
          {status.message}
        </p>
      ) : null}
    </>
  );
}
