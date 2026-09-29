import { execSync } from "node:child_process";
import { context } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(extensionRoot, "../..");
const buildDir = path.join(extensionRoot, "build");
const watch = process.argv.includes("--watch");

async function readEnvironment(file) {
  try {
    const content = await readFile(file, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separator = line.indexOf("=");
          return [
            line.slice(0, separator),
            line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
          ];
        }),
    );
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

const environment = {
  ...(await readEnvironment(path.join(repositoryRoot, ".env"))),
  ...(await readEnvironment(path.join(repositoryRoot, "apps/web/.env.local"))),
  ...(await readEnvironment(path.join(extensionRoot, ".env.local"))),
  ...process.env,
};
const developmentCrxPublicKey = (
  await readFile(path.join(extensionRoot, "crx-public-key.txt"), "utf8")
).trim();

const config = {
  apiUrl:
    environment.EXTENSION_API_URL ??
    environment.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000",
  webUrl: environment.EXTENSION_WEB_URL ?? "http://localhost:3000",
  publishableKey:
    environment.EXTENSION_CLERK_PUBLISHABLE_KEY ??
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  frontendApi:
    environment.EXTENSION_CLERK_FRONTEND_API ?? environment.CLERK_ISSUER_URL,
  syncHost: environment.EXTENSION_CLERK_SYNC_HOST ?? "http://localhost",
  crxPublicKey: environment.EXTENSION_CRX_PUBLIC_KEY || developmentCrxPublicKey,
};

if (!config.publishableKey || !config.frontendApi) {
  throw new Error(
    "Missing Clerk extension configuration. See apps/extension/.env.example.",
  );
}

async function resolveBuildVersion() {
  try {
    const hash = execSync("git rev-parse --short HEAD", {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (hash) return hash;
  } catch {
    // Fall back to the package version when git is unavailable.
  }
  const packageJson = JSON.parse(
    await readFile(path.join(extensionRoot, "package.json"), "utf8"),
  );
  return packageJson.version ?? "dev";
}

const buildVersion = await resolveBuildVersion();

function hostPermission(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}/*`;
}

const manifest = {
  manifest_version: 3,
  name: "CareerOS Application Assistant",
  description:
    "Detect and normalize application forms and connect them securely to CareerOS.",
  version: "0.1.0",
  permissions: ["activeTab", "cookies", "scripting", "storage"],
  host_permissions: [
    ...new Set([
      hostPermission(config.apiUrl),
      hostPermission(config.syncHost),
      hostPermission(config.frontendApi),
    ]),
  ],
  action: {
    default_title: "CareerOS Application Assistant",
    default_popup: "popup.html",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  background: {
    service_worker: "background.js",
    type: "module",
  },
  commands: {
    "activate-assistant": {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K",
      },
      description: "Open the CareerOS in-page assistant on the active tab",
    },
  },
};

manifest.key = config.crxPublicKey;

await mkdir(buildDir, { recursive: true });
await Promise.all([
  writeFile(
    path.join(buildDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  ),
  cp(
    path.join(extensionRoot, "src/popup/index.html"),
    path.join(buildDir, "popup.html"),
  ),
  cp(
    path.join(extensionRoot, "src/popup/popup.css"),
    path.join(buildDir, "popup.css"),
  ),
  cp(path.join(extensionRoot, "src/icons"), path.join(buildDir, "icons"), {
    recursive: true,
  }),
]);

const define = {
  __CAREEROS_API_URL__: JSON.stringify(config.apiUrl.replace(/\/$/, "")),
  __CAREEROS_WEB_URL__: JSON.stringify(config.webUrl.replace(/\/$/, "")),
  __CAREEROS_BUILD_VERSION__: JSON.stringify(buildVersion),
  __CLERK_PUBLISHABLE_KEY__: JSON.stringify(config.publishableKey),
  __CLERK_SYNC_HOST__: JSON.stringify(config.syncHost.replace(/\/$/, "")),
};

const common = {
  bundle: true,
  sourcemap: true,
  target: "chrome120",
  define,
  logLevel: "info",
};

const builds = [
  await context({
    ...common,
    entryPoints: [path.join(extensionRoot, "src/background/index.ts")],
    outfile: path.join(buildDir, "background.js"),
    format: "esm",
  }),
  await context({
    ...common,
    entryPoints: [path.join(extensionRoot, "src/content/index.ts")],
    outfile: path.join(buildDir, "content.js"),
    format: "iife",
  }),
  await context({
    ...common,
    entryPoints: [path.join(extensionRoot, "src/popup/index.tsx")],
    outfile: path.join(buildDir, "popup.js"),
    format: "esm",
  }),
];

if (watch) {
  await Promise.all(builds.map((build) => build.watch()));
  console.log("CareerOS extension build is watching for changes.");
} else {
  await Promise.all(builds.map((build) => build.rebuild()));
  await Promise.all(builds.map((build) => build.dispose()));
}
