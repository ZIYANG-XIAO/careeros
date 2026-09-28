import type { LoadState } from "./use-popup-state";
import type {
  ApplicationPageContext,
  TrackedApplication,
} from "../shared/messages";
import { selectedApplicationFields } from "./application-memory";
import { t } from "../shared/i18n";

export function MemorySection({
  applicationContext,
  recordedApplication,
  company,
  setCompany,
  role,
  setRole,
  resumeVersionId,
  setResumeVersionId,
  useTrackedApplication,
  setUseTrackedApplication,
  recording,
  recordError,
  onRecord,
  onResolveForResume,
  onResetPrepareKey,
  onResetRecordKey,
}: {
  applicationContext: LoadState<ApplicationPageContext>;
  recordedApplication: TrackedApplication | null;
  company: string;
  setCompany: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  resumeVersionId: string;
  setResumeVersionId: (value: string) => void;
  useTrackedApplication: boolean;
  setUseTrackedApplication: (value: boolean) => void;
  recording: boolean;
  recordError: string | null;
  onRecord: () => void;
  onResolveForResume: (resumeVersionId: string) => void;
  onResetPrepareKey: () => void;
  onResetRecordKey: () => void;
}) {
  return (
    <section className="page-card application-memory" aria-live="polite">
      <span className="eyebrow">{t("APPLICATION MEMORY")}</span>
      <h2>
        {applicationContext.state === "loading"
          ? t("Looking for tracked context…")
          : applicationContext.state === "error"
            ? applicationContext.message
            : recordedApplication
              ? t("Application recorded")
              : t("Record after you submit")}
      </h2>
      {applicationContext.state === "ready" ? (
        <>
          <p>
            {recordedApplication
              ? `${recordedApplication.company} · ${recordedApplication.role}`
              : applicationContext.value.matchKind === "EXACT_URL"
                ? t(
                    "CareerOS matched the application you started. Confirm after you submit the form.",
                  )
                : applicationContext.value.matchKind === "RECENT_PREPARING"
                  ? t(
                      "CareerOS found one recent application. Review the company and role before confirming.",
                    )
                  : t(
                      "No tracked job matched this page. Review the suggested context before confirming.",
                    )}
          </p>
          {!recordedApplication &&
          applicationContext.value.matchKind === "NONE" ? (
            <p className="memory-note">
              {t(
                "Choosing fill saves this reviewed context as Preparing so it can be recovered after a submit redirect.",
              )}
            </p>
          ) : null}

          {!recordedApplication ? (
            <div className="memory-form">
              {applicationContext.value.matchKind === "RECENT_PREPARING" &&
              applicationContext.value.application ? (
                <label className="memory-choice">
                  <input
                    type="checkbox"
                    checked={useTrackedApplication}
                    onChange={(event) => {
                      const useTracked = event.target.checked;
                      const selected = selectedApplicationFields(
                        applicationContext.value,
                        useTracked,
                      );
                      setUseTrackedApplication(useTracked);
                      setCompany(selected.company);
                      setRole(selected.role);
                      setResumeVersionId(selected.resumeVersionId);
                      onResetPrepareKey();
                      onResetRecordKey();
                      onResolveForResume(selected.resumeVersionId);
                    }}
                  />
                  Use the recent {applicationContext.value.application.company}{" "}
                  · {applicationContext.value.application.role} record
                </label>
              ) : null}
              <label>
                {t("Company")}
                <input
                  value={company}
                  maxLength={500}
                  disabled={Boolean(
                    applicationContext.value.application &&
                    useTrackedApplication,
                  )}
                  onChange={(event) => {
                    setCompany(event.target.value);
                    onResetPrepareKey();
                    onResetRecordKey();
                  }}
                />
              </label>
              <label>
                {t("Role")}
                <input
                  value={role}
                  maxLength={500}
                  disabled={Boolean(
                    applicationContext.value.application &&
                    useTrackedApplication,
                  )}
                  onChange={(event) => {
                    setRole(event.target.value);
                    onResetPrepareKey();
                    onResetRecordKey();
                  }}
                />
              </label>
              <label>
                {t("Resume used")}
                <select
                  value={resumeVersionId}
                  disabled={Boolean(
                    useTrackedApplication &&
                    applicationContext.value.application?.resumeVersionId,
                  )}
                  onChange={(event) => {
                    setResumeVersionId(event.target.value);
                    onResetPrepareKey();
                    onResetRecordKey();
                    onResolveForResume(event.target.value);
                  }}
                >
                  <option value="">{t("No resume recorded")}</option>
                  {applicationContext.value.resumeVersions.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={recording || !company.trim() || !role.trim()}
                onClick={onRecord}
              >
                {recording
                  ? t("Recording application…")
                  : t("I submitted · Record application")}
              </button>
              <p className="memory-note">
                {t(
                  "Click only after you submit the form yourself. CareerOS never clicks Submit.",
                )}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                chrome.tabs.create({
                  url: `${__CAREEROS_WEB_URL__}/applications/${recordedApplication.id}`,
                })
              }
            >
              {t("View in CareerOS")}
            </button>
          )}
          {recordError ? <p className="memory-error">{recordError}</p> : null}
        </>
      ) : (
        <p>
          {t(
            "Sign in and keep this application page open to save durable context.",
          )}
        </p>
      )}
    </section>
  );
}
