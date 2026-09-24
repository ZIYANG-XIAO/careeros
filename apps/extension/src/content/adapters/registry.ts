import { ashbyFormAdapter } from "./ashby";
import { genericFormAdapter } from "./generic";
import { greenhouseFormAdapter } from "./greenhouse";
import { leverFormAdapter } from "./lever";
import type { FormAdapter } from "./types";

const adapters: readonly FormAdapter[] = [
  greenhouseFormAdapter,
  leverFormAdapter,
  ashbyFormAdapter,
  genericFormAdapter,
];

export function selectFormAdapter(document: Document, url: URL): FormAdapter {
  return adapters.find((adapter) => adapter.matches(document, url))!;
}
