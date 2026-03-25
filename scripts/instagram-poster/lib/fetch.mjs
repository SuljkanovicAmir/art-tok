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
