type ConnectionDiagnosticProps = {
  onOpenSetupGuide: () => void;
};

export function ConnectionDiagnostic({
  onOpenSetupGuide,
}: ConnectionDiagnosticProps) {
  return (
    <section className="connection-diagnostic" aria-live="polite">
      <p>
        Connection issue —{" "}
        <button
          type="button"
          className="link-button"
          onClick={onOpenSetupGuide}
        >
          check setup guide
        </button>
      </p>
    </section>
  );
}
