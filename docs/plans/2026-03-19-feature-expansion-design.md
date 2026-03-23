# ArtTok Feature Expansion Design

**Date:** 2026-03-19
**Status:** Approved
**Priority Order:** Art Discovery → Engagement → Social

---

## Vision

Transform ArtTok from a vertical art feed into the definitive culture discovery platform. Primary focus: make it the best way to explore and learn about art (Google Arts & Culture depth), then layer engagement mechanics (Duolingo retention), then social features (Pinterest curation + Spotify sharing).

Long-term: expand beyond classic art into photography, architecture, music, and more — becoming "CultureTok."

---

## Phase 0: Architecture Foundation

Build before any features. These enable everything that follows.

### 0.1 Multi-Source API Federation

**What:** Expand beyond Harvard (200K objects) to Met Museum (500K+), Art Institute of Chicago (100K+), Rijksmuseum (700K+).

**Technical approach:**
- Create an `ArtSource` adapter interface each API implements
- Normalize all responses to the existing `ArtPiece` type via per-source mappers
- Round-robin or weighted-random selection across sources in feed queries
- New fields on `ArtPiece`: `source: 'harvard' | 'met' | 'artic' | 'rijks'`, `sourceUrl`
- Each adapter handles its own pagination, rate limiting, and error handling

**Key APIs:**
- Met: `https://collectionapi.metmuseum.org/public/collection/v1` (free, no key)
- Art Institute of Chicago: `https://api.artic.edu/api/v1` (free, no key)
- Rijksmuseum: `https://www.rijksmuseum.nl/api` (free key required)

### 0.2 User Preference Engine

**What:** Client-side taste profiling from all user interactions.

**Technical approach:**
- Track signals: likes (strongest), dwell time per card (>3s = interest), tap-to-detail, share, skip (<1s = disinterest)
- Build weighted preference vector: `{ culture: {French: 0.4, Japanese: 0.3, ...}, century: {...}, classification: {...}, medium: {...} }`
- Weights: like=1.0, dwell>5s=0.5, detail-tap=0.3, share=0.8, skip=-0.2
- Store in localStorage, update incrementally on each interaction
- Expose via `useUserProfile()` hook
- Utility: `computeSimilarity(userVector, artworkVector) → number` using cosine similarity

### 0.3 PWA + Offline Support

**What:** Installable app with offline viewing of liked/downloaded artworks.

**Technical approach:**
- Workbox for Service Worker generation (cache-first for images, network-first for API)
- IndexedDB for offline metadata storage (liked artworks + their full data)
- Background sync for likes made offline
- Web App Manifest with icons, theme color, display: standalone
- Precache app shell, lazy-cache artwork images on view

### 0.4 Codebase Cleanup

**What:** Remove dead code, standardize data fetching patterns.

**Tasks:**
- Delete `src/stores/ArtImagesStore.ts` and `src/stores/SearchStore.ts` (unused MobX stores)
- Delete or repurpose `src/components/LikedArtPanel.tsx` (replaced by `/liked` route)
- Migrate `LikedPage` to React Query (currently uses raw `useEffect` + `Promise.allSettled`)
- Migrate `CategoriesPage` to React Query (currently uses raw `useState` + `useEffect`)
- Remove MobX dependency from `package.json` if no longer needed
- Add Vitest for testing

---

## Phase 1: Core Discovery Features

The features that make ArtTok uniquely valuable as an art discovery tool.

### 1.1 "For You" Algorithmic Feed

**What:** Personalized feed that learns from likes, dwell time, skips, and taps. Replaces random sort.

**Why users love it:** TikTok's core engagement driver. Feed "reads your mind." 8x higher engagement than chronological feeds.

**Technical approach:**
- Use the preference engine (Phase 0.2) to compute a taste vector
- Fetch a batch of artworks from multiple sources (larger pool than displayed)
- Re-rank client-side by `computeSimilarity(userVector, artworkAttributes)`
- Mix in 20% serendipity (random artworks outside top preferences) to prevent filter bubbles
- New users (cold start): use `sort=random` with `verificationlevel:4` quality filter until 10+ likes

