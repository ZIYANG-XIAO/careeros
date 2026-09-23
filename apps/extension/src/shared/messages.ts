export type DetectionStatus =
  "APPLICATION_PAGE" | "NOT_APPLICATION_PAGE" | "UNSUPPORTED_PAGE";

export interface PageDetection {
  status: DetectionStatus;
  adapter: "generic" | null;
  reasons: string[];
}

export interface AuthStatus {
  authenticated: boolean;
}

export type PopupRequest =
  | { type: "CAREEROS_GET_AUTH_STATUS" }
  | { type: "CAREEROS_DETECT_ACTIVE_PAGE" };

export type ContentRequest = { type: "CAREEROS_INSPECT_PAGE" };

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "UNSUPPORTED_PAGE" | "UNAVAILABLE";
    };

function isExactMessage(
  value: unknown,
  expectedType: PopupRequest["type"] | ContentRequest["type"],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && record.type === expectedType;
}

export function parsePopupRequest(value: unknown): PopupRequest | null {
  if (isExactMessage(value, "CAREEROS_GET_AUTH_STATUS")) {
    return { type: "CAREEROS_GET_AUTH_STATUS" };
  }
  if (isExactMessage(value, "CAREEROS_DETECT_ACTIVE_PAGE")) {
    return { type: "CAREEROS_DETECT_ACTIVE_PAGE" };
  }
  return null;
}

export function parseContentRequest(value: unknown): ContentRequest | null {
  return isExactMessage(value, "CAREEROS_INSPECT_PAGE")
    ? { type: "CAREEROS_INSPECT_PAGE" }
    : null;
}
