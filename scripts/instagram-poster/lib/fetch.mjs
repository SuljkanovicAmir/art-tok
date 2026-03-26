export const IG_GRAPH = "https://graph.facebook.com/v21.0";

export async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from ${new URL(url).hostname}: ${text.slice(0, 200)}`);
      }
    }
    if (res.status === 429 && i < retries) {
      const wait = (i + 1) * 2000;
      console.log(`Rate limited, retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${new URL(url).hostname}${new URL(url).pathname}`);
  }
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Referrer headers for sources that block direct image fetches ─────────
const IMAGE_REFERRERS = {
  "www.artic.edu": "https://www.artic.edu/",
};

const IMAGE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

/**
 * Fetch an image and return the raw Buffer.
 * Throws with err.statusCode = 429 | 403 on persistent failure
 * so callers can blacklist the source.
 */
export async function probeImage(url, retries = 2) {
  const hostname = new URL(url).hostname;
  const referrer = IMAGE_REFERRERS[hostname];
  const headers = { ...IMAGE_HEADERS };
  if (referrer) headers.Referer = referrer;

  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { headers });

    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }

    if ((res.status === 429 || res.status === 403) && i < retries) {
      const wait = (i + 1) * 2000;
      console.log(`Image ${res.status} (${hostname}), retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    const err = new Error(`Image fetch failed: ${res.status} from ${hostname}`);
    err.statusCode = res.status;
    throw err;
  }
}