### 1.2 Time Travel Feed

**What:** A slider that scrubs through centuries. Feed morphs in real-time from ancient to contemporary.

**Why users love it:** Makes 5,000 years of human creativity tangible and navigable. Only an art app can do this.

**Technical approach:**
- Horizontal slider component: range from ~3000 BCE to 2025 CE, snapping to century markers
- Map slider position to `yearmade` API range parameter (e.g., 1800-1899)
- Pre-fetch adjacent century ranges for smooth scrubbing (n-1, n, n+1)
- CSS crossfade transitions between century batches
- Display century label + notable context: "19th Century — Impressionism, Photography invented"
- Can combine with other filters (culture, mood)

### 1.3 Mood-Based Discovery

**What:** Select a mood (calm, energized, melancholy, awestruck, romantic, rebellious) and the feed adapts.

**Why users love it:** Emotional entry points are more intuitive than academic categories. Spotify's mood playlists are among their most-played.

**Technical approach:**
- Phase 1: rule-based classification using color analysis + keyword matching
  - Extract dominant colors from artwork images (canvas k-means, cached per artwork)
  - Map color properties to moods: warm+bright=energized, cool+dark=melancholy, etc.
  - Keyword scan of description/labeltext for mood-associated terms
- Phase 2: LLM batch classification from descriptions for higher accuracy
- Store mood tags in a local mood-index (IndexedDB)
- UI: mood selector as a horizontal pill bar above the feed

### 1.4 "More Like This" — Visual Similarity

**What:** Button on any card that finds visually or thematically similar works across cultures and centuries.

**Why users love it:** Pinterest Lens proved "show me more like this" is the most powerful discovery gesture. Turns scrolling into active exploration.

**Technical approach:**
- V1 (attribute matching): query API with same `classification` + similar `century` range ± 100 years + similar `medium`. Exclude same artwork
- V2 (visual embeddings): TensorFlow.js MobileNet — compute 1024-dim embedding per viewed artwork, cache in IndexedDB, nearest-neighbor search via cosine similarity
- Display as a horizontal carousel or a dedicated "Similar" sub-feed

### 1.5 Deep Zoom — "Into the Brushstrokes"

**What:** Extreme magnification viewer showing individual brushstrokes, canvas texture, craquelure. Guided hotspots.

**Why users love it:** Cannot do this in a museum. Creates intimacy with the physical object.

**Technical approach:**
- Use Harvard API's high-resolution image URLs (already available via `primaryimageurl`)
- OpenSeadragon library for tile-based deep zoom with pinch/scroll/mouse-wheel controls
- Guided hotspots: overlay markers at notable coordinates with tooltip explanations
- For V1: hotspots generated by LLM analyzing the artwork ("notice the brushwork in the upper left")
- Lazy-load high-res tiles only when zoom is activated

### 1.6 Scale Reference — "How Big Is It Really?"

**What:** Overlay a human silhouette next to the artwork to convey actual physical scale.

**Why users love it:** Phone screens flatten everything to the same size. Restoring scale changes emotional impact completely.

**Technical approach:**
- Parse `dimensions` field (already in ArtPiece type) — extract height/width in cm
- Render SVG human figure (170cm reference) alongside artwork, scaled proportionally
- Toggle via a "📏 Scale" button on artwork detail page
- Handle edge cases: missing dimensions, very small objects (show hand for scale), very large (show room)

### 1.7 Color Palette Extractor

**What:** Extract dominant colors as swatches. Copy hex codes, save palettes, find artworks with similar palettes.

**Why users love it:** Designers, decorators, and artists seek color inspiration from fine art. Rijksmuseum's color search is most-used.

**Technical approach:**
- Canvas-based k-means clustering (k=5) on downsampled image pixel data
- Display as horizontal swatch strip below artwork
- Tap swatch → copy hex code to clipboard
- "Find similar palettes" → query API's `color` parameter or compare extracted palettes client-side
- Cache extracted palettes per artwork ID in localStorage

---

## Phase 2: AI + Deep Discovery

Features that add depth and intelligence to every artwork.

### 2.1 AI Art Narrator / Audio Guide

