import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const buildDir = path.join(extensionRoot, "build");
const manifest = JSON.parse(
  await readFile(path.join(buildDir, "manifest.json"), "utf8"),
);

for (const size of [16, 32, 48, 128]) {
  const iconPath = `icons/icon-${size}.png`;
  if (manifest.icons?.[size] !== iconPath) {
    throw new Error(`Extension manifest is missing its ${size}px brand icon.`);
  }
  await readFile(path.join(buildDir, iconPath));
}

if (typeof manifest.key !== "string" || manifest.key.length === 0) {
  throw new Error(
    "The development extension must have a stable CRX public key.",
  );
}
const extensionId = createHash("sha256")
  .update(Buffer.from(manifest.key, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (character) =>
    String.fromCharCode("a".charCodeAt(0) + Number.parseInt(character, 16)),
  );
if (extensionId !== "ibihlmjmbfjegkljfjihhakppeagbpkf") {
  throw new Error("The development CRX ID changed unexpectedly.");
}

const expectedPermissions = ["activeTab", "cookies", "scripting", "storage"];
if (
  JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)
) {
  throw new Error(
    "Extension permissions differ from the reviewed M10 minimum.",
  );
}
// The only extra origins the extension may ever hold are these career sites,
// and only as optional permissions the user grants from settings.
const expectedOptionalHosts = [
  "https://boards.greenhouse.io/*",
  "https://job-boards.greenhouse.io/*",
  "https://jobs.lever.co/*",
  "https://jobs.ashbyhq.com/*",
  "https://*.myworkdayjobs.com/*",
];
if (
  JSON.stringify(manifest.optional_host_permissions) !==
  JSON.stringify(expectedOptionalHosts)
) {
  throw new Error(
    "Optional host permissions differ from the reviewed career-site list.",
  );
}
if (manifest.content_scripts || manifest.externally_connectable) {
  throw new Error(
    "The extension must not expose a persistent or externally callable page bridge.",
  );
}
if (
  !Array.isArray(manifest.host_permissions) ||
  manifest.host_permissions.some((permission) => permission === "<all_urls>")
) {
  throw new Error("M10 must use explicit service hosts, never <all_urls>.");
}

const contentScript = await readFile(path.join(buildDir, "content.js"), "utf8");
if (/Authorization|Bearer|CLERK|session.?token/i.test(contentScript)) {
  throw new Error(
    "Privileged authentication material leaked into the content script.",
  );
}
// The resume-attach flow may assign the user's chosen CareerOS resume to an
// empty file input and check whether one is already chosen, but content code
// must never open or read a file the user selected, nor raw page HTML.
if (
  /\.files\s*\??\.?\[|FileReader|readAsDataURL|readAsArrayBuffer|readAsText|innerHTML|outerHTML/.test(
    contentScript,
  )
) {
  throw new Error(
    "Content execution must not read selected files or raw page HTML.",
  );
}
if (
  !/attachShadow|data-careeros-assistant|CAREEROS_ACTIVATE_ASSISTANT/.test(
    contentScript,
  )
) {
  throw new Error(
    "Phase B in-page assistant must mount in an isolated Shadow DOM after explicit activation.",
  );
}
if (
  !/CAREEROS_APPLY_FILL_PLAN/.test(contentScript) ||
  !/data-careeros-field-state/.test(contentScript)
) {
  throw new Error(
    "M13 content execution and visible review state are missing.",
  );
}
if (/requestSubmit|\.submit\s*\(/.test(contentScript)) {
  throw new Error("M13 content execution must never submit an application.");
}

for (const file of ["background.js", "content.js", "popup.js"]) {
  const bundle = await readFile(path.join(buildDir, file), "utf8");
  if (/sk_(?:test|live)_/i.test(bundle)) {
    throw new Error(`A Clerk secret key was bundled into ${file}.`);
  }
}

const backgroundScript = await readFile(
  path.join(buildDir, "background.js"),
  "utf8",
);
const popupScript = await readFile(path.join(buildDir, "popup.js"), "utf8");
if (!/applications\/assistant-context/.test(backgroundScript)) {
  throw new Error(
    "M16 must use the data-minimized assistant context endpoint.",
  );
}
if (/extracted_text|structured_content/.test(backgroundScript + popupScript)) {
  throw new Error(
    "Resume content must not be bundled into the extension context workflow.",
  );
}

if (!manifest.commands?.["activate-assistant"]) {
  throw new Error(
    "Phase B must expose a keyboard shortcut for explicit assistant activation.",
  );
}

console.log(
  `Validated M16 permissions, Phase B assistant activation, minimized context, execution boundaries, and CRX ID ${extensionId}.`,
);
