import type { LoadState } from "./use-popup-state";
import type {
  ApplicationPageContext,
  TrackedApplication,
} from "../shared/messages";
import { selectedApplicationFields } from "./application-memory";

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
      <span className="eyebrow">APPLICATION MEMORY</span>
      <h2>
        {applicationContext.state === "loading"
          ? "Looking for tracked context…"
          : applicationContext.state === "error"
            ? applicationContext.message
            : recordedApplication
              ? "Application recorded"
              : "Record after you submit"}
      </h2>
      {applicationContext.state === "ready" ? (
        <>
          <p>
            {recordedApplication
              ? `${recordedApplication.company} · ${recordedApplication.role}`
              : applicationContext.value.matchKind === "EXACT_URL"
                ? "CareerOS matched the application you started. Confirm after you submit the form."
                : applicationContext.value.matchKind === "RECENT_PREPARING"
                  ? "CareerOS found one recent application. Review the company and role before confirming."
                  : "No tracked job matched this page. Review the suggested context before confirming."}
          </p>
          {!recordedApplication &&
          applicationContext.value.matchKind === "NONE" ? (
            <p className="memory-note">
              Choosing fill saves this reviewed context as Preparing so it can
              be recovered after a submit redirect.
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
                Company
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
                Role
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
                Resume used
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
                  <option value="">No resume recorded</option>
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
                  ? "Recording application…"
                  : "I submitted · Record application"}
              </button>
              <p className="memory-note">
                Click only after you submit the form yourself. CareerOS never
                clicks Submit.
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
              View in CareerOS
            </button>
          )}
          {recordError ? <p className="memory-error">{recordError}</p> : null}
        </>
      ) : (
        <p>
          Sign in and keep this application page open to save durable context.
        </p>
      )}
    </section>
  );
}