**What:** Tap a button, hear an AI-generated narration about the artwork. Multiple voices: casual, academic, poetic, kids.

**Why users love it:** Google Arts & Culture's audio guides are most-used. Transforms passive viewing into immersive learning.

**Technical approach:**
- Send artwork metadata (title, artist, culture, dated, medium, description) to Claude API
- System prompts per voice: casual ("imagine you're telling a friend"), academic ("art history lecture"), poetic ("lyrical meditation"), kids ("explain to a curious 8-year-old")
- Web Speech API for client-side TTS (free, decent quality)
- Premium: ElevenLabs API for natural voices
- Cache narration text per artwork ID + voice in IndexedDB
- UI: 🎧 button on artwork card → voice selector dropdown → play/pause controls

### 2.2 "Ask About This Art" — Conversational AI

**What:** Chat interface on any artwork for questions: "What technique?", "Why that color?", "What was happening when this was made?"

**Why users love it:** Museum docent in your pocket. Lowers intimidation for novices.

**Technical approach:**
- Chat panel slides up from bottom on artwork detail page
- LLM API call with system prompt containing artwork metadata as context
- Conversation history maintained per artwork session (not persisted)
- Rate limit: 10 questions per artwork per session
- Cache common Q&A pairs per artwork in IndexedDB for instant responses
- Suggested questions shown as chips: "Tell me about the technique", "What's the story behind this?"

### 2.3 Art Connections — Knowledge Graph

**What:** Interactive node graph showing connections: same artist → same movement → same gallery → same subject.

**Why users love it:** Wikipedia rabbit-hole effect for art. Makes relationships visible.

**Technical approach:**
- Build adjacency graph from artwork metadata: shared `people`, `culture`, `classification`, `gallery` = edges
- D3.js force-directed graph layout
- Center node = current artwork, surrounding nodes = connected artworks
- Node size = connection strength (more shared attributes = larger)
- Click any node → navigate to that artwork or expand its connections
- Limit graph to 2 degrees of separation to prevent overwhelm
- Render in a dedicated full-screen view accessible from artwork detail

### 2.4 "Art Across Cultures" — Parallel Traditions

**What:** Split-screen showing artworks from different cultures created simultaneously. Reveals cross-cultural parallels.

**Why users love it:** MIT MosAIc found these parallels create the strongest "aha moments." Challenges Western-centric narratives.

**Technical approach:**
- Query API for artworks within ±20 year range from different cultures
- Split-screen component: two mini ArtCards side by side
- Swipe either side to load next match from that culture
- Context bar between them: "1660s — While Vermeer painted interiors in Delft, Kano Tan'yū decorated castles in Kyoto"
- Curate a set of 20-30 particularly striking pairs as "featured parallels"

### 2.5 Artist Timeline — Career Evolution

**What:** All works by an artist on a horizontal timeline. Watch style evolve. Life events as annotations.

**Why users love it:** Transforms isolated images into a narrative arc. Only art has century-spanning creator histories.

**Technical approach:**
- Query API: `person=ArtistName` sorted by `datebegin`
- Horizontal scrollable timeline: artwork thumbnails positioned by date
- Click thumbnail → expand to full card or navigate to detail
- Biographical annotations from API's `people` endpoint or curated data
- "Jump to artist timeline" link on any artwork detail page where artist is known

### 2.6 Style DNA — Personal Taste Analysis

**What:** After 20+ likes, generate a taste profile: "73% overlap with Impressionists, drawn to warm palettes and figurative subjects."

**Why users love it:** Spotify Wrapped for art taste. People are fascinated by data about themselves.

**Technical approach:**
- Aggregate liked artwork attributes into distributions (culture %, century %, classification %, medium %)
- Compare against pre-defined "movement profiles" (lookup table: Impressionism = {culture: French 60%, century: 19th 90%, classification: Paintings 80%})
- Generate narrative text from analysis: top 3 traits, closest movement match, surprising outliers
- Render as a full-screen profile card with animated charts
- Shareable as generated image via Canvas API

---

## Phase 3: Engagement & Gamification

Keep users coming back daily.

