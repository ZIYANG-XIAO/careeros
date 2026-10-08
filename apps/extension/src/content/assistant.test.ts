// @vitest-environment jsdom
//
// These tests exercise assistant logic in jsdom. They do not verify real Chrome
// isolated/main world behavior or production extension timing guarantees.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  destroyAssistant,
  isAssistantMounted,
  mountAssistant,
} from "./assistant";

function assistantHost(): HTMLElement & { shadowRoot: ShadowRoot } {
  const host = document.getElementById(
    "careeros-assistant-host",
  ) as HTMLElement & { shadowRoot: ShadowRoot };
  if (!host?.shadowRoot) throw new Error("assistant host not mounted");
  return host;
}

function applicationPageMocks() {
  return async (message: unknown) => {
    const request = message as { type: string };
    if (request.type === "CAREEROS_GET_AUTH_STATUS") {
      return { ok: true, data: { authenticated: true } };
    }
    if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
      return {
        ok: true,
        data: {
          status: "APPLICATION_PAGE",
          adapter: "generic",
          reasons: [],
          forms: [
            {
              id: "form-1",
              adapter: "generic",
              support: "SUPPORTED",
              fields: [
                {
                  id: "field-1",
                  controlType: "EMAIL",
                  question: "Email",
                  required: true,
                  canonicalKey: "CONTACT_EMAIL",
                  support: "SUPPORTED",
                  confidence: "HIGH",
                  options: [],
                },
              ],
            },
          ],
        },
      };
    }
    if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
      return {
        ok: true,
        data: {
          decisions: [
            {
              fieldId: "field-1",
              canonicalKey: "CONTACT_EMAIL",
              questionCategory: "STANDARD",
              proposedAnswer: "candidate@example.com",
              sourceCategory: "IDENTITY",
              sourceReferenceId: null,
              action: "FILL",
              policyCategory: "STANDARD",
              confidence: "HIGH",
              sensitivity: "NONE",
              reviewState: "NOT_REQUIRED",
              reusePolicy: "NOT_APPLICABLE",
              saveIntentRequired: false,
            },
          ],
          selectedResumeVersionId: null,
          semanticClassifierUsed: false,
        },
      };
    }
    if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
      return {
        ok: true,
        data: { fields: [{ fieldId: "field-1", state: "FILLED" }] },
      };
    }
    return { ok: true, data: {} };
  };
}

function mockChrome(options?: {
  storage?: Record<string, unknown>;
  sendMessage?: (message: unknown) => Promise<unknown>;
}) {
  const storage = { ...options?.storage };
  const sendMessage =
    options?.sendMessage ??
    (async (message: unknown) => {
      const request = message as { type: string };
      if (request.type === "CAREEROS_GET_AUTH_STATUS") {
        return { ok: true, data: { authenticated: true } };
      }
      return { ok: true, data: {} };
    });

  vi.stubGlobal("chrome", {
    runtime: {
      id: "test-extension",
      sendMessage: vi.fn(sendMessage),
    },
    storage: {
      local: {
        get: vi.fn(async (keys: string | Record<string, unknown>) => {
          if (typeof keys === "string") {
            return { [keys]: storage[keys] };
          }
          return storage;
        }),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(storage, value);
        }),
      },
    },
  });
}

