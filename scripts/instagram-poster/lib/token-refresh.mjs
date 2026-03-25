import { IG_GRAPH } from "./fetch.mjs";

const { META_APP_ID, META_APP_SECRET, FACEBOOK_PAGE_ID } = process.env;

export async function refreshTokenIfNeeded(token) {
  if (!META_APP_ID || !META_APP_SECRET || !FACEBOOK_PAGE_ID) {
    // Can't auto-refresh without app credentials — use existing token
    return token;
  }

  try {
    // Check if current token is still valid
    const debugRes = await fetch(
      `${IG_GRAPH}/debug_token?input_token=${token}&access_token=${META_APP_ID}|${META_APP_SECRET}`,
    );
    const debugData = await debugRes.json();

    if (debugData.data?.is_valid) {
      const expiresAt = debugData.data.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const daysLeft = expiresAt ? (expiresAt - now) / 86400 : Infinity;

      if (daysLeft > 7) {
        console.log(`Token valid (${Math.floor(daysLeft)} days remaining)`);
        return token;
      }
      console.log(`Token expiring soon (${Math.floor(daysLeft)} days) — refreshing...`);
    } else {
      console.log("Token invalid — attempting refresh...");
    }

    // Exchange current token for a fresh long-lived user token
    const exchangeRes = await fetch(
      `${IG_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${token}`,
    );
    const exchangeData = await exchangeRes.json();

    if (exchangeData.access_token) {
      // Get fresh page token
      const accountsRes = await fetch(
        `${IG_GRAPH}/me/accounts?access_token=${exchangeData.access_token}`,
      );
      const accountsData = await accountsRes.json();
      const page = accountsData.data?.find((p) => p.id === FACEBOOK_PAGE_ID);

      if (page?.access_token) {
        console.log("Token refreshed successfully");
        return page.access_token;
      }
    }

    console.warn("Token refresh failed — using existing token");
    return token;
  } catch (err) {
    console.warn(`Token refresh error: ${err.message} — using existing token`);
    return token;
  }
}
