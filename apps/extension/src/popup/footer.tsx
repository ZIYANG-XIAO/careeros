import { t } from "../shared/i18n";

export function PopupFooter() {
  return (
    <footer>
      <p>{t("CareerOS never submits an application for you.")}</p>
      <p className="build-version">
        {t("Build {version}", { version: __CAREEROS_BUILD_VERSION__ })}
      </p>
    </footer>
  );
}
