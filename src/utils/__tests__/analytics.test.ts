import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizePath,
  resetAnalyticsForTests,
  trackEvent,
  trackPageView,
} from "../analytics";

describe("analytics", () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    document.head.querySelectorAll("script[data-goatcounter]").forEach((s) => s.remove());
    delete window.goatcounter;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a silent no-op when the site code is unset", () => {
    vi.stubEnv("VITE_GOATCOUNTER_CODE", "");
    expect(() => {
      trackPageView("/timeline");
      trackEvent("share");
    }).not.toThrow();
    expect(document.head.querySelector("script[data-goatcounter]")).toBeNull();
    expect(window.goatcounter).toBeUndefined();
  });

  it("strips query strings and hashes from paths", () => {
    expect(normalizePath("/timeline?c=abc123")).toBe("/timeline");
    expect(normalizePath("/search?q=monet#top")).toBe("/search");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("?x=1")).toBe("/");
  });

  it("loads the script with no_onload and sends queued counts after load", () => {
    vi.stubEnv("VITE_GOATCOUNTER_CODE", "arttok");
    trackPageView("/timeline?c=1");
    const script = document.head.querySelector<HTMLScriptElement>("script[data-goatcounter]");
    expect(script?.dataset.goatcounter).toBe("https://arttok.goatcounter.com/count");
    expect(script?.src).toBe("https://gc.zgo.at/count.js");
    expect(window.goatcounter?.no_onload).toBe(true);

    const count = vi.fn();
    window.goatcounter = { ...window.goatcounter, count };
    script?.dispatchEvent(new Event("load"));
    expect(count).toHaveBeenCalledWith({ path: "/timeline", event: false });
  });

  it("swallows errors thrown by the counter", () => {
    vi.stubEnv("VITE_GOATCOUNTER_CODE", "arttok");
    trackEvent("x");
    const script = document.head.querySelector<HTMLScriptElement>("script[data-goatcounter]");
    window.goatcounter = {
      count: () => {
        throw new Error("boom");
      },
    };
    expect(() => script?.dispatchEvent(new Event("load"))).not.toThrow();
  });
});
