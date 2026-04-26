# NextSMS — AI Agent Instructions

## Project Overview

NextSMS is a **NSMS (Next Soccer Management Simulator)** — a fantasy soccer league simulation engine. It provides team management, roster generation, fixture scheduling, match simulation with live commentary, and league table tracking. Built with **vinext** (Vite-based Next.js reimplementation) targeting **Cloudflare Workers** deployment with **D1** as the database.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | vinext (Next.js API on Vite) |
| React | 19.2.5 with RSC |
| Database | Cloudflare D1 (SQLite) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`, no config file) |
| Language | TypeScript (strict mode, ES2024 target) |
| Linting | ESLint 9 flat config (`next/core-web-vitals`, `next/typescript`) |
| Deployment | Cloudflare Workers via `vinext deploy` |
| Package Manager | pnpm |

## Commands

```bash
pnpm dev          # Start dev server (vinext dev, port 3000)
pnpm build        # Production build
pnpm start        # Production server
pnpm lint         # Lint via vinext
pnpm deploy       # Build and deploy to Cloudflare Workers
pnpm cf-typegen   # Regenerate CloudflareEnv types into cloudflare-env.d.ts
```

## Architecture

```
src/
  app/
    layout.tsx                    # Root layout (Geist fonts, metadata)
    page.tsx                      # Dashboard — links to sections + seed DB button (client)
    globals.css                   # Tailwind imports + CSS custom properties
    teams/page.tsx                # Team list, roster viewer, create/delete teams
    teams/[id]/                   # Placeholder — no page file yet
    league/page.tsx               # League standings table
    fixtures/page.tsx             # Fixture generation and display by week
    matches/page.tsx              # Match history list with links to details
    matches/[id]/page.tsx         # Match detail — scoreline, commentary, events
    simulate/page.tsx             # Match simulation form with live results
    api/
      teams/route.ts              # GET list, POST create team + auto roster
      teams/[id]/route.ts         # GET team+players, DELETE team
      league/route.ts             # GET league table (auto-inits if empty)
      fixtures/route.ts           # GET fixtures, POST generate season fixtures
      matches/route.ts            # GET matches, POST create/simulate match
      matches/[id]/route.ts       # GET single match
      rosters/route.ts            # POST generate roster for a team
      season/route.ts             # POST advance_week, recover_fitness, decrease_injuries, decrease_suspensions
      seed/route.ts               # POST seed DB with 3 sample teams (APE, KLM, UVA)
      simulate/route.ts           # POST quick simulate between two teams
      teamsheets/route.ts         # POST generate teamsheet for a formation
  components/
    nav.tsx                       # Client component — navigation bar with active link
  lib/
    types.ts                      # All TypeScript interfaces + DEFAULT_CONFIG
    db.ts                         # D1 database query functions (CRUD for all tables)
    env.ts                        # getEnv() — reads Cloudflare bindings from globalThis
    config.ts                     # Config file parsing, league table sort/update
    random.ts                     # Mersenne Twister PRNG + helpers
    simulator.ts                  # Core match simulation engine (~1100 lines)
    tactics.ts                    # Tactic multiplier matrix loading/querying
    commentary.ts                 # Commentary text loading with template substitution
    conditionals.ts               # Conditional instruction parsing/evaluation
    fixtures.ts                   # Round-robin fixture generation (home & away)
    roster-creator.ts             # Random player/roster generation
    teamsheet-creator.ts          # Formation parsing, position selection, lineup output
    updater.ts                    # Post-match: ability changes, fitness, injury/suspension
worker/
  index.ts                        # Worker entry — stores env on globalThis, image optimization
migrations/
  0001_initial.sql                # Schema: teams, players, matches, fixtures, league_table, league_config
