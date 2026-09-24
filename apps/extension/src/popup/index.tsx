import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AuthStatus,
  ExtensionResponse,
  PageDetection,
  PopupRequest,
} from "../shared/messages";
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
      .then((response) => {
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
      })
      .catch(() =>
        setDetection({
          state: "error",
          message: "This page could not be inspected.",
        }),
      );
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
