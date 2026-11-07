// Cookie-free analytics via GoatCounter. Inactive (silent no-op) unless
// VITE_GOATCOUNTER_CODE is set at build time. No personal data is collected.

interface GoatCounterVars {
  path?: string;
  title?: string;
  event?: boolean;
}

interface GoatCounter {
  no_onload?: boolean;
  count?: (vars?: GoatCounterVars) => void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

const SCRIPT_SRC = "https://gc.zgo.at/count.js";

let scriptRequested = false;
let scriptLoaded = false;
const pending: GoatCounterVars[] = [];

function getCode(): string | null {
  const code: unknown = import.meta.env.VITE_GOATCOUNTER_CODE;
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null;
}

/** Drops query string and hash so challenge links do not fragment reports. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0];
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function flush(): void {
  const count = window.goatcounter?.count;
  if (typeof count !== "function") return;
  while (pending.length > 0) {
    const vars = pending.shift();
    try {
      count(vars);
    } catch {
      // analytics must never break the app
    }
  }
}

function ensureScript(code: string): void {
  if (scriptRequested) return;
  scriptRequested = true;
  window.goatcounter = { ...window.goatcounter, no_onload: true };
  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;
  script.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  script.addEventListener("load", () => {
    scriptLoaded = true;
    flush();
  });
  script.addEventListener("error", () => {
    pending.length = 0;
  });
  document.head.appendChild(script);
}

function send(vars: GoatCounterVars): void {
  try {
    if (typeof window === "undefined") return;
    const code = getCode();
    if (!code) return;
    ensureScript(code);
    pending.push(vars);
    if (scriptLoaded) flush();
  } catch {
    // analytics must never break the app
  }
}

export function trackPageView(path: string): void {
  send({ path: normalizePath(path), event: false });
}

export function trackEvent(name: string): void {
  send({ path: name, event: true });
}

/** Test helper: resets module state. */
export function resetAnalyticsForTests(): void {
  scriptRequested = false;
  scriptLoaded = false;
  pending.length = 0;
}