### 3.1 Daily Streak & Art Calendar

**What:** Streak counter for consecutive days viewing art. Calendar with thumbnail previews.

**Why:** Duolingo's streak → 22% retention lift.

**Technical approach:**
- localStorage: `{ currentStreak, longestStreak, dates: { "2026-03-19": [artworkId, ...] } }`
- Streak logic: increment if `today === lastActiveDate + 1 day`, reset otherwise
- CSS grid calendar component showing 30 days with artwork thumbnail per active day
- Streak "freezes" earned at milestones (7-day, 30-day, 100-day)
- Subtle flame icon next to streak count in profile/header

### 3.2 Art Knowledge Quizzes

**What:** Short quizzes: "Which century?", "What culture?", "Same artist?" Difficulty scales.

**Why:** 30% more retention through gamified learning.

**Technical approach:**
- Auto-generate from metadata: pick correct answer, sample 3 wrong answers from same facet
- Question types: century, culture, classification, artist, "which is older?", "odd one out"
- Difficulty tiers: Easy (2 choices, popular categories), Medium (4 choices), Hard (4 choices, rare categories)
- Track: correct count, streak, per-category accuracy
- Store in localStorage. Render as a modal quiz card with progress bar

### 3.3 Collector Badges & Achievements

**What:** "Renaissance Explorer," "World Traveler," "Century Hopper," "Pottery Enthusiast."

**Why:** Achievement systems create goals and guide exploration.

**Technical approach:**
- Badge definitions as a typed config array: `{ id, name, description, icon, criteria: (likedArt) => boolean }`
- Example criteria: `likedArt.filter(a => a.culture === 'French').length >= 10`
- Check on every like event. Toast notification on unlock
- Profile/achievements page with unlocked (color) and locked (greyed) badges
- CSS-animated SVG badge icons

### 3.4 "Art Roulette" — Preference Game

**What:** Two artworks, pick one. After 20 rounds, reveal taste patterns.

**Why:** Tinder's binary choice = addictive. Personality reveal = shareable.

**Technical approach:**
- Fetch 40 artworks with contrasting attributes (different cultures × different centuries × different classifications)
- Display pairs side-by-side, tap to choose
- Track: chosen attributes vs. rejected attributes across all rounds
- Analyze: "You chose warm palettes 80% of the time. Portraits over landscapes 70%."
- Generate shareable result card via Canvas API
- Feed results back into preference engine

### 3.5 "ArtTok Wrapped"

**What:** Personalized recap: total viewed, favorite century, rarest find, taste evolution. Animated story cards.

**Why:** Spotify Wrapped → 500M+ shares in 24 hours.

**Technical approach:**
- Aggregate all interaction data over period (month/quarter/year)
- Statistics: total viewed, total liked, most-viewed culture, rarest artwork (lowest objectcount), favorite century, most active day, longest streak
- Superlatives: "Your rarest find was seen by only 12 people this year"
- Render as 8-10 full-screen animated cards (Instagram Stories format)
- CSS keyframe animations for reveals, counters, transitions
- Share button: Canvas API → image → Web Share API

### 3.6 Weekly Art Challenge

**What:** Weekly theme + community voting on submissions.

**Why:** Creates urgency, creativity, and community.

**Technical approach:**
- Requires backend (Supabase/Firebase)
- Challenge model: `{ id, theme, description, startDate, endDate }`
- Submission: `{ challengeId, userId, artworkIds[], caption }`
- Voting: one per user per submission. Leaderboard sorted by votes
- Display: dedicated `/challenges` page with current + past challenges

### 3.7 "Story Cards" — Shareable Art Stories ⭐

**What:** One-tap generate a beautifully designed, Instagram Story-sized (1080×1920) image card from any artwork. Not just the raw image — a *designed* card with artwork, metadata, taste context, and subtle ArtTok branding. Every share = free organic marketing.

**Why users love it:** The card is genuinely beautiful — people share it because it makes *them* look cultured, not because they're promoting an app. "Discovered on ArtTok" creates curiosity. Works on Instagram, WhatsApp, Snapchat, X, iMessage — anywhere images are shared.

