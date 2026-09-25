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
if (/\.files\b|innerHTML|outerHTML/.test(contentScript)) {
  throw new Error(
    "M13 content execution must not read selected files or raw page HTML.",
  );
}
if (/Authorization|Bearer|CAREEROS_RESOLVE_ANSWERS/.test(contentScript)) {
  throw new Error(
    "M13 content execution must not resolve answers or receive API credentials.",
  );
}
if (/CAREEROS_RECORD_APPLICATION/.test(contentScript)) {
  throw new Error(
    "M15 Application Memory operations must remain in the privileged background.",
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

console.log(
  `Validated M15 permissions, execution/Application Memory boundaries, and CRX ID ${extensionId}.`,
);
