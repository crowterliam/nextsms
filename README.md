# NextSMS

**Next Soccer Management Simulator (NSMS)** — a fantasy soccer league simulation engine built with vinext and Cloudflare Workers.

Team management, roster generation, fixture scheduling, match simulation with live commentary, and league table tracking.

## Background

NextSMS is a modern migration of **ESMS+**, the Electronic Soccer Management Simulator originally created by **Eli Bendersky**. The original ESMS was a C/C++ based play-by-email soccer management game that became a staple of online fantasy football leagues in the early 2000s.

This project aims to bring the ESMS experience to a contemporary web stack while maintaining **legacy compatibility** with classic roster files, league configurations, and simulation parameters. The platform can be easily deployed on **Cloudflare Workers** with a D1 (SQLite) database, requiring no traditional server infrastructure.

### Acknowledgements

- **Eli Bendersky** — creator of the original ESMS and ESMS+ match simulation engine
- The ESMS community that kept the game alive through countless league seasons

### License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later). The original ESMS was published under the **GNU Lesser General Public License v3.0** (LGPL-3.0), which permits relicensing to GPL v3 or later (and by extension AGPL-3.0).

See [NOTICE](./NOTICE) for full attribution and third-party copyright details, including:
- **ESMS** by Eli Bendersky (1998-2005) — algorithms ported to TypeScript
- **Mersenne Twister MT19937** by Makoto Matsumoto and Takuji Nishimura (1997) — PRNG implementation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | vinext (Vite-based Next.js) |
| React | 19.2.5 with RSC |
| Database | Cloudflare D1 (SQLite) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Deployment | Cloudflare Workers |

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm start        # Production server
pnpm lint         # Lint
pnpm deploy       # Build and deploy to Cloudflare Workers
pnpm cf-typegen   # Regenerate CloudflareEnv types
```

## Features

- **Team Management** — Create and delete teams with auto-generated rosters
- **Player Generation** — Random player creation with skills, abilities, and stats
- **Fixture Scheduling** — Round-robin home & away season fixtures
- **Match Simulation** — Full match engine with tactics, conditionals, and live commentary
- **League Table** — Automatic standings tracking with sorting
- **Teamsheet Creator** — Formation-based lineup selection

## Project Structure

```
src/
  app/           # Pages and API routes
  components/    # Shared UI components
  lib/           # Core logic (simulator, tactics, commentary, fixtures, etc.)
worker/          # Cloudflare Worker entry point
migrations/      # D1 database schema
public/          # Static assets
```

## Database

6 tables in Cloudflare D1: `teams`, `players`, `matches`, `fixtures`, `league_table`, `league_config`.

Schema defined in `migrations/0001_initial.sql`.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). See [CHANGELOG.md](./CHANGELOG.md) for release history.

## AI-Assisted Development

This project was developed with significant assistance from AI coding tools (vibe coding). The codebase was generated through iterative collaboration with AI models, with human direction on architecture decisions, feature requirements, and quality review.

Key aspects of the AI-assisted workflow:

- **Architecture & design** — human-directed; technology choices, data model, and project structure were specified by the developer
- **Code generation** — AI-assisted; the simulation engine, API routes, UI components, and supporting libraries were co-authored with AI tools
- **Review & testing** — human-reviewed; all generated code was linted, built, and functionally verified by the developer
- **Original algorithm design** — the match simulation logic, tactics system, and commentary engine are ports of Eli Bendersky's original ESMS algorithms, not AI-generated designs
