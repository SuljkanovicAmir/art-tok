// Posts a 3-frame "This week at @arttok.art" story from the week's top posts.
// Every failure is non-fatal: stories are ephemeral bonus content, so a recap
// problem must never fail the weekly analytics workflow.
import "dotenv/config";
import { fetchSpecificArtwork } from "./lib/art-fetchers.mjs";
import { publishAutoStory } from "./lib/instagram-api.mjs";
import { refreshTokenIfNeeded } from "./lib/token-refresh.mjs";
import { loadQualityLog } from "./lib/quality-log.mjs";

const QUALITY_LOG_FILE = new URL("./post-quality-log.json", import.meta.url);

async function main() {
  const token = await refreshTokenIfNeeded(process.env.INSTAGRAM_ACCESS_TOKEN);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const week = loadQualityLog(QUALITY_LOG_FILE.pathname.replace(/^\/([A-Z]:)/, "$1"))
    .filter((e) => new Date(e.timestamp) > weekAgo && e.mediaId && e.mode !== "story");

  // Engagement isn't in the quality log; metadataScore is the best local proxy.
  const top = week.sort((a, b) => b.metadataScore - a.metadataScore).slice(0, 3);
  console.log(`Recap: ${top.length} highlights from ${week.length} posts this week`);

  for (const entry of top) {
    try {
      const art = await fetchSpecificArtwork(entry.artKey);
      await publishAutoStory(token, art, null); // already non-fatal internally
    } catch (err) {
      console.warn(`Recap frame skipped (${entry.artKey}): ${err.message}`);
    }
  }
}

main().catch((err) => { console.warn(`Recap failed (non-fatal): ${err.message}`); });
