# Analytics (GoatCounter)

Privacy-friendly, cookie-free page view counting using GoatCounter. No personal data, identifiers or emails are collected, no cookies are set, and no npm dependency is added.

## What is tracked
- One page view per route change, via `usePageViewTracking` (mounted in `src/App.tsx`).
- Paths only: query strings and hashes are stripped, so challenge links such as `/timeline?c=...` count as `/timeline`.
- `trackEvent(name)` is available in `src/utils/analytics.ts` for named events. Nothing calls it yet.

## How it works
- `src/utils/analytics.ts` reads `VITE_GOATCOUNTER_CODE`. If unset, every function is a silent no-op: no script is loaded and nothing is sent (local dev and forks).
- When set, `https://gc.zgo.at/count.js` is loaded with `data-goatcounter="https://<code>.goatcounter.com/count"` and `window.goatcounter.no_onload = true` (the app is a SPA, so counting is manual).
- Calls made before the script has loaded are queued and sent on load. Errors are swallowed.
- React StrictMode double effects are deduplicated with a ref of the last tracked path.

## How to enable
1. Create a free GoatCounter account and site; note the site code (the `<code>` in `<code>.goatcounter.com`).
2. In the GitHub repo, add a repository variable (Settings > Secrets and variables > Actions > Variables) named `VITE_GOATCOUNTER_CODE`. It is a public value, so a variable, not a secret.
3. The next deploy picks it up (`.github/workflows/deploy.yml` passes it to the build).
For local testing, put `VITE_GOATCOUNTER_CODE=<code>` in `.env`.

## Follow-up
Once both this PR and the Timeline PR are merged, wire Timeline events (for example game started, completed, shared) with `trackEvent`. Not done here because Timeline is not on this branch.
