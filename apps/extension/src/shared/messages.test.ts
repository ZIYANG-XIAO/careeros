import { describe, expect, it } from "vitest";

import { parseContentRequest, parsePopupRequest } from "./messages";

describe("extension message validation", () => {
  it("accepts only known exact popup messages", () => {
    expect(parsePopupRequest({ type: "CAREEROS_GET_AUTH_STATUS" })).toEqual({
      type: "CAREEROS_GET_AUTH_STATUS",
    });
    expect(parsePopupRequest({ type: "CAREEROS_DETECT_ACTIVE_PAGE" })).toEqual({
      type: "CAREEROS_DETECT_ACTIVE_PAGE",
    });
    expect(
      parsePopupRequest({
        type: "CAREEROS_GET_AUTH_STATUS",
        token: "steal-me",
      }),
    ).toBeNull();
    expect(parsePopupRequest({ type: "UNKNOWN" })).toBeNull();
  });

  it("keeps the content-script contract narrow", () => {
    expect(parseContentRequest({ type: "CAREEROS_INSPECT_PAGE" })).toEqual({
      type: "CAREEROS_INSPECT_PAGE",
    });
    expect(
      parseContentRequest({ type: "CAREEROS_INSPECT_PAGE", html: "<body />" }),
    ).toBeNull();
  });
});
