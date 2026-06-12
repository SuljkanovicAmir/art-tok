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

  let containerId;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const containerRes = await fetch(
      `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
      { method: "POST" },
    );

    if (containerRes.ok) {
      ({ id: containerId } = await containerRes.json());
      console.log(`Container created: ${containerId}`);
      break;
    }

    const body = await containerRes.text();
    const isTransient = body.includes('"is_transient":true') || containerRes.status === 500;
    if (isTransient && attempt < 4) {
      const wait = attempt * 15;
      console.log(`Container creation failed (transient, attempt ${attempt}/4), retrying in ${wait}s...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`Instagram container creation failed (${containerRes.status}): ${body}`);
  }

  // Step 2: Wait for container to be ready (Instagram processes the image)
  await waitForContainer(token, containerId);

  // Step 3: Publish (shared 9007 retry parity with reels)
  return publishContainer(token, containerId);
}

/**
 * Publish a ready container, retrying Instagram's 9007 "Media ID is not available"
 * transient (it sometimes reports FINISHED before the media is truly publishable).
 * Shared by image posts and reels so both get identical retry behavior.
 */
export async function publishContainer(token, containerId, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
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
      const { id: mediaId } = await publishRes.json();
      return mediaId;
    }

    const body = await publishRes.text();
    // Error 9007 / subcode 2207027 = "Media ID is not available" — transient, retry after delay
    if (publishRes.status === 400 && body.includes('"code":9007') && attempt < attempts) {
      console.log(`Publish not ready (attempt ${attempt}/${attempts}), waiting ${attempt * 3}s...`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
      continue;
    }
    throw new Error(`Instagram publish failed (${publishRes.status}): ${body}`);
  }
  throw new Error("Instagram publish exhausted retries");
}

export async function waitForContainer(token, containerId, maxAttempts = 10, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`,
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Container status check failed (${res.status}): ${body}`);
    }
    const data = await res.json();

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram container processing failed: ${data.status || "(no detail)"}`);
    }

    console.log(`Container status: ${data.status_code} (attempt ${i + 1}/${maxAttempts})`);
    await new Promise((r) => setTimeout(r, intervalMs));
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

export async function publishAutoStory(token, art, existingStoryBuffer = null) {
  try {
    const storyBuffer = existingStoryBuffer || await renderStoryCard(art, art.imageUrl);
    if (!existingStoryBuffer) {
      console.log(`Auto-story card rendered: ${(storyBuffer.length / 1024).toFixed(0)} KB`);
    }

    const { url: storyUrl, path: storyPath, token: storyToken } = await uploadImage(storyBuffer);
    console.log("Publishing auto-story...");
    await publishToInstagram(token, storyUrl, "", { isStory: true });
    await deleteFromDropbox(storyPath, storyToken);
    console.log("Auto-story published");
  } catch (err) {
    console.warn(`Auto-story failed (non-fatal): ${err.message}`);
  }
}

export async function publishReel(token, videoBuffer, caption, { trial = false, thumbOffsetMs = 17000 } = {}) {
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  if (!INSTAGRAM_USER_ID) throw new Error("INSTAGRAM_USER_ID not set");

  // Upload video to Dropbox
  const { url: videoUrl, path, token: dbxToken } = await uploadToDropbox(videoBuffer, "arttok-reel", "mp4");
  console.log(`Reel hosted at: ${videoUrl}`);

  try {
    // Create REELS container
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: token,
    });
    containerParams.set("thumb_offset", String(thumbOffsetMs)); // grid cover ≈ the full painting near the end
    if (trial) containerParams.set("trial_params", JSON.stringify({ trial_type: "STANDARD" }));

    // Note: alt_text is NOT supported for REELS media type

    let containerId;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const containerRes = await fetch(
        `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${containerParams.toString()}`,
        { method: "POST" },
      );

      if (containerRes.ok) {
        ({ id: containerId } = await containerRes.json());
        console.log(`Reel container created: ${containerId}${containerParams.has("trial_params") ? " (trial)" : ""}`);
        break;
      }

      const body = await containerRes.text();
      // trial_params availability varies by account — degrade gracefully to a normal reel.
      if (containerParams.has("trial_params") && body.includes("trial")) {
        console.warn("trial_params rejected — publishing as a normal reel");
        containerParams.delete("trial_params");
        continue; // consumes one attempt of this loop
      }
      const isTransient = body.includes('"is_transient":true') || containerRes.status === 500;
      if (isTransient && attempt < 4) {
        const wait = attempt * 15;
        console.log(`Reel container creation failed (transient, attempt ${attempt}/4), retrying in ${wait}s...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw new Error(`Reel container creation failed (${containerRes.status}): ${body}`);
    }

    // Wait for video processing — videos take longer, so poll 60× at 5s (5-min budget)
    await waitForContainer(token, containerId, 60, 5000);

    // Publish with the same 9007 retry parity as image posts
    return await publishContainer(token, containerId);
  } finally {
    // Clean up Dropbox whether publish succeeded or threw
    await deleteFromDropbox(path, dbxToken);
  }
}

/**
 * Publish a CAROUSEL post from already-hosted image URLs (2–10 children).
 * Reuses the shared container/poll/publish plumbing. IG crops every child to
 * the first child's aspect, so callers should pass same-orientation images.
 */
export async function publishCarousel(token, hostedUrls, caption) {
  if (hostedUrls.length < 2) throw new Error("carousel needs >=2 items");

  const children = [];
  for (const url of hostedUrls) {
    const params = new URLSearchParams({
      image_url: url, is_carousel_item: "true", access_token: token,
    });
    const res = await fetch(`${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${params.toString()}`, { method: "POST" });
    if (!res.ok) throw new Error(`Carousel child failed (${res.status}): ${await res.text()}`);
    children.push((await res.json()).id);
  }
  for (const id of children) await waitForContainer(token, id);

  const parentParams = new URLSearchParams({
    media_type: "CAROUSEL", children: children.join(","), caption, access_token: token,
  });
  const parentRes = await fetch(`${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?${parentParams.toString()}`, { method: "POST" });
  if (!parentRes.ok) throw new Error(`Carousel container failed (${parentRes.status}): ${await parentRes.text()}`);
  const { id: parentId } = await parentRes.json();
  await waitForContainer(token, parentId);
  return publishContainer(token, parentId);
}
