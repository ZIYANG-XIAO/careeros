// @vitest-environment jsdom

import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
  ExtensionResponse,
  TabContext,
  PageDetection,
  ApplicationPageContext,
} from "../shared/types";
import type { usePopupState as UsePopupStateType } from "./use-popup-state";

const TAB_URL = "https://boards.greenhouse.io/acme/jobs/123";
const TAB_ID = 42;

function okResponse<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

function errorResponse(
  error: "UNAUTHENTICATED" | "UNSUPPORTED_PAGE" | "UNAVAILABLE" | "STALE_PAGE",
): ExtensionResponse<never> {
  return { ok: false, error };
}

function tabCtx(tabId: number, tabUrl: string): TabContext {
  return { tabId, tabUrl };
}

function unsupportedDetection(): PageDetection {
  return {
    status: "UNSUPPORTED_PAGE",
    adapter: null,
    reasons: ["unsupported"],
    forms: [],
  };
}

function applicationDetection(): PageDetection {
  return {
    status: "APPLICATION_PAGE",
    adapter: "greenhouse",
    reasons: [],
    forms: [],
  };
}

function emptyContext(): ApplicationPageContext {
  return {
    pageUrl: TAB_URL,
    pageTitle: "Apply",
    siteHost: "boards.greenhouse.io",
    matchKind: "NONE",
    application: null,
    resumeVersions: [],
  };
}

let sendMock: ReturnType<typeof vi.fn>;
let container: HTMLDivElement;
let root: Root;
let hookState: ReturnType<typeof UsePopupStateType>;

function HookConsumer({ useHook }: { useHook: typeof UsePopupStateType }) {
  hookState = useHook();
  return null;
}

