/**
 * Career sites where the user may opt in to an always-visible launcher.
 * These are the only origins the extension can ever request beyond its own
 * services, and only after an explicit settings toggle (optional permission).
 * Keep in sync with OPTIONAL_HOST_PERMISSIONS in scripts/build.mjs.
 */
export const ATS_ORIGIN_PATTERNS = [
  "https://boards.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://jobs.lever.co/*",
  "https://jobs.ashbyhq.com/*",
  "https://*.myworkdayjobs.com/*",
] as const;

const ATS_HOSTS = [
  /^boards\.greenhouse\.io$/,
  /^job-boards\.greenhouse\.io$/,
  /^jobs\.lever\.co$/,
  /^jobs\.ashbyhq\.com$/,
  /^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/,
];

export function isAtsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ATS_HOSTS.some((pattern) => pattern.test(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

export const AUTO_LAUNCHER_SCRIPT_ID = "careeros-auto-launcher";
export const AUTO_LAUNCHER_STORAGE_KEY = "careeros.autoLauncher";
