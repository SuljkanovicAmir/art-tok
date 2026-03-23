# Claude Code Configuration — ArtTok (RuFlo V3)

## Behavioral Rules (Always Enforced)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- **AFTER every feature or significant change:** create a doc in `/docs/` (named `YYYY-MM-DD-<feature>.md`) summarising what was built, files changed, and any new patterns — then update `memory/MEMORY.md` and the relevant memory files to reflect the new state
- NEVER save working files, text/mds, or tests to the root folder
- Never continuously check status after spawning a swarm — wait for results
- Never add Co-Authored-By credits in commit messages — clear descriptive messages only
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## File Organization

- NEVER save to root folder — use the directories below
- `/src` — source code
- `/src/components` — reusable UI components
- `/src/pages` — route-level page components
- `/src/hooks` — custom React hooks
- `/src/services` — API service classes
- `/src/stores` — MobX stores
- `/src/types` — TypeScript interfaces
- `/src/utils` — utility functions
- `/tests` — test files
- `/docs` — documentation and feature plans
- `/config` — configuration files
- `/scripts` — utility scripts

## ArtTok App Architecture

**App:** TikTok-style vertical scroll feed for museum art — dark cinematic aesthetic

### Stack

- Vite 6, React 19, TypeScript 5
- MobX 6 for state management
- Plain CSS (no framework) — dark theme, custom properties
- Harvard Art Museums API (primary data source)

### Routes (planned)

- `/` — main vertical scroll feed
- `/artwork/:id` — artwork detail page
- `/search` — search by keyword, artist, culture
- `/liked` — liked art collection
- `/categories` — browse by culture, classification, century

### Key Components

- `ArtCard.tsx` — full-viewport artwork card with like, share, expand actions
- `LikedArtPanel.tsx` — slide-out panel for liked art collection
- `FeedPage.tsx` — infinite scroll feed with snap scrolling

### Data Sources

- **Harvard Art Museums API** — `https://api.harvardartmuseums.org/object`
- **Met Museum API** (planned) — `https://collectionapi.metmuseum.org/public/collection/v1`
- **Art Institute of Chicago API** (planned) — `https://api.artic.edu/api/v1`

### Styling Rules

- All styles in `src/App.css` — single file, BEM-like naming (`art-card__title`, `liked-panel__header`)
- CSS custom properties for theming (`--art-card-accent`, `--feed-header-height`)
- Per-artwork accent color generated from `art.id` hue
- Dark background: `#050505`, text: `#f5f5f5`
- Responsive: desktop (768px+), mobile (540px-), ultra-mobile (<540px)
- `scroll-snap-type: y mandatory` for TikTok-style vertical scroll
- `prefers-reduced-motion` respected — all animations disabled

### Environment Variables

- `VITE_HARVARD_API_KEY` — Harvard Art Museums API key (NEVER hardcode)

## Build & Test

```bash
# Dev server
npm run dev

# Lint
npm run lint

# Build
tsc -b && vite build

# Preview production build
npm run preview

# Tests (when added)
npm run test
```

- ALWAYS run `npm run lint` after making code changes
- Run `npm run build` before committing to verify build succeeds

## Security Rules

- NEVER hardcode API keys in source files — use `import.meta.env.VITE_*`
- NEVER commit .env files or any file containing secrets
- Always validate API responses before rendering
- Always validate user input at system boundaries
- Run `npx @claude-flow/cli@latest security scan` after security-related changes

## Project Architecture (RuFlo/Swarm)

- Follow Domain-Driven Design with bounded contexts
- Keep files under 500 lines
- Use typed interfaces for all public APIs
- Prefer TDD London School (mock-first) for new code
- Use event sourcing for state changes
- Ensure input validation at system boundaries

### Project Config

- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- Use Claude Code's Task tool for spawning agents, not just MCP
- ALWAYS batch ALL todos in ONE TodoWrite call (5-10+ minimum)
- ALWAYS spawn ALL agents in ONE message with full instructions via Task tool
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration

- MUST initialize the swarm using CLI tools when starting complex tasks
- MUST spawn concurrent agents using Claude Code's Task tool
- Never use CLI tools alone for execution — Task tool agents do the actual work
- MUST call CLI tools AND Task tool in ONE message for complex work

### 3-Tier Model Routing (ADR-026)

| Tier | Handler | Latency | Cost | Use Cases |
|------|---------|---------|------|-----------|
| **1** | Agent Booster (WASM) | <1ms | $0 | Simple transforms (var→const, add types) — Skip LLM |
| **2** | Haiku | ~500ms | $0.0002 | Simple tasks, low complexity (<30%) |
| **3** | Sonnet/Opus | 2-5s | $0.003-0.015 | Complex reasoning, architecture, security (>30%) |