**Templates:**

| Template | Layout | Best For |
|---|---|---|
| **Cinematic** | Full-bleed artwork, serif title + artist at bottom, dark gradient, ArtTok watermark | Default, matches app aesthetic |
| **Museum Label** | Artwork centered with dark matte border, classic museum-style label, "Discovered on ArtTok" footer | Educational, classy |
| **Color Story** | Artwork top half, extracted palette swatches + hex codes below, "via ArtTok" | Designers, Pinterest crowd |
| **Did You Know?** | Artwork with AI-generated one-line fun fact overlaid + branding | Engagement bait, high share potential |
| **Taste Card** | Small artwork + Style DNA stats ("73% Impressionist"), "Find your style on ArtTok" | Personality-test shareability |
| **Versus** | Split card from Art Roulette: "I chose this over this — what would you pick?" + link | Interactive, drives replies |
| **Streak** | Flame + streak count + week's artwork thumbnails, "Day 47 of discovering art" | Duolingo-style flex |

**Technical approach:**
- Canvas API renders card at 1080×1920 (IG Story native resolution)
- Template engine: each template is a render function drawing to canvas (artwork, text overlays, gradients, branding)
- Per-artwork accent color (from `art.id % 360`) tints the card design
- Color palette extraction reused from the palette extractor feature (Phase 1.7)
- Download via `<a download>` or share via Web Share API (native share sheet → Instagram Stories on mobile)
- Optional QR code in corner that deep-links to the artwork in ArtTok (user can toggle off)
- Branding: subtle "ArtTok" logotype, bottom corner — never obnoxious
- Cross-cutting: amplifies Streaks, Style DNA, Art Roulette, Color Palette, AI fun facts — each feature becomes a new template

### 3.8 "Surprise Me" / Serendipity Mode

**What:** Toggle that breaks the algorithm. Shows artworks outside usual taste.

**Why:** DailyArt's core hook. Combats filter bubbles.

**Technical approach:**
- Invert preference vector: boost lowest-scored attributes, suppress highest
- Or: `sort=random` with exclusion filters for user's top 3 cultures/classifications
- Toggle in feed header. Distinct visual treatment (different accent color, "🎲 Surprise" badge)

---

## Phase 4: Social & Community

Network effects and sharing.

### 4.1 Art Collections / Boards

**What:** Named, themed collections. Shareable via link.

**Why:** Pinterest's core value. Creative ownership without creating content.

**Technical approach:**
- Extend storage: `collections: { [id]: { name, description, artworkIds[], coverArtId, createdAt } }`
- localStorage initially → backend migration path
- "Add to collection" action on every artwork card (long-press or dedicated button)
- Collection browser page: grid of collection covers
- Share: encode collection as URL parameter or generate shareable link

### 4.2 "Art Taste Match"

**What:** Compare preferences with a friend. Compatibility %, overlap highlights.

**Why:** Spotify comparison → 500M+ shares.

**Technical approach:**
- Export taste vector as base64-encoded URL parameter
- Share link → friend opens → their vector compared via cosine similarity
- Display: match %, Venn diagram of overlapping cultures/centuries, "You agree on X, disagree on Y"
- No backend needed — stateless comparison via URL

### 4.3 "Art Critic" Micro-Reviews

**What:** 280-char reactions with structured prompts on artwork detail pages.

**Why:** Structured prompts lower the barrier. Comments create community.

**Technical approach:**
- Backend required (Supabase/Firebase)
- Schema: `{ artworkId, oduserId, text, promptType, createdAt, upvotes }`
- Prompt types: "This makes me feel ___", "I see ___", "This reminds me of ___"
- Display as cards on artwork detail, sorted by upvotes then recency
- Moderation: basic profanity filter + report button

### 4.4 "Art of the Day" Community Vote

**What:** 4 nominees daily. Community votes. Winner featured for 24 hours.

**Why:** DailyArt's #1 retention hook + participatory voting.

**Technical approach:**
- Backend selects 4 diverse artworks daily (different cultures, centuries)
- Vote endpoint with rate limiting (1 vote per user per day)
- Winner announced at fixed time, displayed as feed banner
- Archive of past winners as a curated collection

