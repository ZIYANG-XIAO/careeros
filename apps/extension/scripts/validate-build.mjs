import { readFile } from "node:fs/promises";
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
    "M10 must not expose a persistent or externally callable page bridge.",
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

for (const file of ["background.js", "content.js", "popup.js"]) {
  const bundle = await readFile(path.join(buildDir, file), "utf8");
  if (/sk_(?:test|live)_/i.test(bundle)) {
    throw new Error(`A Clerk secret key was bundled into ${file}.`);
  }
}

console.log("Validated M10 extension permissions and credential boundaries.");