public/                           # Static assets (SVGs, _headers)
```

### Key Patterns

- Path alias: `@/*` maps to `./src/*`
- All `next/*` imports resolve via vinext shims — never rewrite them to `vinext/*`
- `next.config.ts` is read by vinext for redirects, rewrites, headers, basePath, i18n, images, and env config
- All API routes use `export const runtime = 'edge'`
- Pages use `"use client"` — including the home page
- Cloudflare env access: `getEnv()` from `@/lib/env` reads `globalThis.__cloudflareEnv` (set by `worker/index.ts`)

## Database Schema (D1)

6 tables defined in `migrations/0001_initial.sql`:

| Table | Key Columns |
|-------|------------|
| `teams` | id, name (UNIQUE), abbreviation (UNIQUE) |
| `players` | id, team_id (FK), name, age, nationality, pref_side, skills (st/tk/ps/sh/sm/ag), abilities (st_ab/tk_ab/ps_ab/sh_ab), stats (games/saves/tackles/goals/assists/etc), dp, injury, suspension, fitness |
| `matches` | id, home/away team FKs, scores, status, tactics, commentary, events, lineups, conditionals, played_at |
| `fixtures` | id, season, week, home/away team FKs, match_id (FK) — UNIQUE(season, week, home, away) |
| `league_table` | id, team_id (FK), season, played/won/drawn/lost, goals_for/against/difference, points |
| `league_config` | key (PK), value — stores simulation parameters |

## Code Conventions

- **Components**: React function components with typed props. Use `export default` for page/layout components.
- **Styling**: Tailwind CSS v4 utility classes. CSS custom properties for theme tokens in `globals.css`. Use `@theme inline` block for Tailwind theme extensions. No `tailwind.config.ts` — config is CSS-based.
- **Fonts**: `next/font/google` loads from CDN in vinext (not self-hosted).
- **Images**: `next/image` uses `@unpic/react` under the hood — no local build-time optimization.
- **TypeScript**: Strict mode. Bundler module resolution. No `noEmit`.
- **File naming**: kebab-case for files, PascalCase for components.
- **ESM**: Project uses `"type": "module"`. Config files use `.mjs` or `.ts` — never CommonJS `module.exports`.

## Cloudflare Bindings

Bindings are typed in `cloudflare-env.d.ts` (auto-generated by `pnpm cf-typegen`). Current bindings:

- `DB` — D1Database (SQLite)
- `ASSETS` — Fetcher (static assets)
- `IMAGES` — ImagesBinding (image optimization)
- `NEXTJS_ENV` — string

Access bindings via `getEnv()` from `@/lib/env`, which reads `globalThis.__cloudflareEnv` set by `worker/index.ts`.

## Important Notes

- **Do not** install `next` as a dependency — vinext provides the Next.js API surface
- **Do not** use webpack/Turbopack config — use Vite plugins in `vite.config.ts`
- **Do not** rewrite `next/*` imports in application code
- The `eslint.config.mjs` already uses the ESM-compatible `__dirname` pattern with `fileURLToPath`
- Environment secrets go in `.dev.vars` (local) or Cloudflare dashboard (production) — never commit secrets
- `src/app/teams/[id]/` is a placeholder directory with no page file yet

## Version Management

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0/): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (schema migration required, API contract change)
- **MINOR** — new features (new page, new API endpoint, new simulation feature)
- **PATCH** — bug fixes, small tweaks, non-breaking improvements

The current version is in `package.json` (`"version"` field). When making changes that are feature-worthy or user-facing, bump the version:

```bash
# Patch release (bug fix)
pnpm version patch --no-git-tag-version

# Minor release (new feature)
pnpm version minor --no-git-tag-version

# Major release (breaking change)
pnpm version major --no-git-tag-version
```

Use `--no-git-tag-version` to avoid auto-creating git tags (tags are created when deploying).

## Changelog

All notable changes are recorded in `CHANGELOG.md` at the project root, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

### Changelog Conventions

- Maintain an `## [Unreleased]` section at the top for work-in-progress changes
- When releasing, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`
- Use these subsections: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Deprecated`, `### Security`
- Each entry should be a concise, user-facing description (not implementation details)
- When adding a feature or fixing a bug, add an entry to the `## [Unreleased]` section

### Example Entry

```markdown
## [Unreleased]

### Added

- Player transfer system between teams

### Fixed

- Correct league table sorting when points are equal
```

## After Making Changes

Always run after editing code:

```bash
pnpm lint
pnpm build
```

When adding features or fixing bugs, also update `CHANGELOG.md` under `## [Unreleased]`.
