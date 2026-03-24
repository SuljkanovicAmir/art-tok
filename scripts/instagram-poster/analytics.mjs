#!/usr/bin/env node
/**
 * ArtTok Instagram Weekly Analytics Report
 *
 * Fetches engagement metrics from Instagram Graph API and generates
 * a markdown report committed to docs/analytics/.
 *
 * Usage: node analytics.mjs
 * Required env vars: INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "..", "docs", "analytics");
const IG_GRAPH = "https://graph.facebook.com/v21.0";
const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID } = process.env;

if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_USER_ID) {
  console.error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID required");
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getProfile() {
  return fetchJson(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}?fields=followers_count,media_count,username&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
  );
}

async function getRecentMedia(limit = 50) {
  const data = await fetchJson(
    `${IG_GRAPH}/${INSTAGRAM_USER_ID}/media?fields=id,caption,timestamp,like_count,comments_count,media_type&limit=${limit}&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
  );
  return data.data || [];
}

async function getMediaInsights(mediaId) {
  try {
    const data = await fetchJson(
      `${IG_GRAPH}/${mediaId}/insights?metric=reach,impressions,saved,shares&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
    );
    const metrics = {};
    for (const m of data.data || []) {
      metrics[m.name] = m.values?.[0]?.value ?? 0;
    }
    return metrics;
  } catch {
    try {
      const data = await fetchJson(
        `${IG_GRAPH}/${mediaId}/insights?metric=reach,plays,saved,shares&access_token=${INSTAGRAM_ACCESS_TOKEN}`,
      );
      const metrics = {};
      for (const m of data.data || []) {
        metrics[m.name] = m.values?.[0]?.value ?? 0;
      }
      return metrics;
    } catch {
      return {};
    }
  }
}

function extractSource(caption) {
  if (!caption) return "unknown";
  if (caption.includes("Harvard")) return "harvard";
  if (caption.includes("Metropolitan")) return "met";
  if (caption.includes("Art Institute of Chicago")) return "artic";
  return "unknown";
}

function getPreviousFollowers() {
  if (!existsSync(DOCS_DIR)) return null;
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith("-weekly.md")).sort();
  if (files.length === 0) return null;

  const lastReport = readFileSync(join(DOCS_DIR, files[files.length - 1]), "utf-8");
  const match = lastReport.match(/Followers:\s*\*\*(\d+)\*\*/);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  console.log("ArtTok Instagram Weekly Analytics");
  console.log("─".repeat(50));

  const profile = await getProfile();
  console.log(`@${profile.username} — ${profile.followers_count} followers, ${profile.media_count} posts`);

  const media = await getRecentMedia();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisWeek = media.filter((m) => new Date(m.timestamp) >= weekAgo);
  console.log(`Posts this week: ${thisWeek.length}`);

  const enriched = [];
  for (const m of thisWeek) {
    const insights = await getMediaInsights(m.id);
    enriched.push({
      ...m,
      ...insights,
      source: extractSource(m.caption),
      hour: new Date(m.timestamp).getUTCHours(),
      engagement: (m.like_count || 0) + (m.comments_count || 0) + (insights.saved || 0) + (insights.shares || 0),
    });
  }

  enriched.sort((a, b) => b.engagement - a.engagement);

  const prevFollowers = getPreviousFollowers();
  const followerDelta = prevFollowers !== null ? profile.followers_count - prevFollowers : null;
  const deltaStr = followerDelta !== null
    ? (followerDelta >= 0 ? `+${followerDelta}` : `${followerDelta}`)
    : "N/A (first report)";

  const bySource = {};
  for (const m of enriched) {
    if (!bySource[m.source]) bySource[m.source] = { likes: 0, saves: 0, reach: 0, count: 0 };
    bySource[m.source].likes += m.like_count || 0;
    bySource[m.source].saves += m.saved || 0;
    bySource[m.source].reach += m.reach || 0;
    bySource[m.source].count++;
  }

  const byHour = {};
  for (const m of enriched) {
    if (!byHour[m.hour]) byHour[m.hour] = { engagement: 0, count: 0 };
    byHour[m.hour].engagement += m.engagement;
    byHour[m.hour].count++;
  }

  const dateStr = now.toISOString().split("T")[0];
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  let report = `# Weekly Analytics — ${weekAgoStr} to ${dateStr}\n\n`;

  report += `## Profile\n`;
  report += `- Followers: **${profile.followers_count}** (${deltaStr})\n`;
  report += `- Total posts: ${profile.media_count}\n`;
  report += `- Posts this week: ${thisWeek.length}\n\n`;

  report += `## Top 5 Posts (by engagement)\n\n`;
  report += `| Title | Type | Likes | Comments | Saves | Shares | Reach | Engagement |\n`;
  report += `|-------|------|-------|----------|-------|--------|-------|------------|\n`;
  for (const m of enriched.slice(0, 5)) {
    const title = (m.caption || "").split("\n")[0].slice(0, 40);
    report += `| ${title} | ${m.media_type} | ${m.like_count || 0} | ${m.comments_count || 0} | ${m.saved || 0} | ${m.shares || 0} | ${m.reach || 0} | ${m.engagement} |\n`;
  }
  report += `\n`;

  if (enriched.length > 5) {
    report += `## Bottom 5 Posts\n\n`;
    report += `| Title | Type | Likes | Comments | Saves | Shares | Reach | Engagement |\n`;
    report += `|-------|------|-------|----------|-------|--------|-------|------------|\n`;
    for (const m of enriched.slice(-5).reverse()) {
      const title = (m.caption || "").split("\n")[0].slice(0, 40);
      report += `| ${title} | ${m.media_type} | ${m.like_count || 0} | ${m.comments_count || 0} | ${m.saved || 0} | ${m.shares || 0} | ${m.reach || 0} | ${m.engagement} |\n`;
    }
    report += `\n`;
  }

  report += `## Averages by Museum Source\n\n`;
  report += `| Source | Posts | Avg Likes | Avg Saves | Avg Reach |\n`;
  report += `|--------|-------|-----------|-----------|----------|\n`;
  for (const [source, data] of Object.entries(bySource)) {
    report += `| ${source} | ${data.count} | ${(data.likes / data.count).toFixed(1)} | ${(data.saves / data.count).toFixed(1)} | ${(data.reach / data.count).toFixed(0)} |\n`;
  }
  report += `\n`;

  report += `## Averages by Posting Hour (UTC)\n\n`;
  report += `| Hour | Posts | Avg Engagement |\n`;
  report += `|------|-------|----------------|\n`;
  for (const [hour, data] of Object.entries(byHour).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    report += `| ${hour.padStart(2, "0")}:00 | ${data.count} | ${(data.engagement / data.count).toFixed(1)} |\n`;
  }
  report += `\n`;

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
  const filename = `${dateStr}-weekly.md`;
  writeFileSync(join(DOCS_DIR, filename), report);
  console.log(`\nReport saved to docs/analytics/${filename}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
