import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AnswerResolution,
  ApplicationPageContext,
  AuthStatus,
  ExtensionResponse,
  FillExecutionResult,
  PageDetection,
  PopupRequest,
  TrackedApplication,
} from "../shared/messages";
import {
  confirmedApplicationAnswers,
  initialApplicationFields,
  selectedApplicationFields,
  shouldShowApplicationMemory,
} from "./application-memory";
import { answerCopy } from "./answer-copy";
import { detectionCopy } from "./detection-copy";
import { fillCopy } from "./fill-copy";
import { approvedFillCount, buildFillPlan } from "./fill-plan";

type LoadState<T> =
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "error"; message: string };

async function send<T>(request: PopupRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

function App() {
  const [auth, setAuth] = useState<LoadState<AuthStatus>>({ state: "loading" });
  const [detection, setDetection] = useState<LoadState<PageDetection>>({
    state: "loading",
  });
  const [answers, setAnswers] = useState<LoadState<AnswerResolution> | null>(
    null,
  );
  const [fillResult, setFillResult] =
    useState<LoadState<FillExecutionResult> | null>(null);
  const [applicationContext, setApplicationContext] =
    useState<LoadState<ApplicationPageContext> | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [resumeVersionId, setResumeVersionId] = useState("");
  const [useTrackedApplication, setUseTrackedApplication] = useState(false);
  const [preparingApplication, setPreparingApplication] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedApplication, setRecordedApplication] =
    useState<TrackedApplication | null>(null);
  const prepareKey = useRef(crypto.randomUUID());
  const recordKey = useRef(crypto.randomUUID());

  useEffect(() => {
    void send<AuthStatus>({ type: "CAREEROS_GET_AUTH_STATUS" })
      .then((response) => {
        setAuth(
          response.ok
            ? { state: "ready", value: response.data }
            : { state: "error", message: "CareerOS is unavailable." },
        );
      })
      .catch(() =>
        setAuth({ state: "error", message: "CareerOS is unavailable." }),
      );

    void send<PageDetection>({ type: "CAREEROS_DETECT_ACTIVE_PAGE" })
      .then(async (response) => {
        setDetection(
          response.ok
            ? { state: "ready", value: response.data }
            : {
                state: "error",
                message:
                  response.error === "UNSUPPORTED_PAGE"
                    ? "Open a normal web page to use CareerOS."
                    : "This page could not be inspected.",
              },
        );
        if (response.ok && response.data.status !== "UNSUPPORTED_PAGE") {
          const isApplicationPage = response.data.status === "APPLICATION_PAGE";
          if (isApplicationPage) setApplicationContext({ state: "loading" });
          let selectedResumeVersionId: string | null = null;
          try {
            const contextResponse = await send<ApplicationPageContext>({
              type: "CAREEROS_GET_APPLICATION_CONTEXT",
            });
            if (contextResponse.ok) {
              const shouldShowContext = shouldShowApplicationMemory(
                response.data.status,
                contextResponse.data,
              );
              if (shouldShowContext) {
                const initial = initialApplicationFields(contextResponse.data);
                selectedResumeVersionId = initial.resumeVersionId || null;
                setCompany(initial.company);
                setRole(initial.role);
                setResumeVersionId(initial.resumeVersionId);
                setUseTrackedApplication(
                  contextResponse.data.matchKind === "EXACT_URL",
                );
                setApplicationContext({
                  state: "ready",
                  value: contextResponse.data,
                });
                if (
                  contextResponse.data.application &&
                  contextResponse.data.application.status !== "PREPARING"
                ) {
                  setRecordedApplication(contextResponse.data.application);
                }
              }
            } else if (isApplicationPage) {
              setApplicationContext({
                state: "error",
                message:
                  contextResponse.error === "UNAUTHENTICATED"
                    ? "Sign in to record this application."
                    : "Application context is unavailable.",
              });
            }
          } catch {
            if (isApplicationPage) {
              setApplicationContext({
                state: "error",
                message: "Application context is unavailable.",
              });
            }
          }
          if (!isApplicationPage) return;
          const fields = response.data.forms
            .flatMap((form) => form.fields)
            .slice(0, 200)
            .map((field) => ({
              fieldId: field.id,
              canonicalKey: field.canonicalKey,
              question: field.question,
              controlType: field.controlType,
              required: field.required,
              mappingConfidence: field.confidence,
              options: field.options.map((option) => option.label),
            }));
          if (fields.length === 0) return;
          setAnswers({ state: "loading" });
          try {
            const answerResponse = await send<AnswerResolution>({
              type: "CAREEROS_RESOLVE_ANSWERS",
              fields,
              selectedResumeVersionId,
            });
            setAnswers(
              answerResponse.ok
                ? { state: "ready", value: answerResponse.data }
                : {
                    state: "error",
                    message:
                      answerResponse.error === "UNAUTHENTICATED"
                        ? "Sign in to preview safe answers."
                        : "Answer decisions are unavailable.",
                  },
            );
          } catch {
            setAnswers({
              state: "error",
              message: "Answer decisions are unavailable.",
            });
          }
        }
      })
      .catch(() => {
        setDetection({
          state: "error",
          message: "This page could not be inspected.",
        });
      });
  }, []);

  const authenticated = auth.state === "ready" && auth.value.authenticated;
  const copy =
    detection.state === "ready" ? detectionCopy(detection.value) : null;
  const detectionTitle =
    detection.state === "loading"
      ? "Checking this page…"
      : detection.state === "ready"
        ? copy!.title
        : detection.message;
  const detectionBody =
    detection.state === "ready"
      ? copy!.body
      : "CareerOS only inspects the active tab when you open it.";
  const resolvedAnswerCopy =
    answers?.state === "ready" ? answerCopy(answers.value) : null;
  const fillPlan =
    answers?.state === "ready" && detection.state === "ready"
      ? buildFillPlan(answers.value, detection.value)
      : null;
  const approvedFields = approvedFillCount(fillPlan);
  const hasReviewPlan = Boolean(fillPlan?.length);
  const resolvedFillCopy =
    fillResult?.state === "ready" ? fillCopy(fillResult.value) : null;
  const shouldPrepareForRecovery = Boolean(
    applicationContext?.state === "ready" &&
    !useTrackedApplication &&
    !recordedApplication &&
    company.trim() &&
    role.trim(),
  );

  async function applyApprovedAnswers(): Promise<void> {
    if (!fillPlan || fillPlan.length === 0) return;
    if (shouldPrepareForRecovery && applicationContext?.state === "ready") {
      setPreparingApplication(true);
      setRecordError(null);
      try {
        const prepared = await send<TrackedApplication>({
          type: "CAREEROS_PREPARE_APPLICATION",
          company: company.trim(),
          role: role.trim(),
          resumeVersionId: resumeVersionId || null,
          idempotencyKey: prepareKey.current,
        });
        if (!prepared.ok) throw new Error(prepared.error);
        setApplicationContext({
          state: "ready",
          value: {
            ...applicationContext.value,
            matchKind: "EXACT_URL",
            application: prepared.data,
          },
        });
        setUseTrackedApplication(true);
      } catch {
        setRecordError(
          "CareerOS could not save recovery context, but you can still fill and submit manually.",
        );
      } finally {
        setPreparingApplication(false);
      }
    }
    setFillResult({ state: "loading" });
    try {
      const response = await send<FillExecutionResult>({
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlan,
      });
      setFillResult(
        response.ok
          ? { state: "ready", value: response.data }
          : { state: "error", message: "The page could not be updated." },
      );
    } catch {
      setFillResult({
        state: "error",
        message: "The page could not be updated.",
      });
    }
  }

  async function resolveForResume(nextResumeVersionId: string): Promise<void> {
    if (
      detection.state !== "ready" ||
      detection.value.status !== "APPLICATION_PAGE"
    ) {
      return;
    }
    const fields = detection.value.forms
      .flatMap((form) => form.fields)
      .slice(0, 200)
      .map((field) => ({
        fieldId: field.id,
        canonicalKey: field.canonicalKey,
        question: field.question,
        controlType: field.controlType,
        required: field.required,
        mappingConfidence: field.confidence,
        options: field.options.map((option) => option.label),
      }));
    if (fields.length === 0) return;
    setAnswers({ state: "loading" });
    setFillResult(null);
    try {
      const response = await send<AnswerResolution>({
        type: "CAREEROS_RESOLVE_ANSWERS",
        fields,
        selectedResumeVersionId: nextResumeVersionId || null,
      });
      setAnswers(
        response.ok
          ? { state: "ready", value: response.data }
          : { state: "error", message: "Answer decisions are unavailable." },
      );
    } catch {
      setAnswers({
        state: "error",
        message: "Answer decisions are unavailable.",
      });
    }
  }

  async function recordSubmittedApplication(): Promise<void> {
    if (
      applicationContext?.state !== "ready" ||
      !company.trim() ||
      !role.trim()
    ) {
      return;
    }
    setRecording(true);
    setRecordError(null);
    const retainedAnswers = confirmedApplicationAnswers(
      answers?.state === "ready" ? answers.value : null,
      fillResult?.state === "ready" ? fillResult.value : null,
    );
    try {
      const response = await send<TrackedApplication>({
        type: "CAREEROS_RECORD_APPLICATION",
        applicationId: useTrackedApplication
          ? (applicationContext.value.application?.id ?? null)
          : null,
        company: company.trim(),
        role: role.trim(),
        resumeVersionId: resumeVersionId || null,
        idempotencyKey: recordKey.current,
        answers: retainedAnswers,
      });
      if (!response.ok) throw new Error(response.error);
      setRecordedApplication(response.data);
    } catch {
      setRecordError(
        "CareerOS could not record this application. Your details remain here so you can retry.",
      );
    } finally {
      setRecording(false);
    }
  }

  return (
    <main>
      <header>
        <span className="eyebrow">APPLY ANYWHERE</span>
        <h1>CareerOS</h1>
      </header>

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

      <section className="page-card" aria-live="polite">
        <span className="eyebrow">CURRENT PAGE</span>
        <h2>{detectionTitle}</h2>
        <p>{detectionBody}</p>
      </section>

      {answers ? (
        <section className="page-card" aria-live="polite">
          <span className="eyebrow">ANSWER POLICY</span>
          <h2>
            {answers.state === "loading"
              ? "Checking approved sources…"
              : answers.state === "ready"
                ? resolvedAnswerCopy!.title
                : answers.message}
          </h2>
          <p>
            {answers.state === "ready"
              ? resolvedAnswerCopy!.body
              : "CareerOS keeps unknown and sensitive answers under your control."}
          </p>
        </section>
      ) : null}

      {hasReviewPlan ? (
        <button
          type="button"
          disabled={
            fillResult?.state === "loading" ||
            preparingApplication ||
            applicationContext?.state === "loading"
          }
          onClick={() => void applyApprovedAnswers()}
        >
          {preparingApplication
            ? "Saving recovery context…"
            : fillResult?.state === "loading"
              ? "Applying approved answers…"
              : approvedFields > 0
                ? `${shouldPrepareForRecovery ? "Save context & fill" : "Fill"} ${approvedFields} approved ${approvedFields === 1 ? "field" : "fields"}`
                : shouldPrepareForRecovery
                  ? "Save context & show review states"
                  : "Show review states on page"}
        </button>
      ) : null}

      {fillResult ? (
        <section className="page-card" aria-live="polite">
          <span className="eyebrow">REVIEW</span>
          <h2>
            {fillResult.state === "loading"
              ? "Updating supported fields…"
              : fillResult.state === "ready"
                ? resolvedFillCopy!.title
                : fillResult.message}
          </h2>
          <p>
            {fillResult.state === "ready"
              ? resolvedFillCopy!.body
              : "Existing answers stay untouched, and CareerOS never submits the form."}
          </p>
        </section>
      ) : null}

      {applicationContext ? (
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
                  Choosing fill saves this reviewed context as Preparing so it
                  can be recovered after a submit redirect.
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
                          prepareKey.current = crypto.randomUUID();
                          recordKey.current = crypto.randomUUID();
                          void resolveForResume(selected.resumeVersionId);
                        }}
                      />
                      Use the recent{" "}
                      {applicationContext.value.application.company} ·{" "}
                      {applicationContext.value.application.role} record
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
                        prepareKey.current = crypto.randomUUID();
                        recordKey.current = crypto.randomUUID();
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
                        prepareKey.current = crypto.randomUUID();
                        recordKey.current = crypto.randomUUID();
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
                        prepareKey.current = crypto.randomUUID();
                        recordKey.current = crypto.randomUUID();
                        void resolveForResume(event.target.value);
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
                    onClick={() => void recordSubmittedApplication()}
                  >
                    {recording
                      ? "Recording application…"
                      : "I submitted · Record application"}
                  </button>
                  <p className="memory-note">
                    Click only after you submit the form yourself. CareerOS
                    never clicks Submit.
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
              {recordError ? (
                <p className="memory-error">{recordError}</p>
              ) : null}
            </>
          ) : (
            <p>
              Sign in and keep this application page open to save durable
              context.
            </p>
          )}
        </section>
      ) : null}

      {!authenticated && auth.state !== "loading" ? (
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: __CAREEROS_WEB_URL__ })}
        >
          Open CareerOS to sign in
        </button>
      ) : null}

      <footer>CareerOS never submits an application for you.</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
