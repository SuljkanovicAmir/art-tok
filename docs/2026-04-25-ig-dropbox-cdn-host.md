# IG Poster: Switch to dl.dropboxusercontent.com for Meta-bound URLs

**Date:** 2026-04-25

## Problem

Out of the last 15 Instagram-Auto-Post workflow runs, 9 failed (60%). Of those,
8 hit the same error at the IG container-creation step:

```
Instagram container creation failed (400):
  code 9004, error_subcode 2207052
  message: "Only photo or video can be accepted as media type."
  user_msg: "The media could not be fetched from this URI:
    https://www.dropbox.com/scl/fi/<id>/arttok-…jpg?rlkey=…&raw=1"
  is_transient: false
```

The image was generated, passed the aspect filter, and uploaded to Dropbox
successfully. The same `www.dropbox.com/scl/...?raw=1` URL pattern also
appeared in the runs that *succeeded* — so this is intermittent on Meta's
side, not a code bug. Meta's fetcher periodically gets back HTML/preview
content (or a rate-limit) when it hits the `www.dropbox.com` web frontend.

Because the response sets `is_transient: false`, the existing retry guard
in `instagram-api.mjs` does not kick in: one bad fetch on Meta's side fails
the entire job.

## Fix

Rewrite the shared-link URL we hand to Meta from the web-frontend host to
the direct CDN host:

- Before: `https://www.dropbox.com/scl/fi/<id>/<file>?rlkey=<key>&raw=1`
- After: `https://dl.dropboxusercontent.com/scl/fi/<id>/<file>?rlkey=<key>&dl=1`

The CDN host serves the binary directly without going through the web
frontend, anti-bot heuristics, or preview rendering, which is what most
projects switch to once Meta starts rejecting their `www.dropbox.com` URLs.

Edit lives in `scripts/instagram-poster/lib/dropbox.mjs` (the `directUrl`
construction at the end of `uploadToDropbox`). Only the URL handed off to
Instagram changes; cache URLs in `image-cache.json` are unaffected because
they're only fetched by our own Node code, which handles either host.

## Out of Scope

- Aspect-filter retry exhaustion (1 of the 9 failures, run 24911296797) —
  separate content-availability problem in the curator cache pool.
- Adding `2207052` to the transient-retry list in `instagram-api.mjs` — a
  reasonable belt-and-suspenders follow-up but not required by this fix.
- `curator.mjs:217` uses the same old transformation for cache source URLs,
  but those URLs are only consumed internally and don't trigger the Meta
  bug, so left as-is.
