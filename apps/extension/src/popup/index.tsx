import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AnswerSection } from "./answer-section";
import { AttachResumeSection } from "./attach-resume-section";
import { AuthSection } from "./auth-section";
import { ClipSection } from "./clip-section";
import { ConnectionDiagnostic } from "./connection-diagnostic";
import { DetectionSection } from "./detection-section";
import { FillSection } from "./fill-section";
import { PopupFooter } from "./footer";
import { MemorySection } from "./memory-section";
import { SaveAnswersSection } from "./save-answers-section";
import { usePopupState } from "./use-popup-state";
import { t } from "../shared/i18n";

function App() {
  const {
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
    pinnedTab,
    detection,
    approvedFields,
    hasReviewPlan,
    shouldPrepareForRecovery,
    applyApprovedAnswers,
    resolveForResume,
    openPageAssistant,
    recordSubmittedApplication,
    resetPrepareKey,
    resetRecordKey,
  } = usePopupState();

  return (
    <main>
      <header>
        <span className="eyebrow">{t("APPLY ANYWHERE")}</span>
        <h1>CareerOS</h1>
      </header>

      <AuthSection auth={auth} authenticated={authenticated} />

      <DetectionSection title={detectionTitle} body={detectionBody} />

      {answers ? (
        <AnswerSection
          answers={answers}
          resolvedAnswerCopy={resolvedAnswerCopy}
        />
      ) : null}

      <FillSection
        hasReviewPlan={hasReviewPlan}
        approvedFields={approvedFields}
        shouldPrepareForRecovery={shouldPrepareForRecovery}
        preparingApplication={preparingApplication}
        fillResult={fillResult}
        resolvedFillCopy={resolvedFillCopy}
        applicationContext={applicationContext}
        onApply={() => void applyApprovedAnswers()}
      />

      {authenticated && detection && applicationContext?.state === "ready" ? (
        <AttachResumeSection
          tab={pinnedTab}
          detection={detection}
          resumeVersionId={resumeVersionId}
          resumeVersions={applicationContext.value.resumeVersions}
        />
      ) : null}

      {applicationContext ? (
        <MemorySection
          applicationContext={applicationContext}
          recordedApplication={recordedApplication}
          company={company}
          setCompany={setCompany}
          role={role}
          setRole={setRole}
          resumeVersionId={resumeVersionId}
          setResumeVersionId={setResumeVersionId}
          useTrackedApplication={useTrackedApplication}
          setUseTrackedApplication={setUseTrackedApplication}
          recording={recording}
          recordError={recordError}
          onRecord={() => void recordSubmittedApplication()}
          onResolveForResume={(id) => void resolveForResume(id)}
          onResetPrepareKey={resetPrepareKey}
          onResetRecordKey={resetRecordKey}
        />
      ) : null}

      {authenticated && applicationContext ? (
        <SaveAnswersSection tab={pinnedTab} />
      ) : null}

      {authenticated ? <ClipSection tab={pinnedTab} /> : null}

      {auth.state === "error" ? (
        <ConnectionDiagnostic
          onOpenSetupGuide={() =>
            chrome.tabs.create({ url: `${__CAREEROS_WEB_URL__}/setup` })
          }
        />
      ) : null}

      <button
        type="button"
        disabled={openingAssistant || !hasPinnedTab}
        onClick={() => void openPageAssistant()}
      >
        {openingAssistant
          ? t("Opening assistant on page…")
          : t("Open assistant on page")}
      </button>
      {assistantError ? <p className="memory-error">{assistantError}</p> : null}

      {!authenticated && auth.state !== "loading" ? (
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: __CAREEROS_WEB_URL__ })}
        >
          {t("Open CareerOS to sign in")}
        </button>
      ) : null}

      <PopupFooter />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
