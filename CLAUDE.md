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

## Stack

- `VITE_HARVARD_API_KEY` — NEVER hardcode

## Git (Gitflow)

- `main` → production (GitHub Pages). `develop` → integration. `feature/`/`fix/`/`chore/` → off develop.
- NEVER push directly to `main` or `develop` — always use PRs

## Build

- `npm run lint` — ALWAYS run after changes
- `tsc -b && vite build` — run before committing

## Code Quality

- Typed interfaces for all data models (in `src/types/`)
- Props interfaces co-located with components
- async/await only — no .then() chains
- Keep files under 500 lines
- Accessibility: ARIA labels, keyboard navigation, focus management

## Gotchas

- AIC API returns 403 intermittently — always retry with fallback source
- Met API is two-step: search returns IDs, then batch-fetch objects
- All styles in single `src/App.css` — search there first, not per-component
- `src/stores/` exists but is legacy (MobX) — not imported anywhere
- Instagram poster details (CLI, env vars, Reels gotchas) live in `scripts/instagram-poster/CLAUDE.md`

## Concurrency

- Maximize parallelism: batch independent file reads, edits, bash commands in ONE message
- Use background agents for independent tasks
- Prefer targeted reads (offset/limit) over reading entire large files
- Quality over token savings — no cutoffs, no partial implementations