### 4.5 Collaborative Collections

**What:** Shared collections with multiple curators.

**Why:** Spotify collaborative playlists = stickiest feature.

**Technical approach:**
- Extend collection model: `collaborators: string[]`, `isCollaborative: boolean`
- Invite via shareable link
- Real-time sync via Supabase Realtime or Firebase Realtime Database
- Conflict resolution: append-only (additions always succeed, removals require owner)

### 4.6 "Art Gifts" — Shareable Art Cards

**What:** Personalized art greeting cards with custom message, animated reveal.

**Why:** Shareable content = growth engine. Each card = potential new user.

**Technical approach:**
- Card builder: select artwork → add message → choose frame/style
- Render via Canvas API or html2canvas as image
- Share via Web Share API (native share sheet) or download
- Deep link back to artwork in app for recipient
- ArtTok branding watermark (subtle, bottom corner)

---

## Phase 5: Quality of Life & Polish

### 5.1 Quiet Mode

**What:** Hide all UI chrome. Just artwork. Tap to toggle back.

**Technical:** CSS class toggling `opacity: 0` + `pointer-events: none` on overlays. Auto-hide after 5s inactivity.

### 5.2 Adjustable Information Density

**What:** Slider from "Just Vibes" (image only) to "Tell Me Everything" (full metadata).

**Technical:** CSS classes showing/hiding sections per level (1-5). Stored in localStorage.

### 5.3 Artwork as Wallpaper ⭐ (User Priority)

**What:** One-tap download any artwork sized for device. Daily auto-rotate from liked collection.

**Technical approach:**
- Detect device screen dimensions via `window.screen.width/height` and `devicePixelRatio`
- Canvas API: draw artwork scaled/cropped to fill device resolution
- Offer crop options: fill (crop to fit), fit (letterbox with dark bars), extend (AI outpaint edges — Phase 2+ feature)
- Download via programmatic anchor click with `download` attribute
- "Auto-wallpaper" mode: Service Worker picks a random liked artwork daily, generates device-sized image, shows notification "Your new wallpaper is ready"
- Wallpaper history page showing past generated wallpapers

### 5.4 Colorblind Mode

**What:** Text color descriptions + CVD simulation views.

**Technical:** Canvas color extraction → named color mapping. Brettel algorithm as canvas filters.

### 5.5 Text Size & High Contrast

**What:** Dedicated scaling controls + WCAG AAA high contrast mode.

**Technical:** CSS custom property `--base-font-size` with multiplier. High contrast overrides color variables.

### 5.6 Museum Visit Planner

**What:** Show nearby museums with liked artworks. Generate visit itineraries.

**Technical:** Harvard API `gallery` field + Geolocation API. Group by museum/floor. Link to maps.

---

## Phase 6: Content Expansion (Future — Beyond Classic Art)

Long-term vision: ArtTok becomes "CultureTok" — a unified culture discovery platform.

Each content vertical uses the same core engine (snap-scroll, like/collect, preference engine, AI enrichment) with a different API adapter.

### 6.1 Photography Archives (First Expansion)

**Sources:** Library of Congress (millions of historical photos), NASA (space imagery), Unsplash API
**Why first:** Same visual UX, massive free archives, validates multi-content model
**Adaptation:** Card layout identical. Metadata fields differ (photographer, date, location vs. artist, culture, medium)

### 6.2 Architecture & Design

**Sources:** Archidaily, museum architectural drawing collections, Wikimedia Commons
**Why compelling:** Buildings are as visually striking as paintings. Time Travel slider shows cities evolve
**Adaptation:** Add location/map integration. Deep zoom for blueprints and detail

### 6.3 Fashion History

**Sources:** Met Costume Institute, V&A fashion collection APIs
**Why compelling:** #fashionhistory has 2B+ TikTok views. Huge existing audience
**Adaptation:** "Across Cultures" → "What people wore simultaneously around the world"

### 6.4 Natural History & Specimens

