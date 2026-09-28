import type { LoadState } from "./use-popup-state";
import type { AuthStatus } from "../shared/messages";
import { t } from "../shared/i18n";

export function AuthSection({
  auth,
  authenticated,
}: {
  auth: LoadState<AuthStatus>;
  authenticated: boolean;
}) {
  return (
    <section className="status-card" aria-live="polite">
      <span
        className={`status-dot ${authenticated ? "connected" : ""}`}
        aria-hidden="true"
      />
      <div>
        <strong>
          {auth.state === "loading"
            ? t("Checking account…")
            : authenticated
              ? t("Connected to CareerOS")
              : auth.state === "error"
                ? auth.message
                : t("Sign in to CareerOS")}
        </strong>
        <p>{t("Your Career Brain stays in the secure CareerOS service.")}</p>
      </div>
    </section>
  );
}
