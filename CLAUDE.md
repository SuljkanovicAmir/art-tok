# Claude Code Configuration — ArtTok

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER proactively create documentation files unless explicitly requested
- **AFTER every feature:** create a doc in `/docs/` (named `YYYY-MM-DD-<feature>.md`) and update `memory/MEMORY.md`
- NEVER save working files to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- Never add Co-Authored-By credits in commit messages

## File Organization

- `/src` — source (`/components`, `/pages`, `/hooks`, `/services`, `/stores`, `/types`, `/utils`)
- `/tests` — test files
- `/docs` — documentation and feature plans
- `/scripts` — utility scripts (including `instagram-poster/`)

## Stack

- Vite 6, React 19, TypeScript 5, @tanstack/react-query 5
- Plain CSS — liquid glass design system, dark theme (#050505), BEM-like naming
- 3 Art APIs: Harvard (API key), Met Museum (no key), Art Institute of Chicago (no key)
- `VITE_HARVARD_API_KEY` — NEVER hardcode

## Routes

- `/` — feed, `/artwork/:source/:id` — detail, `/search`, `/liked`, `/categories`, `/categories/:facet/:value`

## Git (Gitflow)

- `main` → production (GitHub Pages). `develop` → integration. `feature/`/`fix/`/`chore/` → off develop.
- NEVER push directly to `main` or `develop` — always use PRs

## Build

```bash
npm install           # Install dependencies
npm run dev           # Dev server
npm run lint          # Lint (ALWAYS run after changes)
tsc -b && vite build  # Build (run before committing)
```

## Instagram Poster

```bash
cd scripts/instagram-poster && npm install  # First time only
node post.mjs --dry-run          # Test post (renders card, prints caption)
node post.mjs --reel --dry-run   # Test reel (generates .mp4, needs ffmpeg)
```

- Requires `.env` with `IG_USER_ID`, `IG_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`
- GitHub Actions runs 4x/day — see `.github/workflows/instagram-post.yml`

## Code Quality

- Typed interfaces for all data models (in `src/types/`)
- Props interfaces co-located with components
- async/await only — no .then() chains
- Keep files under 500 lines
- Accessibility: ARIA labels, keyboard navigation, focus management

## Gotchas

- AIC API returns 403 intermittently — always retry with fallback source
- Met API is two-step: search returns IDs, then batch-fetch objects
- `alt_text_custom` is FORBIDDEN on Instagram Reels — causes API error
- All styles in single `src/App.css` — search there first, not per-component
- `src/stores/` exists but is legacy (MobX) — not imported anywhere

## Concurrency

- Maximize parallelism: batch independent file reads, edits, bash commands in ONE message
- Use background agents for independent tasks
- Prefer targeted reads (offset/limit) over reading entire large files
- Quality over token savings — no cutoffs, no partial implementations