- Always check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` before spawning agents
- Use Edit tool directly when `[AGENT_BOOSTER_AVAILABLE]`

## Swarm Configuration & Anti-Drift

- ALWAYS use hierarchical topology for coding swarms
- Keep maxAgents at 6-8 for tight coordination
- Use specialized strategy for clear role boundaries
- Use `raft` consensus for hive-mind (leader maintains authoritative state)
- Run frequent checkpoints via `post-task` hooks
- Keep shared memory namespace for all agents

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

## Swarm Execution Rules

- ALWAYS use `run_in_background: true` for all agent Task calls
- ALWAYS put ALL agent Task calls in ONE message for parallel execution
- After spawning, STOP — do NOT add more tool calls or check status
- Never poll TaskOutput or check swarm status — trust agents to return
- When agent results arrive, review ALL results before proceeding

## Session Start Protocol (MANDATORY at the start of EVERY new session)

At the start of each session, query stored project patterns before reading files:

```bash
# Pull accumulated project patterns — use these before searching code
npx @claude-flow/cli@latest memory search --query "arttok project patterns" --namespace arttok-patterns --limit 20 2>/dev/null || true
```

Use the returned patterns to answer questions or orient yourself. Only fall back to reading files if the memory doesn't cover what you need.

## Pre-Task Protocol (MANDATORY before EVERY task)

Before starting any coding task, ALWAYS run the following to begin SONA trajectory recording:

```bash
# Start SONA trajectory — feeds the intelligence learning system
npx @claude-flow/cli@latest hooks pre-task --session-id "$SESSION_ID" --task "<brief task description>" 2>/dev/null || true
```

## Post-Task Protocol (MANDATORY after EVERY task)

After completing any coding task, ALWAYS run the following in a single Bash call:

```bash
# 1. Verify code quality
npm run lint && tsc -b

# 2. End SONA trajectory — records the full pre→post arc for learning
npx @claude-flow/cli@latest hooks post-task --session-id "$SESSION_ID" 2>/dev/null || true

# 3. Store ONE pattern from this task — use a descriptive key, never a timestamp
# Key format: <topic>-<subtopic> e.g. "harvard-api-pagination", "css-scroll-snap", "mobx-store"
# Value: the non-obvious decision, gotcha, or constraint — 1-3 sentences max
# SKIP if: the pattern is obvious from reading the code, or already in CLAUDE.md
npx @claude-flow/cli@latest memory store \
  --key "<descriptive-kebab-case-key>" \
  --value "<non-obvious decision, gotcha, or constraint learned from this task>" \
  --namespace "arttok-patterns" 2>/dev/null || true

# 4. Run neural optimization
npx @claude-flow/cli@latest neural optimize --background 2>/dev/null || true
```

Rules:
- `|| true` ensures ruFlo CLI failures never block the task
- ALWAYS run `hooks pre-task` at the start and `hooks post-task` at the end — this is how SONA learns — NO EXCEPTIONS, even for small tasks
- Store patterns that are non-obvious or project-specific (NOT things derivable from code)
- Namespace all project patterns under `arttok-patterns`
- Run lint/build FIRST — fix any errors before storing patterns
- If pre-task was skipped at session start, run post-task hooks retroactively at end of task — never skip entirely

## V3 CLI Commands

### Core Commands

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `init` | 4 | Project initialization |
| `agent` | 8 | Agent lifecycle management |
| `swarm` | 6 | Multi-agent swarm coordination |
| `memory` | 11 | AgentDB memory with HNSW search |
| `task` | 6 | Task creation and lifecycle |
| `session` | 7 | Session state management |
| `hooks` | 17 | Self-learning hooks + 12 workers |
| `hive-mind` | 6 | Byzantine fault-tolerant consensus |

### Quick CLI Examples

```bash
npx @claude-flow/cli@latest init --wizard
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder
npx @claude-flow/cli@latest swarm init --v3-mode
npx @claude-flow/cli@latest memory search --query "art feed patterns"
npx @claude-flow/cli@latest doctor --fix
```

## Available Agents (60+ Types)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Specialized
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`

### GitHub & Repository
`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`

## Memory Commands Reference

```bash
# Store (REQUIRED: --key, --value; OPTIONAL: --namespace, --ttl, --tags)
npx @claude-flow/cli@latest memory store --key "pattern-feed" --value "scroll snap needs scroll-snap-stop: always for single-card advance" --namespace arttok-patterns

# Search (REQUIRED: --query; OPTIONAL: --namespace, --limit, --threshold)
npx @claude-flow/cli@latest memory search --query "art feed patterns"

# List (OPTIONAL: --namespace, --limit)
npx @claude-flow/cli@latest memory list --namespace arttok-patterns --limit 10

# Retrieve (REQUIRED: --key; OPTIONAL: --namespace)
npx @claude-flow/cli@latest memory retrieve --key "pattern-feed" --namespace arttok-patterns
```

## Quick Setup

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

## Claude Code vs CLI Tools

- Claude Code's Task tool handles ALL execution: agents, file ops, code generation, git
- CLI tools handle coordination via Bash: swarm init, memory, hooks, routing
- NEVER use CLI tools as a substitute for Task tool agents

## Computation & Quality Rules

- Maximize parallelism: run all independent operations concurrently in a single message
- Use background agents (`run_in_background: true`) for independent tasks whenever possible
- Batch all file reads, edits, and Bash commands that don't depend on each other
- Minimize token usage: be concise in prompts, responses, and agent instructions — no padding, no repetition
- Prefer short targeted reads (with offset/limit) over reading entire large files when only a section is needed
- Quality must never be sacrificed for token savings — no cutoffs, no partial implementations
- Every feature must be fully implemented end-to-end: types → functions → components → wiring → check → commit
- Never leave a task half-done; if blocked, report the blocker instead of shipping incomplete work

## Code Quality

- Typed interfaces for all data models (in `src/types/`)
- Props interfaces co-located with components
- Modern async/await — no .then() chains
- Keep files under 500 lines
- BEM-like CSS naming convention
- Accessibility: proper ARIA labels, keyboard navigation, focus management

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
