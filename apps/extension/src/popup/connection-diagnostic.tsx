import { t } from "../shared/i18n";

type ConnectionDiagnosticProps = {
  onOpenSetupGuide: () => void;
};

export function ConnectionDiagnostic({
  onOpenSetupGuide,
}: ConnectionDiagnosticProps) {
  return (
    <section className="connection-diagnostic" aria-live="polite">
      <p>
        {t("Connection issue —")}{" "}
        <button
          type="button"
          className="link-button"
          onClick={onOpenSetupGuide}
        >
          {t("check setup guide")}
        </button>
      </p>
    </section>
  );
}
