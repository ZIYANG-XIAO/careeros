import { ApiError, type ApiErrorCategory } from "./api";
import type { MessageKey } from "./i18n";

const defaultMessages: Record<ApiErrorCategory, string> = {
  unauthenticated: "Your session expired. Sign in again to continue.",
  forbidden: "You do not have permission to view this data.",
  not_found: "The requested resource was not found.",
  conflict: "This action conflicts with existing data.",
  validation: "The request could not be processed.",
  rate_limit: "Too many requests. Please try again shortly.",
  server: "The server encountered an error. Please try again.",
  unavailable: "CareerOS is temporarily unavailable. Please try again shortly.",
  network: "We could not reach CareerOS. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};

const categoryToKey: Record<ApiErrorCategory, MessageKey> = {
  unauthenticated: "errors.unauthenticated",
  forbidden: "errors.forbidden",
  not_found: "errors.not_found",
  conflict: "errors.conflict",
  validation: "errors.validation",
  rate_limit: "errors.rate_limit",
  server: "errors.server",
  unavailable: "errors.unavailable",
  network: "errors.network",
  unknown: "errors.unknown",
};

export function getApiErrorMessage(
  error: ApiError,
  t?: (key: MessageKey) => string,
): string {
  if (t) {
    return t(categoryToKey[error.category]);
  }
  return defaultMessages[error.category];
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TypeError) {
    return new ApiError("Network request failed", 0, "network", error.message);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 0, "unknown");
  }
  return new ApiError("Something went wrong", 0, "unknown");
}