**Sources:** Smithsonian Open Access (millions of specimen images — butterflies, minerals, fossils, botanical illustrations)
**Why compelling:** Scientifically accurate AND beautiful. Color palette extractor → "nature's palette"
**Adaptation:** Scientific taxonomy as category system instead of art classification

### 6.5 Maps & Cartography

**Sources:** David Rumsey Map Collection (150K+), Library of Congress maps
**Why compelling:** Old maps are endlessly fascinating. Deep zoom is a killer feature here
**Adaptation:** Geospatial browsing. "Explore maps of your city through the centuries"

### 6.6 Music Discovery

**Sources:** Spotify API, SoundCloud API
**Why compelling:** Card = album art + 30-second preview. Preference engine transfers directly
**Adaptation:** Audio playback integration. "Across Cultures" → "Same year, different genre"

### 6.7 Poetry & Literature

**Sources:** Project Gutenberg, Poetry Foundation (public domain)
**Why compelling:** Beautifully typeset excerpts. Audio narration is natural. Mood discovery maps perfectly
**Adaptation:** Card = typeset text over generated background instead of image

### 6.8 Street Art & Murals

**Sources:** Community submissions, Google Street View API
**Why compelling:** Ephemeral — street art gets painted over. "Before it's gone" urgency. Geolocation-native
**Adaptation:** Museum planner → street art walking tour. User-contributed content

### 6.9 Culinary Arts

**Sources:** Recipe APIs, community submissions
**Why compelling:** Food plating is genuinely an art form. Color palette shows plate composition
**Adaptation:** Scale reference → portion size. "More Like This" → similar cuisines

---

## Implementation Timeline

| Phase | Focus | Estimated Effort | Key Deliverables |
|---|---|---|---|
| **0** | Foundation | 2-3 weeks | Multi-source APIs, preference engine, PWA, cleanup |
| **1** | Core Discovery | 3-4 weeks | For You feed, Time Travel, Mood, Scale, Color, Deep Zoom |
| **2** | AI + Deep Discovery | 3-4 weeks | Narrator, Ask AI, Connections graph, Parallel Traditions, Artist Timeline, Style DNA |
| **3** | Engagement | 3-4 weeks | Streaks, Quizzes, Badges, Roulette, Wrapped, Challenges, Story Cards, Surprise Me |
| **4** | Social | 3-4 weeks | Collections, Taste Match, Reviews, Art of Day, Collaborative, Art Gifts |
| **5** | Polish | 2 weeks | Quiet Mode, Info Density, Wallpaper, Accessibility, Museum Planner |
| **6** | Content Expansion | Ongoing | Photography first, then Architecture, Fashion, Natural History, Maps |

---

## Architecture Principles

- **Client-first:** Preference engine, color extraction, mood classification all run in-browser. No backend required until Phase 4
- **Progressive enhancement:** Each feature works independently. No feature depends on another being complete
- **Adapter pattern:** Every data source implements `ArtSource` interface → easy to add new content verticals
- **Cache aggressively:** IndexedDB for artwork metadata, image embeddings, AI narrations, color palettes. Minimize repeat API calls
- **Offline-capable:** PWA with Service Worker. Core browse/like/collect works without network
- **Accessible:** Every feature respects `prefers-reduced-motion`, supports keyboard navigation, includes ARIA labels. Colorblind mode and high contrast are first-class

---

## References

- [MIT MosAIc — Cross-cultural art connections](https://news.mit.edu/2020/algorithm-finds-hidden-connections-between-paintings-met-museum-0729)
- [Google Arts & Culture AI features](https://blog.google/outreach-initiatives/arts-culture/)
- [Spotify Wrapped — 200M engaged users](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/)
- [TikTok Algorithm 2025 — Hootsuite](https://blog.hootsuite.com/tiktok-algorithm/)
- [Duolingo gamification — 22% retention lift](https://www.gianty.com/gamification-boost-user-engagement-in-2025/)
- [Pinterest Visual Search / Lens](https://www.tailwindapp.com/blog/pinterest-lens)
- [DailyArt — 1M+ users via daily art](https://www.getdailyart.com/)
- [Rijksmuseum color-based search](https://www.rijksmuseum.nl/)
