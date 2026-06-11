const {
  DROPBOX_REFRESH_TOKEN,
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
} = process.env;

export async function getDropboxToken() {
  if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error("DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET must be set");
  }

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: DROPBOX_REFRESH_TOKEN,
      client_id: DROPBOX_APP_KEY,
      client_secret: DROPBOX_APP_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dropbox token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

export async function uploadToDropbox(buffer, filenamePrefix, extension) {
  const token = await getDropboxToken();
  const filename = `${filenamePrefix}-${Date.now()}.${extension}`;
  const path = `/arttok/${filename}`;

  const uploadRes = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`Dropbox upload failed (${uploadRes.status}): ${body}`);
  }

  const shareRes = await fetch("https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      settings: { requested_visibility: { ".tag": "public" } },
    }),
  });

  let shareUrl;
  if (shareRes.ok) {
    const shareData = await shareRes.json();
    shareUrl = shareData.url;
  } else {
    const listRes = await fetch("https://api.dropboxapi.com/2/sharing/list_shared_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, direct_only: true }),
    });
    const listData = await listRes.json();
    shareUrl = listData.links?.[0]?.url;
    if (!shareUrl) throw new Error("Failed to create or find Dropbox shared link");
  }

  // Use dl.dropboxusercontent.com (direct CDN) instead of www.dropbox.com.
  // Why: Meta's media fetcher intermittently fails on www.dropbox.com/scl/...?raw=1
  // (returns error 9004/2207052 "media could not be fetched"), while the direct
  // CDN host serves the binary reliably without going through the web frontend.
  const directUrl = toDirectUrl(shareUrl);

  // Pre-probe the direct URL before handing it to Meta. A freshly-created shared
  // link can take a few seconds to become CDN-fetchable; catching that here (with
  // backoff) converts the Meta-9004 "media could not be fetched" class into an
  // early, retryable failure. Clean up the orphaned upload if it never serves.
  try {
    await probeDirectUrl(directUrl);
  } catch (err) {
    await deleteFromDropbox(path, token);
    throw err;
  }

  return { url: directUrl, path, token };
}

/**
 * Rewrite a Dropbox share URL to the direct-download CDN host. Pure + idempotent.
 */
export function toDirectUrl(shareUrl) {
  return shareUrl
    .replace("www.dropbox.com", "dl.dropboxusercontent.com")
    .replace(/\?dl=0$/, "?dl=1")
    .replace(/&dl=0/, "&dl=1");
}

/**
 * Verify a direct Dropbox URL actually serves image/video bytes before Meta tries.
 * NOTE: Dropbox's CDN answers HEAD with JSON metadata (no real content-type), so we
 * must probe with GET and discard the body. Retries with linear backoff to absorb
 * shared-link propagation delay. Throws after `attempts` failures.
 */
export async function probeDirectUrl(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") || "";
      const len = Number(res.headers.get("content-length") || 0);
      res.body?.cancel?.();
      const okType = type.startsWith("image/") || type.startsWith("video/");
      if (res.ok && okType && (len === 0 || len > 1000)) return;
      console.warn(`Direct-URL probe ${i}/${attempts}: status=${res.status} type=${type} len=${len}`);
    } catch (err) {
      console.warn(`Direct-URL probe ${i}/${attempts} error: ${err.message}`);
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, i * 5000));
  }
  throw new Error("Dropbox direct URL not fetchable — aborting before Meta container creation");
}

export async function uploadImage(imageBuffer) {
  return uploadToDropbox(imageBuffer, "arttok", "jpg");
}

export async function deleteFromDropbox(path, token) {
  try {
    const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      console.warn(`Dropbox delete failed (${res.status}) for ${path}`);
    } else {
      console.log(`Cleaned up Dropbox file: ${path}`);
    }
  } catch (err) {
    // Non-fatal — file will just stay in Dropbox
    console.warn(`Dropbox delete error for ${path}: ${err.message}`);
  }
}
