# Instagram Caption Descriptions & Artsy Formatting

**Date:** 2026-03-25
**Scope:** `scripts/instagram-poster/lib/captions.mjs`, `scripts/instagram-poster/lib/art-fetchers.mjs`, `scripts/instagram-poster/post.mjs`

## Changes

### Art description fetching
- **Harvard**: `description` field was already in API query but not returned — now included in all art objects
- **AIC**: Added `description` to `AIC_FIELDS` and all return objects
- **Met**: No description field available from Met API — gracefully skipped

### Caption formatting — gallery wall style (mode-aware)

`buildCaption(art, mode)` now accepts a `mode` parameter (`"post"` or `"reel"`).

**Post format** (full museum-label with typographic separators):
```
Title
Artist
Date · Medium
Museum

—

[Description — up to 400 chars]

·

[Rotating engagement hook]

Follow @arttok.art · Masterworks, daily.
```

**Reel format** (compact, cinematic):
```
Title
Artist · Date
Museum

[Description — up to 200 chars]

[Rotating reel hook]

Follow @arttok.art · Masterworks, daily.
```

### Rotating engagement hooks
**Post hooks** (10 variations) — drive comments:
- "What draws your eye first?"
- "Would you hang this on your wall?"
- "One word to describe this piece. Go."
- etc.

**Reel hooks** (8 variations) — drive saves/shares:
- "Art that stops you mid-scroll."
- "Save this for your next museum visit."
- "Pause. Look closer. What do you see?"
- etc.

### Description handling
- HTML stripped (AIC sometimes returns HTML in descriptions)
- Descriptions shorter than 20 chars are skipped
- Truncated at word boundaries (400 chars for posts, 200 for reels)
- When no description: separator + description block skipped entirely
