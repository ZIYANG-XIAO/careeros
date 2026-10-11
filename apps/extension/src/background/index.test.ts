import { beforeEach, describe, expect, it, vi } from "vitest";

const EXTENSION_ID = "test-extension-id";
const TAB_A_URL = "https://boards.greenhouse.io/acme/jobs/123";
const TAB_B_URL = "https://example.com/other";
const IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000000001";

const {
  mockGetAuthStatus,
  mockReportPresence,
  mockResolveAnswers,
  mockGetApplicationContext,
  mockRecordApplication,
  mockPrepareApplication,
  mockTabsQuery,
  mockTabsGet,
  mockTabsSendMessage,
  mockTabsCreate,
  mockExecuteScript,
} = vi.hoisted(() => ({
  mockGetAuthStatus: vi.fn(),
  mockReportPresence: vi.fn(),
  mockResolveAnswers: vi.fn(),
  mockGetApplicationContext: vi.fn(),
  mockRecordApplication: vi.fn(),
  mockPrepareApplication: vi.fn(),
  mockTabsQuery: vi.fn(),
  mockTabsGet: vi.fn(),
  mockTabsSendMessage: vi.fn(),
  mockTabsCreate: vi.fn(),
  mockExecuteScript: vi.fn(),
}));

let onMessageListener:
  | ((
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => boolean)
  | undefined;

vi.mock("./api-client", () => ({
  CareerOsApiClient: class {
    getAuthStatus = mockGetAuthStatus;
    reportPresence = mockReportPresence;
    resolveAnswers = mockResolveAnswers;
    getApplicationContext = mockGetApplicationContext;
    recordApplication = mockRecordApplication;
    prepareApplication = mockPrepareApplication;
  },
}));

vi.mock("./auth", () => ({
  tokenProvider: { getToken: vi.fn() },
}));

function installChromeMocks() {
  onMessageListener = undefined;

  vi.stubGlobal("chrome", {
    runtime: {
      id: EXTENSION_ID,
      onMessage: {
        addListener: vi.fn((listener: typeof onMessageListener) => {
          onMessageListener = listener;
        }),
      },
    },
    tabs: {
      query: mockTabsQuery,
      get: mockTabsGet,
      sendMessage: mockTabsSendMessage,
      create: mockTabsCreate,
    },
    scripting: {
      executeScript: mockExecuteScript,
    },
    commands: {
      onCommand: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  });
}

function contentSender(tab: Pick<chrome.tabs.Tab, "id" | "url" | "title">) {
  return {
    id: EXTENSION_ID,
    tab: tab as chrome.tabs.Tab,
  } as chrome.runtime.MessageSender;
}

function popupSender(): chrome.runtime.MessageSender {
  return { id: EXTENSION_ID };
}

async function dispatchMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  expect(onMessageListener).toBeDefined();
  return new Promise((resolve) => {
    const handled = onMessageListener!(message, sender, resolve);
    expect(handled).toBe(true);
  });
}

const pageDetection = {
  ok: true,
  data: {
    status: "APPLICATION_PAGE",
    adapter: "greenhouse",
    reasons: [],
    forms: [],
  },
} as const;

const fillPlanFields = [
  {
    fieldId: "field-1",
    canonicalKey: "CONTACT_EMAIL" as const,
    controlType: "EMAIL" as const,
    action: "FILL" as const,
    proposedAnswer: "candidate@example.com",
  },
];

const recordRequest = {
  type: "CAREEROS_RECORD_APPLICATION" as const,
  applicationId: null,
  company: "Acme",
  role: "Engineer",
  resumeVersionId: null,
  idempotencyKey: IDEMPOTENCY_KEY,
  answers: [
    {
      canonicalKey: "CONTACT_EMAIL" as const,
      questionText: "Email",
      answerText: "candidate@example.com",
      sourceCategory: "IDENTITY" as const,
    },
  ],
  expectedPageUrl: TAB_A_URL,
};

const prepareRequest = {
  type: "CAREEROS_PREPARE_APPLICATION" as const,
  company: "Acme",
  role: "Engineer",
  resumeVersionId: null,
  idempotencyKey: IDEMPOTENCY_KEY,
  expectedPageUrl: TAB_A_URL,
};

describe("background message tab targeting", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    installChromeMocks();

    mockTabsSendMessage.mockImplementation(async (_tabId, message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "CAREEROS_INSPECT_PAGE"
      ) {
        return pageDetection;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "CAREEROS_APPLY_FILL_PLAN"
      ) {
        return {
          ok: true,
          data: { fields: [{ fieldId: "field-1", state: "FILLED" }] },
        };
      }
      return { ok: true, data: { active: true } };
    });
    mockTabsGet.mockImplementation(async (tabId: number) => ({
      id: tabId,
      url: TAB_A_URL,
    }));
    mockGetApplicationContext.mockResolvedValue({
      pageUrl: TAB_A_URL,
      pageTitle: "Engineer",
      siteHost: "boards.greenhouse.io",
      matchKind: "NONE",
      application: null,
      resumeVersions: [],
    });
    mockRecordApplication.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000012",
      company: "Acme",
      role: "Engineer",
      applicationUrl: TAB_A_URL,
      resumeVersionId: null,
      status: "APPLIED",
      origin: "EXTERNAL_PAGE",
      createdAt: "2026-09-25T01:00:00Z",
    });
    mockPrepareApplication.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000013",
      company: "Acme",
      role: "Engineer",
      applicationUrl: TAB_A_URL,
      resumeVersionId: null,
      status: "PREPARING",
      origin: "EXTERNAL_PAGE",
      createdAt: "2026-09-25T01:00:00Z",
    });

    await import("./index");
  });

  it("content script message uses sender.tab without querying active tab", async () => {
    const response = await dispatchMessage(
      { type: "CAREEROS_DETECT_ACTIVE_PAGE" },
      contentSender({ id: 42, url: TAB_A_URL, title: "Engineer" }),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(42, {
      type: "CAREEROS_INSPECT_PAGE",
    });
    expect(response).toEqual(pageDetection);
  });

  it("popup detect with tab binding uses chrome.tabs.get, not query", async () => {
    mockTabsGet.mockResolvedValue({
      id: 7,
      url: TAB_A_URL,
      title: "Engineer",
    });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_DETECT_ACTIVE_PAGE",
        expectedTabId: 7,
        expectedPageUrl: TAB_A_URL,
      },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsGet).toHaveBeenCalledWith(7);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(7, {
      type: "CAREEROS_INSPECT_PAGE",
    });
    expect(response).toEqual(pageDetection);
  });

  it("popup detect without tab binding is rejected with STALE_PAGE", async () => {
    const response = await dispatchMessage(
      { type: "CAREEROS_DETECT_ACTIVE_PAGE" },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("tab switch during async processing still targets the original sender tab", async () => {
    mockTabsSendMessage.mockImplementation(async (tabId, message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "CAREEROS_INSPECT_PAGE"
      ) {
        mockTabsQuery.mockResolvedValue([
          { id: 99, url: TAB_B_URL, title: "Other tab" },
        ]);
        return pageDetection;
      }
      return { ok: true, data: { active: true } };
    });

    const response = await dispatchMessage(
      { type: "CAREEROS_DETECT_ACTIVE_PAGE" },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(42, {
      type: "CAREEROS_INSPECT_PAGE",
    });
    expect(response).toEqual(pageDetection);
  });

  it("URL change rejects fill plan with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_B_URL });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsGet).toHaveBeenCalledWith(42);
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("expectedPageUrl mismatch rejects fill plan with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_A_URL });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_B_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsSendMessage).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("expectedPageUrl mismatch rejects record with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_A_URL });

    const response = await dispatchMessage(
      { ...recordRequest, expectedPageUrl: TAB_B_URL },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockRecordApplication).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("expectedPageUrl mismatch rejects prepare with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_A_URL });

    const response = await dispatchMessage(
      { ...prepareRequest, expectedPageUrl: TAB_B_URL },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockPrepareApplication).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("tab navigated after expectedPageUrl captured rejects fill with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_B_URL });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsSendMessage).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("tab closed rejects write operations safely", async () => {
    mockTabsGet.mockRejectedValue(new Error("No tab with id: 42"));

    const fillResponse = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );
    const recordResponse = await dispatchMessage(
      recordRequest,
      contentSender({ id: 42, url: TAB_A_URL }),
    );
    const prepareResponse = await dispatchMessage(
      prepareRequest,
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(fillResponse).toEqual({ ok: false, error: "STALE_PAGE" });
    expect(recordResponse).toEqual({ ok: false, error: "STALE_PAGE" });
    expect(prepareResponse).toEqual({ ok: false, error: "STALE_PAGE" });
    expect(mockRecordApplication).not.toHaveBeenCalled();
    expect(mockPrepareApplication).not.toHaveBeenCalled();
  });

  it("record and prepare use the pinned tab URL from detection", async () => {
    await dispatchMessage(
      recordRequest,
      contentSender({ id: 42, url: TAB_A_URL }),
    );
    await dispatchMessage(
      prepareRequest,
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockRecordApplication).toHaveBeenCalledWith(
      recordRequest,
      TAB_A_URL,
    );
    expect(mockPrepareApplication).toHaveBeenCalledWith(
      prepareRequest,
      TAB_A_URL,
    );
  });

  it("popup tab closed rejects fill with STALE_PAGE", async () => {
    mockTabsGet.mockRejectedValue(new Error("No tab with id: 99"));

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
        expectedTabId: 99,
      },
      popupSender(),
    );

    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });

  it("popup tab navigated after binding rejects with STALE_PAGE", async () => {
    mockTabsGet.mockResolvedValue({ id: 7, url: TAB_B_URL });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
        expectedTabId: 7,
      },
      popupSender(),
    );

    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });

  it("popup record uses tab binding, not active tab query", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_A_URL });

    await dispatchMessage(
      {
        ...recordRequest,
        expectedTabId: 42,
      },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsGet).toHaveBeenCalledWith(42);
    expect(mockRecordApplication).toHaveBeenCalled();
  });

  it("tab navigated after detection rejects fill with STALE_PAGE via content check", async () => {
    mockTabsGet.mockResolvedValue({ id: 42, url: TAB_A_URL });
    mockTabsSendMessage.mockImplementation(async (_tabId, message) => {
      const msg = message as { type?: string };
      if (msg.type === "CAREEROS_INSPECT_PAGE") {
        return pageDetection;
      }
      if (msg.type === "CAREEROS_APPLY_FILL_PLAN") {
        return { ok: false, error: "STALE_PAGE" };
      }
      return { ok: true, data: {} };
    });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("content script path uses sender.tab, not payload expectedTabId", async () => {
    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL }),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        type: "CAREEROS_APPLY_FILL_PLAN",
        expectedPageUrl: TAB_A_URL,
      }),
    );
    expect(response).toEqual({
      ok: true,
      data: { fields: [{ fieldId: "field-1", state: "FILLED" }] },
    });
  });

  it("returns tab context for popup", async () => {
    mockTabsQuery.mockResolvedValue([
      { id: 7, url: TAB_A_URL, title: "Engineer" },
    ]);

    const response = await dispatchMessage(
      { type: "CAREEROS_GET_TAB_CONTEXT" },
      popupSender(),
    );

    expect(response).toEqual({
      ok: true,
      data: { tabId: 7, tabUrl: TAB_A_URL },
    });
  });

  it("popup context request with tab binding uses bound tab", async () => {
    mockTabsGet.mockResolvedValue({
      id: 7,
      url: TAB_A_URL,
      title: "Engineer",
    });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_GET_APPLICATION_CONTEXT",
        expectedTabId: 7,
        expectedPageUrl: TAB_A_URL,
      },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsGet).toHaveBeenCalledWith(7);
    expect(response).toEqual(expect.objectContaining({ ok: true }));
  });

  it("popup context request without tab binding is rejected", async () => {
    const response = await dispatchMessage(
      { type: "CAREEROS_GET_APPLICATION_CONTEXT" },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(response).toEqual({ ok: false, error: "STALE_PAGE" });
  });

  it("same URL different tab: popup uses bound tabId, not active tab", async () => {
    mockTabsGet.mockImplementation(async (tabId: number) => {
      if (tabId === 42) return { id: 42, url: TAB_A_URL, title: "Tab A" };
      return { id: tabId, url: TAB_A_URL, title: "Other" };
    });

    const response = await dispatchMessage(
      {
        type: "CAREEROS_APPLY_FILL_PLAN",
        fields: fillPlanFields,
        expectedPageUrl: TAB_A_URL,
        expectedTabId: 42,
      },
      popupSender(),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsGet).toHaveBeenCalledWith(42);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: "CAREEROS_APPLY_FILL_PLAN" }),
    );
    expect(response).toEqual(expect.objectContaining({ ok: true }));
  });

  it("content script context uses sender.tab, ignores payload tab binding", async () => {
    const response = await dispatchMessage(
      {
        type: "CAREEROS_GET_APPLICATION_CONTEXT",
        expectedTabId: 99,
        expectedPageUrl: TAB_B_URL,
      },
      contentSender({ id: 42, url: TAB_A_URL, title: "Engineer" }),
    );

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockGetApplicationContext).toHaveBeenCalledWith(
      TAB_A_URL,
      "Engineer",
    );
    expect(response).toEqual(expect.objectContaining({ ok: true }));
  });
});

describe("background extension presence", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    installChromeMocks();
    await import("./index");
  });

  it("reports presence with the build version once signed in", async () => {
    mockGetAuthStatus.mockResolvedValue({ authenticated: true });
    mockReportPresence.mockResolvedValue(undefined);

    const response = await dispatchMessage(
      { type: "CAREEROS_GET_AUTH_STATUS" },
      popupSender(),
    );

    expect(response).toEqual({ ok: true, data: { authenticated: true } });
    expect(mockReportPresence).toHaveBeenCalledWith("test-build");
  });

  it("does not report presence while signed out", async () => {
    mockGetAuthStatus.mockResolvedValue({ authenticated: false });

    await dispatchMessage({ type: "CAREEROS_GET_AUTH_STATUS" }, popupSender());

    expect(mockReportPresence).not.toHaveBeenCalled();
  });

  it("keeps the popup working when the presence report fails", async () => {
    mockGetAuthStatus.mockResolvedValue({ authenticated: true });
    mockReportPresence.mockRejectedValue(new Error("offline"));

    const response = await dispatchMessage(
      { type: "CAREEROS_GET_AUTH_STATUS" },
      popupSender(),
    );

    expect(response).toEqual({ ok: true, data: { authenticated: true } });
  });
});
