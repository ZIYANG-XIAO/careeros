import { useEffect, useState } from "react";

import { ATS_ORIGIN_PATTERNS } from "../shared/ats-hosts";
import { t } from "../shared/i18n";
import type { AutoLauncherState, ExtensionResponse } from "../shared/messages";

async function send(
  message:
    | { type: "CAREEROS_GET_AUTO_LAUNCHER" }
    | {
        type: "CAREEROS_SET_AUTO_LAUNCHER";
        enabled: boolean;
      },
): Promise<AutoLauncherState | null> {
  try {
    const response = (await chrome.runtime.sendMessage(
      message,
    )) as ExtensionResponse<AutoLauncherState>;
    return response.ok ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Opt-in: show the CareerOS button on known career sites. Turning it on asks
 * Chrome for access to those sites only; turning it off gives access back.
 */
export function AutoLauncherSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void send({ type: "CAREEROS_GET_AUTO_LAUNCHER" }).then((state) =>
      setEnabled(state?.enabled ?? false),
    );
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      if (!next) {
        const state = await send({
          type: "CAREEROS_SET_AUTO_LAUNCHER",
          enabled: false,
        });
        setEnabled(state?.enabled ?? false);
        return;
      }
      // Record the choice first: Chrome may close this popup while it shows
      // the permission prompt, and the background finishes the setup once
      // access is granted.
      await send({ type: "CAREEROS_SET_AUTO_LAUNCHER", enabled: true });
      const granted = await chrome.permissions.request({
        origins: [...ATS_ORIGIN_PATTERNS],
      });
      const state = await send({
        type: "CAREEROS_SET_AUTO_LAUNCHER",
        enabled: granted,
      });
      setEnabled(state?.enabled ?? false);
      if (!granted) setNotice(t("Access was not granted, so it stays off."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-card memory-form">
      <label className="memory-choice">
        <input
          type="checkbox"
          checked={enabled === true}
          disabled={enabled === null || busy}
          onChange={(event) => void toggle(event.target.checked)}
        />
        <span>{t("Show the CareerOS button on career sites")}</span>
      </label>
      <p className="memory-note">
        {t(
          "Greenhouse, Lever, Ashby, and Workday only. CareerOS still reads a page only when you ask.",
        )}
      </p>
      {notice ? <p className="memory-error">{notice}</p> : null}
    </section>
  );
}
