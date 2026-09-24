import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AnswerResolution,
  AuthStatus,
  ExtensionResponse,
  PageDetection,
  PopupRequest,
} from "../shared/messages";
import { answerCopy } from "./answer-copy";
import { detectionCopy } from "./detection-copy";

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
        if (response.ok && response.data.status === "APPLICATION_PAGE") {
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
              selectedResumeVersionId: null,
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

  return (
    <main>
      <header>
        <span className="eyebrow">APPLY ANYWHERE</span>
        <h1>CareerOS</h1>
      </header>

      <section className="status-card" aria-live="polite">
        <span className={`status-dot ${authenticated ? "connected" : ""}`} />
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