describe("in-page assistant", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="application-form">
        <input name="email" type="email" />
        <button type="submit">Submit</button>
      </form>
    `;
    mockChrome();
  });

  afterEach(() => {
    destroyAssistant();
    vi.unstubAllGlobals();
  });

  it("does not mount automatically without explicit activation", () => {
    expect(isAssistantMounted()).toBe(false);
    expect(document.getElementById("careeros-assistant-host")).toBeNull();
  });

  it("creates an isolated shadow root and shows the launcher after activation", () => {
    mountAssistant();
    const host = assistantHost();
    expect(host.getAttribute("data-careeros-assistant")).toBe("true");
    expect(host.shadowRoot.querySelector(".launcher")).not.toBeNull();
    expect(host.shadowRoot.querySelector("style")?.textContent).toContain(
      ".launcher",
    );
    expect(document.body.querySelector(".launcher")).toBeNull();
    expect(isAssistantMounted()).toBe(true);
  });

  it("opens and closes the panel while persisting only the expanded preference", async () => {
    mountAssistant();
    const host = assistantHost();
    const launcher = host.shadowRoot.querySelector(
      ".launcher",
    ) as HTMLButtonElement;
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    launcher.click();
    expect(panel.classList.contains("open")).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      careeros_assistant_panel_expanded: true,
    });

    const closeButton = host.shadowRoot.querySelector(
      ".close-btn",
    ) as HTMLButtonElement;
    closeButton.click();
    expect(panel.classList.contains("open")).toBe(false);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      careeros_assistant_panel_expanded: false,
    });
  });

  it("does not expose tokens or secrets in the page DOM", async () => {
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [
                {
                  id: "form-1",
                  adapter: "generic",
                  support: "SUPPORTED",
                  fields: [
                    {
                      id: "field-1",
                      controlType: "EMAIL",
                      question: "Email",
                      required: true,
                      canonicalKey: "CONTACT_EMAIL",
                      support: "SUPPORTED",
                      confidence: "HIGH",
                      options: [],
                    },
                  ],
                },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
          return {
            ok: true,
            data: {
              decisions: [
                {
                  fieldId: "field-1",
                  canonicalKey: "CONTACT_EMAIL",
                  questionCategory: "STANDARD",
                  proposedAnswer: "candidate@example.com",
                  sourceCategory: "IDENTITY",
                  sourceReferenceId: null,
                  action: "FILL",
                  policyCategory: "STANDARD",
                  confidence: "HIGH",
                  sensitivity: "NONE",
                  reviewState: "NOT_REQUIRED",
                  reusePolicy: "NOT_APPLICABLE",
                  saveIntentRequired: false,
                },
              ],
              selectedResumeVersionId: null,
              semanticClassifierUsed: false,
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(document.documentElement.innerHTML).not.toMatch(
        /Bearer|Authorization|sk_(?:test|live)_|session.?token/i,
      );
    });
    expect(host.shadowRoot.textContent ?? "").not.toMatch(
      /Bearer|Authorization|sk_(?:test|live)_|session.?token/i,
    );
  });

  it("closes on Escape and restores focus to the launcher", () => {
    mountAssistant();
    const host = assistantHost();
    const launcher = host.shadowRoot.querySelector(
      ".launcher",
    ) as HTMLButtonElement;
    const focusSpy = vi.spyOn(launcher, "focus");
    launcher.click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;
    expect(panel.classList.contains("open")).toBe(true);

    host.shadowRoot.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(panel.classList.contains("open")).toBe(false);
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(focusSpy).toHaveBeenCalled();
  });

  it("cleans up on deactivation", () => {
    mountAssistant();
    expect(document.getElementById("careeros-assistant-host")).not.toBeNull();
    destroyAssistant();
    expect(document.getElementById("careeros-assistant-host")).toBeNull();
    expect(isAssistantMounted()).toBe(false);
  });

  it("never submits the host application form from assistant actions", () => {
    const submit = vi.fn((event: Event) => event.preventDefault());
    document
      .querySelector("#application-form")!
      .addEventListener("submit", submit);

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();

    for (const button of host.shadowRoot.querySelectorAll("button")) {
      button.click();
    }

    expect(submit).not.toHaveBeenCalled();
  });

  it("clears stale inspection state after URL changes", async () => {
    vi.useFakeTimers();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "Application form needs manual review",
      );
    });

    history.pushState({}, "", "/apply/step-2");
    vi.advanceTimersByTime(500);

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });

    vi.useRealTimers();
  });

  it("URL polling detects pushState without DOM mutation", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "Application form needs manual review",
      );
    });

    history.pushState({}, "", "/new-path");
    vi.advanceTimersByTime(500);

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });

    vi.useRealTimers();
  });

  it("URL polling detects replaceState", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "Application form needs manual review",
      );
    });

    history.replaceState({}, "", "/replaced-path");
    vi.advanceTimersByTime(500);

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });

    vi.useRealTimers();
  });

  it("fill plan is rejected after URL change", async () => {
    vi.useFakeTimers();
    mockChrome({ sendMessage: applicationPageMocks() });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Fill 1 approved field");
    });

    history.pushState({}, "", "/apply/step-2");

    const fillButton = Array.from(
      host.shadowRoot.querySelectorAll(".primary"),
    ).find((button) =>
      button.textContent?.includes("Fill 1 approved field"),
    ) as HTMLButtonElement;
    fillButton.click();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "CAREEROS_APPLY_FILL_PLAN" }),
    );

    vi.advanceTimersByTime(500);

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "CAREEROS_APPLY_FILL_PLAN" }),
    );

    vi.useRealTimers();
  });

  it("popstate triggers URL change detection", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "Application form needs manual review",
      );
    });

    history.pushState({}, "", "/popstate-path");
    vi.advanceTimersByTime(500);
    history.back();
    window.dispatchEvent(new PopStateEvent("popstate"));

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });

    vi.useRealTimers();
  });

  it("hashchange triggers URL change detection", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "Application form needs manual review",
      );
    });

    window.location.hash = "#step-2";
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });

    vi.useRealTimers();
  });

  it("destroy stops URL polling timer", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    mockChrome();

    const handle = mountAssistant();
    handle.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);

    clearIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("repeated mount/destroy does not leak timers or listeners", () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const addListenerSpy = vi.spyOn(window, "addEventListener");
    const removeListenerSpy = vi.spyOn(window, "removeEventListener");
    mockChrome();

    mountAssistant().destroy();
    mountAssistant().destroy();

    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    expect(addListenerSpy).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(addListenerSpy).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );
    expect(removeListenerSpy).toHaveBeenCalledWith(
      "popstate",
      expect.any(Function),
    );
    expect(removeListenerSpy).toHaveBeenCalledWith(
      "hashchange",
      expect.any(Function),
    );

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
    vi.useRealTimers();
  });

  it("stale detection results are not written after navigation", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    let resolveDetection: ((value: unknown) => void) | undefined;
    const detectionPromise = new Promise((resolve) => {
      resolveDetection = resolve;
    });

    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return detectionPromise;
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Checking this page");
    });

    history.pushState({}, "", "/navigated");
    vi.advanceTimersByTime(500);

    resolveDetection!({
      ok: true,
      data: {
        status: "APPLICATION_PAGE",
        adapter: "generic",
        reasons: [],
        forms: [],
      },
    });

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });
    expect(panel.textContent).not.toContain(
      "Application form needs manual review",
    );

    vi.useRealTimers();
  });

  it("stale answer resolution is not written after navigation", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    let resolveAnswers: ((value: unknown) => void) | undefined;
    const answersPromise = new Promise((resolve) => {
      resolveAnswers = resolve;
    });

    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [
                {
                  id: "form-1",
                  adapter: "generic",
                  support: "SUPPORTED",
                  fields: [
                    {
                      id: "field-1",
                      controlType: "EMAIL",
                      question: "Email",
                      required: true,
                      canonicalKey: "CONTACT_EMAIL",
                      support: "SUPPORTED",
                      confidence: "HIGH",
                      options: [],
                    },
                  ],
                },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
          return answersPromise;
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Checking approved sources");
    });

    history.pushState({}, "", "/navigated-answers");
    vi.advanceTimersByTime(500);

    resolveAnswers!({
      ok: true,
      data: {
        decisions: [
          {
            fieldId: "field-1",
            canonicalKey: "CONTACT_EMAIL",
            questionCategory: "STANDARD",
            proposedAnswer: "candidate@example.com",
            sourceCategory: "IDENTITY",
            sourceReferenceId: null,
            action: "FILL",
            policyCategory: "STANDARD",
            confidence: "HIGH",
            sensitivity: "NONE",
            reviewState: "NOT_REQUIRED",
            reusePolicy: "NOT_APPLICABLE",
            saveIntentRequired: false,
          },
        ],
        selectedResumeVersionId: null,
        semanticClassifierUsed: false,
      },
    });

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });
    expect(panel.textContent).not.toContain("Fill 1 approved field");

    vi.useRealTimers();
  });

  it("stale application context is not written after navigation", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    let resolveContext: ((value: unknown) => void) | undefined;
    const contextPromise = new Promise((resolve) => {
      resolveContext = resolve;
    });

    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        if (request.type === "CAREEROS_GET_APPLICATION_CONTEXT") {
          return contextPromise;
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Looking for tracked context");
    });

    history.pushState({}, "", "/navigated-context");
    vi.advanceTimersByTime(500);

    resolveContext!({
      ok: true,
      data: {
        pageUrl: "https://example.com/navigated-context",
        pageTitle: "Apply",
        siteHost: "example.com",
        matchKind: "NONE",
        application: null,
        resumeVersions: [],
      },
    });

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });
    expect(panel.textContent).not.toContain("Record after you submit");

    vi.useRealTimers();
  });

  it("fill request includes expectedPageUrl", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    mockChrome({ sendMessage: applicationPageMocks() });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(
        Array.from(host.shadowRoot.querySelectorAll(".primary")).some(
          (button) => button.textContent?.includes("Fill 1 approved field"),
        ),
      ).toBe(true);
    });

    const fillButton = Array.from(
      host.shadowRoot.querySelectorAll(".primary"),
    ).find((button) =>
      button.textContent?.includes("Fill 1 approved field"),
    ) as HTMLButtonElement;
    fillButton.click();

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CAREEROS_APPLY_FILL_PLAN",
          expectedPageUrl: window.location.href,
        }),
      );
    });
  });

  it("background rejects fill when expectedPageUrl doesn't match", async () => {
    // NOTE: jsdom runs in a single JS environment and cannot simulate Chrome's isolated/main world separation.
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [
                {
                  id: "form-1",
                  adapter: "generic",
                  support: "SUPPORTED",
                  fields: [
                    {
                      id: "field-1",
                      controlType: "EMAIL",
                      question: "Email",
                      required: true,
                      canonicalKey: "CONTACT_EMAIL",
                      support: "SUPPORTED",
                      confidence: "HIGH",
                      options: [],
                    },
                  ],
                },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
          return {
            ok: true,
            data: {
              decisions: [
                {
                  fieldId: "field-1",
                  canonicalKey: "CONTACT_EMAIL",
                  questionCategory: "STANDARD",
                  proposedAnswer: "candidate@example.com",
                  sourceCategory: "IDENTITY",
                  sourceReferenceId: null,
                  action: "FILL",
                  policyCategory: "STANDARD",
                  confidence: "HIGH",
                  sensitivity: "NONE",
                  reviewState: "NOT_REQUIRED",
                  reusePolicy: "NOT_APPLICABLE",
                  saveIntentRequired: false,
                },
              ],
              selectedResumeVersionId: null,
              semanticClassifierUsed: false,
            },
          };
        }
        if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
          return { ok: false, error: "STALE_PAGE" };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Fill 1 approved field");
    });

    const fillButton = Array.from(
      host.shadowRoot.querySelectorAll(".primary"),
    ).find((button) =>
      button.textContent?.includes("Fill 1 approved field"),
    ) as HTMLButtonElement;
    fillButton.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain(
        "This page changed before fill could finish.",
      );
    });
  });

  it("stale error from failed request is not written after navigation", async () => {
    // NOTE: jsdom cannot simulate Chrome's isolated/main world separation.
    vi.useFakeTimers();
    let rejectContext: ((reason: Error) => void) | undefined;
    const contextPromise = new Promise((_resolve, reject) => {
      rejectContext = reject;
    });

    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [],
            },
          };
        }
        if (request.type === "CAREEROS_GET_APPLICATION_CONTEXT") {
          return contextPromise;
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const panel = host.shadowRoot.querySelector(".panel") as HTMLElement;

    const reinspect = Array.from(
      host.shadowRoot.querySelectorAll(".secondary"),
    ).find(
      (button) => button.textContent === "Reinspect page",
    ) as HTMLButtonElement;
    reinspect.click();

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Looking for tracked context");
    });

    history.pushState({}, "", "/navigated-error");
    vi.advanceTimersByTime(500);

    rejectContext!(new Error("network failure"));

    await vi.waitFor(() => {
      expect(panel.textContent).toContain("Not inspected yet");
    });
    expect(panel.textContent).not.toContain("Application context");
    expect(panel.textContent).not.toContain("network failure");

    vi.useRealTimers();
  });
});

describe("in-page assistant tools", () => {
  afterEach(() => {
    destroyAssistant();
    vi.unstubAllGlobals();
  });

  it("clips the current job from structured data after the user confirms", async () => {
    document.body.innerHTML = `
      <script type="application/ld+json">${JSON.stringify({
        "@type": "JobPosting",
        title: "Backend Engineer",
        hiringOrganization: { name: "Acme" },
        description: "<p>Build reliable APIs with Python and PostgreSQL.</p>",
      })}</script>
      <h1>Backend Engineer</h1>`;
    const sent: Array<{ type: string } & Record<string, unknown>> = [];
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string } & Record<string, unknown>;
        sent.push(request);
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_CLIP_JOB") {
          return {
            ok: true,
            data: {
              jobId: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
              created: true,
            },
          };
        }
        return {
          ok: true,
          data: {
            status: "NOT_APPLICATION_PAGE",
            forms: [],
            reasons: [],
            adapter: null,
          },
        };
      },
    });
    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const buttonNamed = (name: string) =>
      Array.from(host.shadowRoot.querySelectorAll("button")).find(
        (button) => button.textContent === name,
      );

    await vi.waitFor(() => expect(buttonNamed("Save this job")).toBeTruthy());
    buttonNamed("Save this job")!.click();
    await vi.waitFor(() =>
      expect(buttonNamed("Save to CareerOS")).toBeTruthy(),
    );
    expect(sent.some((request) => request.type === "CAREEROS_CLIP_JOB")).toBe(
      false,
    );

    buttonNamed("Save to CareerOS")!.click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("Saved to CareerOS"),
    );
    const clip = sent.find((request) => request.type === "CAREEROS_CLIP_JOB")!;
    expect(clip).toMatchObject({
      title: "Backend Engineer",
      company: "Acme",
      expectedPageUrl: window.location.href,
    });
  });
});

describe("applicationStepSignature", () => {
  it("reads the Workday step heading and is empty elsewhere", async () => {
    const { applicationStepSignature } = await import("./assistant");
    document.body.innerHTML = `<h2 data-automation-id="pageHeaderText">  My   Experience </h2>`;
    expect(applicationStepSignature(document)).toBe("My Experience");
    document.body.innerHTML = `<h2>Apply</h2>`;
    expect(applicationStepSignature(document)).toBe("");
  });
});

describe("assistant review checklist, job card, and dock", () => {
  beforeEach(() => mockChrome());

  afterEach(() => {
    destroyAssistant();
    window.history.pushState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("lists fields still needing the user and fills an approved draft on request", async () => {
    document.body.innerHTML = `
      <form id="application-form">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" />
        <label for="why">Why do you want to join us?</label>
        <textarea id="why" name="why"></textarea>
        <button type="submit">Submit</button>
      </form>
    `;
    // A real application path, so page inspection recognizes the form.
    window.history.pushState({}, "", "/jobs/123/apply");
    const form = document.getElementById("application-form") as HTMLFormElement;
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);
    const field = (
      id: string,
      controlType: string,
      question: string,
      key: string | null,
    ) => ({
      id,
      controlType,
      question,
      required: key === null,
      canonicalKey: key,
      support: key ? "SUPPORTED" : "UNKNOWN",
      confidence: key ? "HIGH" : "LOW",
      options: [],
    });
    const decision = (
      fieldId: string,
      key: string | null,
      action: string,
      answer: string | null,
    ) => ({
      fieldId,
      canonicalKey: key,
      questionCategory: "STANDARD",
      proposedAnswer: answer,
      sourceCategory: answer ? "IDENTITY" : "UNKNOWN",
      sourceReferenceId: null,
      action,
      policyCategory: "STANDARD",
      confidence: answer ? "HIGH" : "LOW",
      sensitivity: "NONE",
      reviewState: answer ? "NOT_REQUIRED" : "REQUIRED",
      reusePolicy: "NOT_APPLICABLE",
      saveIntentRequired: false,
    });
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [
                {
                  id: "form-0",
                  adapter: "generic",
                  support: "SUPPORTED",
                  fields: [
                    field("field-0-0", "EMAIL", "Email", "CONTACT_EMAIL"),
                    field(
                      "field-0-1",
                      "TEXTAREA",
                      "Why do you want to join us?",
                      null,
                    ),
                  ],
                },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
          return {
            ok: true,
            data: {
              decisions: [
                decision(
                  "field-0-0",
                  "CONTACT_EMAIL",
                  "FILL",
                  "candidate@example.com",
                ),
                decision("field-0-1", null, "ASK", null),
              ],
              selectedResumeVersionId: null,
              semanticClassifierUsed: false,
            },
          };
        }
        if (request.type === "CAREEROS_APPLY_FILL_PLAN") {
          return {
            ok: true,
            data: {
              fields: [
                { fieldId: "field-0-0", state: "FILLED" },
                { fieldId: "field-0-1", state: "INPUT_REQUIRED" },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_DRAFT_ANSWER") {
          return {
            ok: true,
            data: {
              status: "DRAFTED",
              text: "I build payment systems.",
              evidenceCount: 2,
              unsupportedPoints: [],
            },
          };
        }
        return { ok: true, data: {} };
      },
    });

    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    const buttons = () =>
      Array.from(
        host.shadowRoot.querySelectorAll("button"),
      ) as HTMLButtonElement[];
    await vi.waitFor(() =>
      expect(buttons().some((b) => b.textContent === "Reinspect page")).toBe(
        true,
      ),
    );
    buttons()
      .find((b) => b.textContent === "Reinspect page")!
      .click();
    await vi.waitFor(() =>
      expect(
        buttons().some((b) => b.textContent?.includes("Fill 1 approved field")),
      ).toBe(true),
    );
    buttons()
      .find((b) => b.textContent?.includes("Fill 1 approved field"))!
      .click();

    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "Why do you want to join us?",
      ),
    );
    expect(host.shadowRoot.textContent).toContain(
      "1 required fields still need you",
    );

    buttons()
      .find((b) => b.textContent === "Draft from my experience")!
      .click();
    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "CAREEROS_DRAFT_ANSWER",
        question: "Why do you want to join us?",
        jobId: null,
      }),
    );
    await vi.waitFor(() =>
      expect(buttons().some((b) => b.textContent === "Put in this field")).toBe(
        true,
      ),
    );
    buttons()
      .find((b) => b.textContent === "Put in this field")!
      .click();

    const why = document.getElementById("why") as HTMLTextAreaElement;
    expect(why.value).toBe("I build payment systems.");
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "Added. Review it on the page before you submit.",
      ),
    );
    expect(submit).not.toHaveBeenCalled();
    window.history.pushState({}, "", "/");
  });

  it("shows the job behind the page and autofills in one click", async () => {
    document.body.innerHTML = `
      <form id="application-form">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" />
        <button type="submit">Submit</button>
      </form>
    `;
    const pageJob = {
      jobId: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
      title: "University Grad Software Engineer",
      company: "Pinterest",
      postedAt: "2026-10-01T12:00:00Z",
      salary: {
        minimum: 129022,
        maximum: 174283,
        currency: "USD",
        period: "YEAR",
      },
      sponsorship: null,
      isCatalog: true,
      lastObservedAt: new Date().toISOString(),
      isSaved: false,
      logoDataUrl: null,
    };
    const base = applicationPageMocks();
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_LOOKUP_PAGE_JOB") {
          return { ok: true, data: pageJob };
        }
        if (request.type === "CAREEROS_GET_JOB_MATCH") {
          return {
            ok: true,
            data: {
              resumeLabel: "Backend Resume · v2",
              analyzedAt: "2026-10-01T00:00:00Z",
              requirements: [
                {
                  description: "Distributed systems",
                  classification: "STRONG_EVIDENCE",
                },
                { description: "Go", classification: "GENUINE_GAP" },
              ],
            },
          };
        }
        return base(message);
      },
    });
    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "University Grad Software Engineer",
      ),
    );
    expect(host.shadowRoot.textContent).toContain(
      "$129,022 - $174,283 USD / year",
    );
    expect(host.shadowRoot.textContent).toContain(
      "Confirmed open in the last 24 hours",
    );
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "1 of 2 requirements have your evidence",
      ),
    );

    const autofill = host.shadowRoot.querySelector(
      ".autofill",
    ) as HTMLButtonElement;
    expect(autofill.textContent).toBe("Autofill this page");
    autofill.click();
    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "CAREEROS_APPLY_FILL_PLAN" }),
      ),
    );
    const order = (
      chrome.runtime.sendMessage as ReturnType<typeof vi.fn>
    ).mock.calls
      .map(([message]) => (message as { type: string }).type)
      .filter((type) =>
        [
          "CAREEROS_DETECT_ACTIVE_PAGE",
          "CAREEROS_RESOLVE_ANSWERS",
          "CAREEROS_APPLY_FILL_PLAN",
        ].includes(type),
      );
    expect(order).toEqual([
      "CAREEROS_DETECT_ACTIVE_PAGE",
      "CAREEROS_RESOLVE_ANSWERS",
      "CAREEROS_APPLY_FILL_PLAN",
    ]);

    const materials = Array.from(
      host.shadowRoot.querySelectorAll("button"),
    ).find(
      (button) => button.textContent === "Tailor resume",
    ) as HTMLButtonElement;
    materials.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "CAREEROS_OPEN_MATERIALS",
      jobId: pageJob.jobId,
      tab: "tailor",
    });
  });

  it("tucks against the edge and hides on request", async () => {
    mountAssistant();
    const host = assistantHost();
    const tuck = host.shadowRoot.querySelector(
      'button[aria-label="Tuck CareerOS against the edge"]',
    ) as HTMLButtonElement;
    tuck.click();
    expect(
      host.shadowRoot.querySelector(".dock")?.classList.contains("collapsed"),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        careeros_assistant_dock: { side: "right", top: 0.6, tucked: true },
      }),
    );
    (
      host.shadowRoot.querySelector(
        'button[aria-label="Hide CareerOS on this page"]',
      ) as HTMLButtonElement
    ).click();
    expect(isAssistantMounted()).toBe(false);
  });

  it("switches the panel between English and Chinese from the header", async () => {
    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("Autofill this page"),
    );
    (host.shadowRoot.querySelector(".lang-btn") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("自动填写此页"),
    );
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      "careeros.extensionLocale": "zh-CN",
    });
    expect(
      host.shadowRoot.querySelector(".launcher")?.getAttribute("aria-label"),
    ).toBe("关闭 CareerOS 助手");
    (host.shadowRoot.querySelector(".lang-btn") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("Autofill this page"),
    );
  });

  it("says so when autofill finds no application form", async () => {
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string };
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "NOT_APPLICATION_PAGE",
              adapter: null,
              reasons: [],
              forms: [],
            },
          };
        }
        return { ok: true, data: null };
      },
    });
    mountAssistant();
    const host = assistantHost();
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.querySelector(".autofill")).not.toBeNull(),
    );
    (host.shadowRoot.querySelector(".autofill") as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "No application form found on this page.",
      ),
    );
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "CAREEROS_APPLY_FILL_PLAN" }),
    );
  });

  it("keeps the cover letter section collapsed until drafted, then shows it filled", async () => {
    document.body.innerHTML = `
      <script type="application/ld+json">${JSON.stringify({
        "@type": "JobPosting",
        title: "Backend Engineer",
        hiringOrganization: { name: "Acme" },
        description: "<p>Build reliable APIs with Python and PostgreSQL.</p>",
      })}</script>
      <h1>Backend Engineer</h1>
      <form id="application-form">
        <label for="cover_letter">Cover Letter</label>
        <input id="cover_letter" type="file" />
        <button type="submit">Submit</button>
      </form>
    `;
    window.history.pushState({}, "", "/jobs/123/apply");
    mockChrome({
      sendMessage: async (message) => {
        const request = message as { type: string } & Record<string, unknown>;
        if (request.type === "CAREEROS_GET_AUTH_STATUS") {
          return { ok: true, data: { authenticated: true } };
        }
        if (request.type === "CAREEROS_DETECT_ACTIVE_PAGE") {
          return {
            ok: true,
            data: {
              status: "APPLICATION_PAGE",
              adapter: "generic",
              reasons: [],
              forms: [
                {
                  id: "form-0",
                  adapter: "generic",
                  support: "SUPPORTED",
                  fields: [
                    {
                      id: "field-0-0",
                      controlType: "FILE",
                      question: "Cover Letter",
                      required: false,
                      canonicalKey: "COVER_LETTER_FILE",
                      support: "SUPPORTED",
                      confidence: "MEDIUM",
                      options: [],
                    },
                  ],
                },
              ],
            },
          };
        }
        if (request.type === "CAREEROS_RESOLVE_ANSWERS") {
          return {
            ok: true,
            data: {
              decisions: [],
              selectedResumeVersionId: null,
              semanticClassifierUsed: false,
            },
          };
        }
        if (request.type === "CAREEROS_CLIP_JOB") {
          return {
            ok: true,
            data: {
              jobId: "0b6f7a9e-3f5c-4e63-9d8e-1a2b3c4d5e6f",
              created: true,
            },
          };
        }
        if (request.type === "CAREEROS_DRAFT_COVER_LETTER") {
          return {
            ok: true,
            data: {
              status: "DRAFTED",
              text: "I build reliable APIs.",
              evidenceCount: 2,
              unsupportedPoints: [],
            },
          };
        }
        if (request.type === "CAREEROS_ATTACH_COVER_LETTER") {
          return {
            ok: true,
            data: { fieldId: request.fieldId, state: "FILLED" },
          };
        }
        return { ok: true, data: null };
      },
    });
    mountAssistant();
    const host = assistantHost();
    const buttonNamed = (name: string) =>
      Array.from(host.shadowRoot.querySelectorAll("button")).find(
        (button) => button.textContent === name,
      );
    (host.shadowRoot.querySelector(".launcher") as HTMLButtonElement).click();

    // Save the job first so the letter has somewhere to belong.
    await vi.waitFor(() => expect(buttonNamed("Save this job")).toBeTruthy());
    buttonNamed("Save this job")!.click();
    await vi.waitFor(() =>
      expect(buttonNamed("Save to CareerOS")).toBeTruthy(),
    );
    buttonNamed("Save to CareerOS")!.click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("Saved to CareerOS"),
    );

    buttonNamed("Reinspect page")!.click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain("Cover letter"),
    );

    // Collapsed by default, showing only the completion chip.
    const header = Array.from(
      host.shadowRoot.querySelectorAll(".section-toggle"),
    ).find((el) => el.textContent?.includes("Cover letter")) as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(header.textContent).toContain("Filled (0/1)");
    expect(
      host.shadowRoot.textContent?.includes(
        "This form asks for a cover letter",
      ),
    ).toBe(false);

    header.click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "This form asks for a cover letter file.",
      ),
    );
    buttonNamed("Draft from my experience")!.click();
    await vi.waitFor(() =>
      expect(
        host.shadowRoot.querySelector<HTMLTextAreaElement>(
          "textarea[aria-label='Draft answer (editable)']",
        )?.value,
      ).toBe("I build reliable APIs."),
    );
    buttonNamed("Attach as Word file")!.click();
    await vi.waitFor(() =>
      expect(host.shadowRoot.textContent).toContain(
        "Attached as a Word file. Check it on the page before you submit.",
      ),
    );
    const updatedHeader = Array.from(
      host.shadowRoot.querySelectorAll(".section-toggle"),
    ).find((el) => el.textContent?.includes("Cover letter")) as HTMLElement;
    expect(updatedHeader.textContent).toContain("Filled (1/1)");
    expect(updatedHeader.querySelector(".chip")?.className).toContain("good");
  });
});
