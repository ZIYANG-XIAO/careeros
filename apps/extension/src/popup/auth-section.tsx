import type { LoadState } from "./use-popup-state";
import type { AuthStatus } from "../shared/messages";

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
            ? "Checking account…"
            : authenticated
              ? "Connected to CareerOS"
              : auth.state === "error"
                ? auth.message
                : "Sign in to CareerOS"}
        </strong>
        <p>Your Career Brain stays in the secure CareerOS service.</p>
      </div>
    </section>
  );
}
