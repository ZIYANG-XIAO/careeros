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
