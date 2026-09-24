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

  it("validates bounded answer-resolution messages", () => {
    const request = {
      type: "CAREEROS_RESOLVE_ANSWERS",
      fields: [
        {
          fieldId: "field-1",
          canonicalKey: "CONTACT_EMAIL",
          question: "Email",
          controlType: "EMAIL",
          required: true,
          mappingConfidence: "HIGH",
          options: [],
        },
      ],
      selectedResumeVersionId: null,
    };
    expect(parsePopupRequest(request)).toEqual(request);
    expect(parsePopupRequest({ ...request, token: "steal-me" })).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        fields: Array.from({ length: 201 }, (_, index) => ({
          ...request.fields[0],
          fieldId: `field-${index}`,
        })),
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        fields: [{ ...request.fields[0], question: "x".repeat(501) }],
      }),
    ).toBeNull();
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
