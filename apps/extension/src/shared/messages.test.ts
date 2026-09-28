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
      market: "CHINA",
      formLocale: "zh-CN",
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
      parseContentRequest({ type: "CAREEROS_ACTIVATE_ASSISTANT" }),
    ).toEqual({ type: "CAREEROS_ACTIVATE_ASSISTANT" });
    expect(
      parseContentRequest({ type: "CAREEROS_DEACTIVATE_ASSISTANT" }),
    ).toEqual({ type: "CAREEROS_DEACTIVATE_ASSISTANT" });
    expect(
      parseContentRequest({ type: "CAREEROS_INSPECT_PAGE", html: "<body />" }),
    ).toBeNull();
    expect(parsePopupRequest({ type: "CAREEROS_ACTIVATE_ASSISTANT" })).toEqual({
      type: "CAREEROS_ACTIVATE_ASSISTANT",
    });
    expect(parsePopupRequest({ type: "CAREEROS_OPEN_SIGN_IN" })).toEqual({
      type: "CAREEROS_OPEN_SIGN_IN",
    });
    expect(
      parsePopupRequest({
        type: "CAREEROS_OPEN_APPLICATION",
        applicationId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      type: "CAREEROS_OPEN_APPLICATION",
      applicationId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("accepts only exact bounded fill plans", () => {
    const popupRequest = {
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
      expectedPageUrl: "https://example.com/apply",
    };
    const contentRequest = {
      ...popupRequest,
    };
    expect(parsePopupRequest(popupRequest)).toEqual(popupRequest);
    expect(parseContentRequest(contentRequest)).toEqual(contentRequest);
    expect(
      parsePopupRequest({
        ...popupRequest,
        fields: [{ ...popupRequest.fields[0], token: "steal-me" }],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...popupRequest,
        fields: [{ ...popupRequest.fields[0], proposedAnswer: null }],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...popupRequest,
        fields: [
          {
            ...popupRequest.fields[0],
            action: "ASK",
            proposedAnswer: "guess",
          },
        ],
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        ...popupRequest,
        fields: [
          {
            ...popupRequest.fields[0],
            canonicalKey: "RESUME_FILE",
            controlType: "FILE",
            proposedAnswer: "resume.pdf",
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects fill plan without expectedPageUrl", () => {
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
      ],
    };
    expect(parsePopupRequest(request)).toBeNull();
    expect(parseContentRequest(request)).toBeNull();
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
      expectedPageUrl: "https://example.com/apply",
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
    expect(
      parsePopupRequest({
        ...request,
        answers: [
          { ...request.answers[0], sourceCategory: "USER_CONTACT_INFO" },
        ],
      }),
    ).toEqual({
      ...request,
      answers: [{ ...request.answers[0], sourceCategory: "USER_CONTACT_INFO" }],
    });
  });

  it("rejects record without expectedPageUrl", () => {
    const request = {
      type: "CAREEROS_RECORD_APPLICATION",
      applicationId: null,
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      answers: [],
    };
    expect(parsePopupRequest(request)).toBeNull();
  });

  it("validates bounded application preparation without exposing it to content scripts", () => {
    const request = {
      type: "CAREEROS_PREPARE_APPLICATION",
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      expectedPageUrl: "https://example.com/apply",
    };
    expect(parsePopupRequest(request)).toEqual(request);
    expect(parseContentRequest(request)).toBeNull();
    expect(parsePopupRequest({ ...request, company: "" })).toBeNull();
    expect(parsePopupRequest({ ...request, unexpected: true })).toBeNull();
  });

  it("rejects prepare without expectedPageUrl", () => {
    const request = {
      type: "CAREEROS_PREPARE_APPLICATION",
      company: "Acme",
      role: "Engineer",
      resumeVersionId: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    };
    expect(parsePopupRequest(request)).toBeNull();
  });

  it("accepts tab context request", () => {
    expect(parsePopupRequest({ type: "CAREEROS_GET_TAB_CONTEXT" })).toEqual({
      type: "CAREEROS_GET_TAB_CONTEXT",
    });
  });

  it("accepts detect with tab binding", () => {
    const request = {
      type: "CAREEROS_DETECT_ACTIVE_PAGE",
      expectedTabId: 42,
      expectedPageUrl: "https://example.com/apply",
    };
    expect(parsePopupRequest(request)).toEqual(request);
  });

  it("accepts detect without tab binding (content script path)", () => {
    expect(parsePopupRequest({ type: "CAREEROS_DETECT_ACTIVE_PAGE" })).toEqual({
      type: "CAREEROS_DETECT_ACTIVE_PAGE",
    });
  });

  it("rejects detect with invalid tab binding", () => {
    expect(
      parsePopupRequest({
        type: "CAREEROS_DETECT_ACTIVE_PAGE",
        expectedTabId: 0,
        expectedPageUrl: "https://example.com/apply",
      }),
    ).toBeNull();
    expect(
      parsePopupRequest({
        type: "CAREEROS_DETECT_ACTIVE_PAGE",
        expectedTabId: 42,
      }),
    ).toBeNull();
  });

  it("accepts context with tab binding", () => {
    const request = {
      type: "CAREEROS_GET_APPLICATION_CONTEXT",
      expectedTabId: 42,
      expectedPageUrl: "https://example.com/apply",
    };
    expect(parsePopupRequest(request)).toEqual(request);
  });

  it("accepts assistant activation with tab binding", () => {
    const request = {
      type: "CAREEROS_ACTIVATE_ASSISTANT",
      expectedTabId: 42,
      expectedPageUrl: "https://example.com/apply",
    };
    expect(parsePopupRequest(request)).toEqual(request);
  });

  it("rejects tab-bound messages with extra fields", () => {
    expect(
      parsePopupRequest({
        type: "CAREEROS_DETECT_ACTIVE_PAGE",
        expectedTabId: 42,
        expectedPageUrl: "https://example.com",
        token: "steal-me",
      }),
    ).toBeNull();
  });
});

describe("job clip requests", () => {
  const clip = {
    type: "CAREEROS_CLIP_JOB",
    title: "Engineer",
    company: "Acme",
    location: null,
    description: "A description that is long enough.",
    market: "UNKNOWN",
    countryCode: "UNKNOWN",
    workplaceType: "UNKNOWN",
    employmentType: "UNKNOWN",
    expectedPageUrl: "https://example.com/jobs/1",
    expectedTabId: 3,
  };

  it("accepts a well-formed clip and tab-bound extraction", () => {
    expect(parsePopupRequest(clip)).toEqual(clip);
    expect(
      parsePopupRequest({
        type: "CAREEROS_EXTRACT_JOB",
        expectedTabId: 3,
        expectedPageUrl: "https://example.com/jobs/1",
      }),
    ).not.toBeNull();
    expect(parseContentRequest({ type: "CAREEROS_EXTRACT_JOB" })).toEqual({
      type: "CAREEROS_EXTRACT_JOB",
    });
  });

  it("rejects extra keys, bad enums, and short descriptions", () => {
    expect(parsePopupRequest({ ...clip, sourceUrl: "https://x" })).toBeNull();
    expect(parsePopupRequest({ ...clip, market: "EUROPE" })).toBeNull();
    expect(parsePopupRequest({ ...clip, description: "short" })).toBeNull();
    expect(parsePopupRequest({ ...clip, title: "  " })).toBeNull();
    expect(
      parsePopupRequest({ type: "CAREEROS_OPEN_JOB", jobId: "nope" }),
    ).toBeNull();
  });
});

describe("reusable answer requests", () => {
  it("accepts bounded save batches and tab-bound reads", () => {
    const save = {
      type: "CAREEROS_SAVE_REUSABLE_ANSWERS",
      answers: [{ question: "How did you hear about us?", answer: "A friend" }],
    };
    expect(parsePopupRequest(save)).toEqual(save);
    expect(parsePopupRequest({ ...save, answers: [] })).toBeNull();
    expect(
      parsePopupRequest({
        ...save,
        answers: [{ question: "Q", answer: "A", extra: 1 }],
      }),
    ).toBeNull();
    expect(
      parseContentRequest({ type: "CAREEROS_READ_CUSTOM_ANSWERS" }),
    ).toEqual({ type: "CAREEROS_READ_CUSTOM_ANSWERS" });
  });

  it("allows FILL on a custom radio group but not on a canonical one", () => {
    const plan = (canonicalKey: string | null) => ({
      type: "CAREEROS_APPLY_FILL_PLAN",
      fields: [
        {
          fieldId: "f",
          canonicalKey,
          controlType: "RADIO_GROUP",
          action: "FILL",
          proposedAnswer: "Yes",
        },
      ],
      expectedPageUrl: "https://example.com/apply",
    });
    expect(parsePopupRequest(plan(null))).not.toBeNull();
    expect(parsePopupRequest(plan("CONTACT_EMAIL"))).toBeNull();
  });
});

describe("attach resume requests", () => {
  it("validates popup and content attach messages", () => {
    const popup = {
      type: "CAREEROS_ATTACH_RESUME",
      fieldId: "field-0-3",
      resumeVersionId: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
      expectedPageUrl: "https://example.com/apply",
    };
    expect(parsePopupRequest(popup)).toEqual(popup);
    expect(
      parsePopupRequest({ ...popup, resumeVersionId: "../etc" }),
    ).toBeNull();

    const content = {
      type: "CAREEROS_ATTACH_RESUME",
      fieldId: "field-0-3",
      expectedPageUrl: "https://example.com/apply",
      fileName: "resume.pdf",
      contentType: "application/pdf",
      base64: "JVBERg==",
    };
    expect(parseContentRequest(content)).toEqual(content);
    expect(
      parseContentRequest({ ...content, base64: "not base64!" }),
    ).toBeNull();
  });
});
