import { IG_GRAPH } from "./fetch.mjs";
import { uploadToDropbox, uploadImage, deleteFromDropbox } from "./dropbox.mjs";
import { renderStoryCard } from "./render.mjs";

const { INSTAGRAM_USER_ID } = process.env;

export async function publishToInstagram(token, imageUrl, caption, { isStory = false, altText = "" } = {}) {
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Step 1: Create media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    caption: isStory ? "" : caption, // stories don't support captions via API
    access_token: token,
  });

  if (altText && !isStory) {
    containerParams.set("alt_text", altText);
  }

  if (isStory) {
    containerParams.set("media_type", "STORIES");
  }

  const containerRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
    { method: "POST" },
  );

  if (!containerRes.ok) {
    const body = await containerRes.text();
    throw new Error(`Instagram container creation failed (${containerRes.status}): ${body}`);
  }

  const { id: containerId } = await containerRes.json();
  console.log(`Container created: ${containerId}`);

  // Step 2: Wait for container to be ready (Instagram processes the image)
  await waitForContainer(token, containerId);

  // Step 3: Publish (with retries — Instagram may report FINISHED before media is truly available)
  let mediaId;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const publishRes = await fetch(
      `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: token,
        }).toString(),
      },
    );

    if (publishRes.ok) {
      ({ id: mediaId } = await publishRes.json());
      break;
    }

    const body = await publishRes.text();
    // Error 9007 / subcode 2207027 = "Media ID is not available" — transient, retry after delay
    if (publishRes.status === 400 && body.includes('"code":9007') && attempt < 5) {
      console.log(`Publish not ready (attempt ${attempt}/5), waiting ${attempt * 3}s...`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }
    throw new Error(`Instagram publish failed (${publishRes.status}): ${body}`);
  }

  return mediaId;
}

export async function waitForContainer(token, containerId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_GRAPH}/${containerId}?fields=status_code&access_token=${token}`,
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Container status check failed (${res.status}): ${body}`);
    }
    const data = await res.json();

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("Instagram container processing failed");

    console.log(`Container status: ${data.status_code} (attempt ${i + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Instagram container processing timed out");
}

export async function postFirstComment(token, mediaId, text) {
  try {
    const res = await fetch(`${IG_GRAPH}/${mediaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        message: text,
        access_token: token,
      }).toString(),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`First comment failed (${res.status}): ${body}`);
    } else {
      console.log("First comment (hashtags) posted");
    }
  } catch (err) {
    console.warn(`First comment error: ${err.message}`);
  }
}

export async function publishAutoStory(token, art) {
  try {
    console.log("Rendering auto-story card...");
    const storyBuffer = await renderStoryCard(art, art.imageUrl);
    console.log(`Story card rendered: ${(storyBuffer.length / 1024).toFixed(0)} KB`);

    const { url: storyUrl, path: storyPath, token: storyToken } = await uploadImage(storyBuffer);
    console.log("Publishing auto-story...");
    await publishToInstagram(token, storyUrl, "", { isStory: true });
    await deleteFromDropbox(storyPath, storyToken);
    console.log("Auto-story published");
  } catch (err) {
    console.warn(`Auto-story failed (non-fatal): ${err.message}`);
  }
}

export async function publishReel(token, videoBuffer, caption) {
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Upload video to Dropbox
  const { url: videoUrl, path, token: dbxToken } = await uploadToDropbox(videoBuffer, "arttok-reel", "mp4");
  console.log(`Reel hosted at: ${videoUrl}`);

  // Create REELS container
  const containerParams = new URLSearchParams({
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: token,
  });

  // Note: alt_text is NOT supported for REELS media type

  const containerRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
    { method: "POST" },
  );

  if (!containerRes.ok) {
    const body = await containerRes.text();
    throw new Error(`Reel container creation failed (${containerRes.status}): ${body}`);
  }

  const { id: containerId } = await containerRes.json();
  console.log(`Reel container created: ${containerId}`);

  // Wait for video processing (30 attempts — video takes longer)
  await waitForContainer(token, containerId, 30);

  // Publish
  const publishRes = await fetch(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: token,
      }).toString(),
    },
  );

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(`Reel publish failed (${publishRes.status}): ${body}`);
  }

  const { id: mediaId } = await publishRes.json();

  // Clean up Dropbox
  await deleteFromDropbox(path, dbxToken);

  return mediaId;
}
