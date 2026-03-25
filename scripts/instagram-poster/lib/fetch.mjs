export const IG_GRAPH = "https://graph.facebook.com/v21.0";

export async function fetchJson(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 && i < retries) {
      const wait = (i + 1) * 2000;
      console.log(`Rate limited, retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
