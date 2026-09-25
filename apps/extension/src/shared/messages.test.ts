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
      parsePopupRequest({ type: "CAREEROS_GET_APPLICATION_CONTEXT" }),
    ).toEqual({ type: "CAREEROS_GET_APPLICATION_CONTEXT" });
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

  it("accepts only exact bounded fill plans", () => {
    const request = {
      type: "CAREEROS_APPLY_FILL_PLAN",
      fields: [
        {
          fieldId: "field-1",
          canonicalKey: "CONTACT_EMAIL",
          controlType: "EMAIL",
          action: "FILL",
          proposedAnswer: "candidate@example.com",
        },
        {
          fieldId: "field-2",
          canonicalKey: null,
          controlType: "TEXT",
          action: "ASK",
          proposedAnswer: null,
        },
      ],
    };
    expect(parsePopupRequest(request)).toEqual(request);
    expect(parseContentRequest(request)).toEqual(request);
    expect(
      parsePopupRequest({
        ...request,
        fields: [{ ...request.fields[0], token: "steal-me" }],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        fields: [{ ...request.fields[0], proposedAnswer: null }],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        fields: [
          { ...request.fields[0], action: "ASK", proposedAnswer: "guess" },
        ],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        fields: [
          {
            ...request.fields[0],
            canonicalKey: "RESUME_FILE",
            controlType: "FILE",
            proposedAnswer: "resume.pdf",
          },
        ],
      }),
    ).toBeNull();
  });

  it("validates reviewed application recording without exposing it to content scripts", () => {
    const request = {
      type: "CAREEROS_RECORD_APPLICATION",
      applicationId: null,
      company: "Acme",
      role: "Engineer",
      resumeVersionId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      answers: [
        {
          canonicalKey: "CONTACT_EMAIL",
          questionText: "Email",
          answerText: "candidate@example.com",
          sourceCategory: "IDENTITY",
        },
      ],
    };
    expect(parsePopupRequest(request)).toEqual(request);
    expect(parseContentRequest(request)).toBeNull();
    expect(
      parsePopupRequest({ ...request, company: "", token: "steal-me" }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...request,
        answers: [{ ...request.answers[0], sourceCategory: "UNKNOWN" }],
      }),
    ).toBeNull();
  });

  it("validates bounded application preparation without exposing it to content scripts", () => {
    const request = {
      type: "CAREEROS_PREPARE_APPLICATION",
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    };
    expect(parsePopupRequest(request)).toEqual(request);
    expect(parseContentRequest(request)).toBeNull();
    expect(parsePopupRequest({ ...request, company: "" })).toBeNull();
    expect(parsePopupRequest({ ...request, unexpected: true })).toBeNull();
  });
});