beforeEach(() => {
  vi.resetModules();
  sendMock = vi.fn();
  vi.stubGlobal("chrome", {
    runtime: { sendMessage: sendMock },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderWithHook(): Promise<void> {
  const { usePopupState } = await import("./use-popup-state");
  await act(async () => {
    root.render(createElement(HookConsumer, { useHook: usePopupState }));
  });
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("usePopupState initialization", () => {
  it("does not send detect/context/activate when TabContext fails", async () => {
    sendMock.mockImplementation((request: { type: string }) => {
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return Promise.resolve(okResponse({ authenticated: true }));
      }
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        return Promise.resolve(errorResponse("UNAVAILABLE"));
      }
      return Promise.reject(new Error(`unexpected: ${request.type}`));
    });

    await renderWithHook();

    const sentTypes = sendMock.mock.calls.map(
      (call: unknown[]) => (call[0] as { type: string }).type,
    );
    expect(sentTypes).toContain("CAREEROS_GET_TAB_CONTEXT");
    expect(sentTypes).not.toContain("CAREEROS_DETECT_ACTIVE_PAGE");
    expect(sentTypes).not.toContain("CAREEROS_GET_APPLICATION_CONTEXT");
    expect(sentTypes).not.toContain("CAREEROS_ACTIVATE_ASSISTANT");
    expect(hookState.hasPinnedTab).toBe(false);
  });

  it("does not send detect when TabContext returns tabId 0", async () => {
    sendMock.mockImplementation((request: { type: string }) => {
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return Promise.resolve(okResponse({ authenticated: true }));
      }
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        return Promise.resolve(okResponse(tabCtx(0, TAB_URL)));
      }
      return Promise.reject(new Error(`unexpected: ${request.type}`));
    });

    await renderWithHook();

    const sentTypes = sendMock.mock.calls.map(
      (call: unknown[]) => (call[0] as { type: string }).type,
    );
    expect(sentTypes).not.toContain("CAREEROS_DETECT_ACTIVE_PAGE");
    expect(hookState.hasPinnedTab).toBe(false);
  });

  it("sends detect with pinned expectedTabId and expectedPageUrl", async () => {
    sendMock.mockImplementation((request: { type: string }) => {
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return Promise.resolve(okResponse({ authenticated: true }));
      }
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        return Promise.resolve(okResponse(tabCtx(TAB_ID, TAB_URL)));
      }
      if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
        return Promise.resolve(okResponse(unsupportedDetection()));
      }
      return Promise.reject(new Error(`unexpected: ${request.type}`));
    });

    await renderWithHook();

    const detectCall = sendMock.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { type: string }).type === "CAREEROS_DETECT_ACTIVE_PAGE",
    );
    expect(detectCall).toBeDefined();
    expect(detectCall![0]).toEqual({
      type: "CAREEROS_DETECT_ACTIVE_PAGE",
      expectedTabId: TAB_ID,
      expectedPageUrl: TAB_URL,
    });
    expect(hookState.hasPinnedTab).toBe(true);
  });

  it("activate carries pinned expectedTabId + expectedPageUrl", async () => {
    sendMock.mockImplementation((request: { type: string }) => {
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return Promise.resolve(okResponse({ authenticated: true }));
      }
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        return Promise.resolve(okResponse(tabCtx(TAB_ID, TAB_URL)));
      }
      if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
        return Promise.resolve(okResponse(unsupportedDetection()));
      }
      if (request.type === "CAREEROS_ACTIVATE_ASSISTANT") {
        return Promise.resolve(okResponse({ active: true }));
      }
      return Promise.reject(new Error(`unexpected: ${request.type}`));
    });

    await renderWithHook();

    await act(async () => {
      await hookState.openPageAssistant();
    });

    const activateCall = sendMock.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { type: string }).type === "CAREEROS_ACTIVATE_ASSISTANT",
    );
    expect(activateCall).toBeDefined();
    expect(activateCall![0]).toEqual({
      type: "CAREEROS_ACTIVATE_ASSISTANT",
      expectedTabId: TAB_ID,
      expectedPageUrl: TAB_URL,
    });
  });

  it("openPageAssistant does not send message when no pinned tab", async () => {
    sendMock.mockImplementation((request: { type: string }) => {
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return Promise.resolve(okResponse({ authenticated: true }));
      }
      if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
        return Promise.resolve(errorResponse("UNAVAILABLE"));
      }
      return Promise.reject(new Error(`unexpected: ${request.type}`));
    });

    await renderWithHook();

    sendMock.mockClear();

    await act(async () => {
      await hookState.openPageAssistant();
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(hookState.assistantError).toBe(
      "No active tab identified. Close and reopen the popup.",
    );
  });

  it("switching active tab does not change pinned tab binding", async () => {
    sendMock.mockImplementation(
      (request: {
        type: string;
        expectedTabId?: number;
        expectedPageUrl?: string;
      }) => {
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return Promise.resolve(okResponse({ authenticated: true }));
        }
        if (request.type === "CAREEROS_GET_TAB_CONTEXT") {
          return Promise.resolve(okResponse(tabCtx(TAB_ID, TAB_URL)));
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return Promise.resolve(okResponse(applicationDetection()));
        }
        if (request.type === "CAREEROS_GET_APPLICATION_CONTEXT") {
          return Promise.resolve(okResponse(emptyContext()));
        }
        if (request.type === "CAREEROS_ACTIVATE_ASSISTANT") {
          return Promise.resolve(okResponse({ active: true }));
        }
        return Promise.reject(new Error(`unexpected: ${request.type}`));
      },
    );

    await renderWithHook();

    const detectCall = sendMock.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { type: string }).type === "CAREEROS_DETECT_ACTIVE_PAGE",
    );
    const detectPayload = detectCall![0] as Record<string, unknown>;
    expect(detectPayload.expectedTabId).toBe(TAB_ID);
    expect(detectPayload.expectedPageUrl).toBe(TAB_URL);

    await act(async () => {
      await hookState.openPageAssistant();
    });

    const activateCall = sendMock.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { type: string }).type === "CAREEROS_ACTIVATE_ASSISTANT",
    );
    const activatePayload = activateCall![0] as Record<string, unknown>;
    expect(activatePayload.expectedTabId).toBe(TAB_ID);
    expect(activatePayload.expectedPageUrl).toBe(TAB_URL);
  });
});
