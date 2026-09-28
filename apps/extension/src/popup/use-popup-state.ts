import { useEffect, useRef, useState } from "react";
import type {
  AnswerResolution,
  ApplicationPageContext,
  AuthStatus,
  ExtensionResponse,
  FillExecutionResult,
  PageDetection,
  PopupRequest,
  TabContext,
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
import { t } from "../shared/i18n";

export type LoadState<T> =
  | { state: "loading" }
  | { state: "ready"; value: T }
  | { state: "error"; message: string };

async function send<T>(request: PopupRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(request) as Promise<ExtensionResponse<T>>;
}

export function usePopupState() {
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
  const [openingAssistant, setOpeningAssistant] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [hasPinnedTab, setHasPinnedTab] = useState(false);
  const pinnedTab = useRef<TabContext | null>(null);
  const prepareKey = useRef(crypto.randomUUID());
  const recordKey = useRef(crypto.randomUUID());

  useEffect(() => {
    void send<AuthStatus>({ type: "CAREEROS_GET_AUTH_STATUS" })
      .then((response) => {
        setAuth(
          response.ok
            ? { state: "ready", value: response.data }
            : { state: "error", message: t("CareerOS is unavailable.") },
        );
      })
      .catch(() =>
        setAuth({ state: "error", message: t("CareerOS is unavailable.") }),
      );

    void (async () => {
      let tab: TabContext;
      try {
        const tabCtx = await send<TabContext>({
          type: "CAREEROS_GET_TAB_CONTEXT",
        });
        if (
          !tabCtx.ok ||
          !tabCtx.data.tabId ||
          tabCtx.data.tabId <= 0 ||
          !tabCtx.data.tabUrl
        ) {
          setDetection({
            state: "error",
            message: t(
              "Could not identify the active tab. Close and reopen the popup.",
            ),
          });
          return;
        }
        tab = tabCtx.data;
        pinnedTab.current = tab;
        setHasPinnedTab(true);
      } catch {
        setDetection({
          state: "error",
          message: t(
            "Could not identify the active tab. Close and reopen the popup.",
          ),
        });
        return;
      }

      try {
        const response = await send<PageDetection>({
          type: "CAREEROS_DETECT_ACTIVE_PAGE",
          expectedTabId: tab.tabId,
          expectedPageUrl: tab.tabUrl,
        });
        if (!response.ok) {
          setDetection({
            state: "error",
            message:
              response.error === "UNSUPPORTED_PAGE"
                ? t("Open a normal web page to use CareerOS.")
                : response.error === "STALE_PAGE"
                  ? t("This tab changed. Close and reopen the popup.")
                  : t("This page could not be inspected."),
          });
          return;
        }
        setDetection({ state: "ready", value: response.data });
        if (response.data.status === "UNSUPPORTED_PAGE") return;

        const isApplicationPage = response.data.status === "APPLICATION_PAGE";
        let selectedResumeVersionId: string | null = null;
        let market: "UNKNOWN" | "NORTH_AMERICA" | "CHINA" = "UNKNOWN";

        if (isApplicationPage) setApplicationContext({ state: "loading" });
        try {
          const contextResponse = await send<ApplicationPageContext>({
            type: "CAREEROS_GET_APPLICATION_CONTEXT",
            expectedTabId: tab.tabId,
            expectedPageUrl: tab.tabUrl,
          });
          if (contextResponse.ok) {
            const shouldShowContext = shouldShowApplicationMemory(
              response.data.status,
              contextResponse.data,
            );
            if (shouldShowContext) {
              const initial = initialApplicationFields(contextResponse.data);
              selectedResumeVersionId = initial.resumeVersionId || null;
              market = contextResponse.data.application?.market ?? "UNKNOWN";
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
                  ? t("Sign in to record this application.")
                  : contextResponse.error === "STALE_PAGE"
                    ? t("This tab changed. Close and reopen the popup.")
                    : t("Application context is unavailable."),
            });
          }
        } catch {
          if (isApplicationPage) {
            setApplicationContext({
              state: "error",
              message: t("Application context is unavailable."),
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
            market,
            formLocale: response.data.formLocale ?? null,
          });
          setAnswers(
            answerResponse.ok
              ? { state: "ready", value: answerResponse.data }
              : {
                  state: "error",
                  message:
                    answerResponse.error === "UNAUTHENTICATED"
                      ? t("Sign in to preview safe answers.")
                      : t("Answer decisions are unavailable."),
                },
          );
        } catch {
          setAnswers({
            state: "error",
            message: t("Answer decisions are unavailable."),
          });
        }
      } catch {
        setDetection({
          state: "error",
          message: t("This page could not be inspected."),
        });
      }
    })();
  }, []);

  const authenticated = auth.state === "ready" && auth.value.authenticated;
  const copy =
    detection.state === "ready" ? detectionCopy(detection.value) : null;
  const detectionTitle =
    detection.state === "loading"
      ? t("Checking this page…")
      : detection.state === "ready"
        ? copy!.title
        : detection.message;
  const detectionBody =
    detection.state === "ready"
      ? copy!.body
      : t("CareerOS only inspects the active tab when you open it.");
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
    const tab = pinnedTab.current;
    if (!tab?.tabUrl) {
      setFillResult({
        state: "error",
        message: t(
          "Page context is unavailable. Close the popup and try again.",
        ),
      });
      return;
    }
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
          expectedPageUrl: tab.tabUrl,
          expectedTabId: tab.tabId,
        });
        if (!prepared.ok) {
          if (prepared.error === "STALE_PAGE") {
            setRecordError(
              t(
                "This page changed. Close the popup and reopen on the application page.",
              ),
            );
            return;
          }
          throw new Error(prepared.error);
        }
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
          t(
            "CareerOS could not save recovery context, but you can still fill and submit manually.",
          ),
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
        expectedPageUrl: tab.tabUrl,
        expectedTabId: tab.tabId,
      });
      setFillResult(
        response.ok
          ? { state: "ready", value: response.data }
          : {
              state: "error",
              message:
                response.error === "STALE_PAGE"
                  ? t(
                      "This page changed before fill could finish. Close the popup and try again.",
                    )
                  : t("The page could not be updated."),
            },
      );
    } catch {
      setFillResult({
        state: "error",
        message: t("The page could not be updated."),
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
        market:
          applicationContext?.state === "ready"
            ? (applicationContext.value.application?.market ?? "UNKNOWN")
            : "UNKNOWN",
        formLocale: detection.value.formLocale ?? null,
      });
      setAnswers(
        response.ok
          ? { state: "ready", value: response.data }
          : { state: "error", message: t("Answer decisions are unavailable.") },
      );
    } catch {
      setAnswers({
        state: "error",
        message: t("Answer decisions are unavailable."),
      });
    }
  }

  async function openPageAssistant(): Promise<void> {
    const tab = pinnedTab.current;
    if (!tab) {
      setAssistantError(
        t("No active tab identified. Close and reopen the popup."),
      );
      return;
    }
    setOpeningAssistant(true);
    setAssistantError(null);
    try {
      const response = await send<{ active: boolean }>({
        type: "CAREEROS_ACTIVATE_ASSISTANT",
        expectedTabId: tab.tabId,
        expectedPageUrl: tab.tabUrl,
      });
      if (!response.ok) {
        setAssistantError(
          response.error === "UNSUPPORTED_PAGE"
            ? t("Open a normal web page first.")
            : t("The in-page assistant could not be opened."),
        );
      }
    } catch {
      setAssistantError(t("The in-page assistant could not be opened."));
    } finally {
      setOpeningAssistant(false);
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
      detection.state === "ready" ? detection.value : null,
    );
    const tab = pinnedTab.current;
    if (!tab?.tabUrl) {
      setRecordError(
        t("Page context is unavailable. Close the popup and try again."),
      );
      setRecording(false);
      return;
    }
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
        expectedPageUrl: tab.tabUrl,
        expectedTabId: tab.tabId,
      });
      if (!response.ok) {
        if (response.error === "STALE_PAGE") {
          setRecordError(
            t(
              "This page changed. Close the popup and reopen on the application page.",
            ),
          );
          return;
        }
        throw new Error(response.error);
      }
      setRecordedApplication(response.data);
    } catch {
      setRecordError(
        t(
          "CareerOS could not record this application. Your details remain here so you can retry.",
        ),
      );
    } finally {
      setRecording(false);
    }
  }

  function resetPrepareKey(): void {
    prepareKey.current = crypto.randomUUID();
  }

  function resetRecordKey(): void {
    recordKey.current = crypto.randomUUID();
  }

  return {
    auth,
    authenticated,
    detectionTitle,
    detectionBody,
    answers,
    resolvedAnswerCopy,
    fillResult,
    resolvedFillCopy,
    applicationContext,
    company,
    setCompany,
    role,
    setRole,
    resumeVersionId,
    setResumeVersionId,
    useTrackedApplication,
    setUseTrackedApplication,
    preparingApplication,
    recording,
    recordError,
    recordedApplication,
    openingAssistant,
    assistantError,
    hasPinnedTab,
    pinnedTab: hasPinnedTab ? pinnedTab.current : null,
    detection: detection.state === "ready" ? detection.value : null,
    approvedFields,
    hasReviewPlan,
    shouldPrepareForRecovery,
    applyApprovedAnswers,
    resolveForResume,
    openPageAssistant,
    recordSubmittedApplication,
    resetPrepareKey,
    resetRecordKey,
  };
}
