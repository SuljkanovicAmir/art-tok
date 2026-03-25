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

  const directUrl = shareUrl.replace(/\?dl=0$/, "?raw=1").replace(/&dl=0/, "&raw=1");
  return { url: directUrl, path, token };
}

export async function uploadImage(imageBuffer) {
  return uploadToDropbox(imageBuffer, "arttok", "jpg");
}

export async function deleteFromDropbox(path, token) {
  try {
    await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    console.log("Cleaned up Dropbox file");
  } catch {
    // Non-fatal — file will just stay in Dropbox
  }
}
