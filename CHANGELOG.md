# Changelog

All notable changes to NextSMS are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

### Changed

- Set `packageManager` to `pnpm@10.33.3` so CI `pnpm/action-setup` can resolve a version

### Security

- Upgraded `better-auth` to 1.6.27 (fixes CVE-2026-53512 / GHSA-pw9m-5jxm-xr6h and related better-auth advisories)
- Upgraded React RSC stack to 19.2.8 and `@vitejs/plugin-rsc` to 0.5.34 (DoS advisories in Server Components)
- Upgraded Vite to ≥8.0.16 and Cloudflare tooling (`wrangler`, `@cloudflare/vite-plugin`) to clear `ws` / `undici` / `sharp` highs
- Added pnpm overrides for transitive highs: `brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`
- Fixed CVE-2026-6321 / GHSA-q3j6-qgpj-74h6: fast-uri path traversal via percent-encoded dot segments (upgraded to 3.1.2)
- Fixed CVE-2026-6322 / GHSA-v39h-62p7-jpjc: fast-uri host confusion via percent-encoded authority delimiters (upgraded to 3.1.2)
- Fixed CVE-2026-44635 / GHSA-pv5w-4p9q-p3v2: Kysely JSON-path traversal injection in `JSONPathBuilder` (upgraded to 0.28.17)
- Added branch protection on `master`: requires CI pass, no force pushes, no deletions
- Added Dependabot configuration for weekly npm and GitHub Actions dependency updates
- Added CI workflow with lint, typecheck, and security audit checks
- Added CODEOWNERS file for change review ownership
- Updated SECURITY.md with comprehensive vulnerability reporting policy and security controls documentation
- `.npmrc` added to `.gitignore` to prevent accidental registry token exposure

- Full security audit conducted across all 36 API routes, middleware, auth, and client components (30 findings)
- Middleware now enforces default-deny authentication: unauthenticated requests to non-public routes return 401 (API) or redirect to login (pages)
- CSRF protection added via `X-Requested-With` header requirement on all state-changing requests (POST/PUT/PATCH/DELETE)
- `safeFetch` utility added for client-side mutation calls — all 54 mutation fetch calls across 18 page components updated
- Content-Security-Policy tightened: removed `unsafe-eval` from `script-src` directive
- Authentication added to 6 previously unauthenticated legacy GET endpoints (league, teams, fixtures, matches)
- Tactic code allowlist validation added to lineups route — prevents arbitrary data insertion (matches existing tactics route validation)
- Aggression bounds validation added to lineup update action (0–100, integers only)
- All truthy checks on numeric IDs replaced with strict `typeof === 'number' && > 0` validation
- `league_id` removed from `TEAM_SETTINGS_COLUMNS` allowlist in db.ts to prevent unauthorized column writes
- Cookie security attributes explicitly configured in better-auth (`httpOnly`, `sameSite: 'lax'`)
- Import filename sanitized to strip path traversal characters from team abbreviation
- Invite tokens properly encoded with `encodeURIComponent` in join page URL construction
- String length limits added: team name (100), abbreviation (10), league name (100), slug (2–50), competition name (100), division name (100)
- Positive integer validation on division operations (assign_team, remove_team, delete)
- `parseJsonBody` helper added to standardize JSON parsing with proper 400 error responses across all API routes
- `parseInt` NaN guards added for season ID URL parameters in divisions and season detail routes
- Aggression validation now enforces integer values (rejects floats like 3.5)
- Duplicate local `requireLeagueMember` function in teams route replaced with shared import from auth-helpers

### Fixed

- Unscoped mass UPDATEs in legacy season route now scope to teams with players (prevents cross-league data modification)
- `activateLineup` in db.ts now uses `db.batch()` for atomic deactivation + activation (prevents race conditions)
- Team deletion in LeagueDO now uses `db.batch()` for atomic player + team deletion (prevents orphaned records)

### Added

- Manual lineup editing: change formation, tactic, aggression, and swap individual players from starting XI and substitutes via dropdown selectors
- `update_lineup` action on lineups API for editing saved lineup formation, tactic, aggression, and player assignments
- `aggression` column on saved lineups (migration 0008) — the active lineup now contains all match configuration in one place
- Simulation engine now uses the team's active saved lineup (formation, tactic, players, conditionals, penalty taker) instead of hardcoded "442N"
- Conditionals are now evaluated during match simulation when the active lineup has them configured

### Changed

- Tactics tab no longer stores formation — formation belongs to lineups only; tactics are now simple presets (tactic code + aggression)
- Lineups tab reordered before Tactics in the team detail page navigation
- `upsertTeamTactic` no longer requires a formation parameter

- Match reports now show full live commentary from the simulation engine instead of synthetic event labels
- Player-by-player match statistics table: goals, assists, shots, tackles, key passes, saves, fouls, cards, minutes played, and rating
- Team statistics comparison bar: possession, shots, shots on target, tackles, fouls, and goals
- Per-match player stats and possession data stored in database for all new matches
- Database migration 0007: added `home_stats`, `away_stats`, `home_possession`, `away_possession` columns to matches table

- Season-first flow: league dashboard now requires creating a season before teams, fixtures, matches, or table can be accessed
- Season context shown in breadcrumbs on fixtures, matches, teams, and table pages
- Season creation call-to-action on league dashboard when no season exists
- Season-aware setup checklist with "Create a season" as the first step
- Season validation on advance-week and generate-fixtures API endpoints

- Season management: create, advance, and complete seasons with full history archival
- Multi-stage competition engine: knockout brackets, group stages, two-legged ties, round-robin pools
- Cup and tournament management: create competitions with multiple stages (e.g. Group Stage → Knockout)
- Group stage automatic draw with seeded team distribution
- Knockout bracket generation with proper seeding (1v8, 2v7, etc.)
- Two-legged knockout ties with aggregate score and away-goals progression
- Multi-division support: create divisions with promotion/relegation/playoff spots
- Auto-assign teams to divisions based on league standings
- Competition fixture generation with per-stage scheduling
- Competition standings tracking with group-level tables
- Week-by-week competition simulation with automatic stage advancement
- Season history archival: standings, competition results, and division data saved on season completion
- Season history page with filterable views by season and category
- API routes for seasons (`/api/leagues/[slug]/seasons`), competitions (`/api/leagues/[slug]/competitions`), divisions (`/api/leagues/[slug]/seasons/[id]/divisions`), and history (`/api/leagues/[slug]/history`)
- Database migration 0006: seasons, divisions, division_teams, competitions, competition_stages, competition_groups, competition_group_teams, competition_fixtures, competition_standings, season_history tables
- Competition detail page with fixtures, standings, and bracket views
- League dashboard updated with navigation cards for Seasons, Competitions, Divisions, and History
- Admin management API at `/api/leagues/[slug]/admin` with actions: reset_fixture, reset_week, reset_all, delete_matches, edit_score, resimulate
- Match report page at `/leagues/[slug]/matches/[id]` showing scoreline, events, lineups, and full commentary
- Match detail API at `/api/leagues/[slug]/matches/[id]` with team names, and DELETE for admins
- Fixtures page admin controls: reset individual fixtures, reset entire weeks, reset all results
- Matches page now shows team names and links to match reports
- Fixture results link to match reports

### Fixed

- Fixed `advanceWeek` crash with "no such column: league_id" on players table — added migration 0005 to add `league_id` column to players, and changed advance queries to use `WHERE team_id IN (SELECT id FROM teams WHERE league_id = ?)` for backwards compatibility
- New players created via `addTeam` now have `league_id` set correctly

## [1.2.0] - 2026-04-26

### Added

- Setup checklist on league dashboard for admins: shows progress toward activating the league (teams, managers, fixtures) with quick-action links
- Warning banner on active league dashboard when teams lack assigned managers
- Team detail API returns `canManage` and `userRole` for client-side permission gating
- League detail API returns `userRole` and `teamsWithoutManagers` for admin notice board
- League list API syncs stale D1 status with canonical DO status
- Generate placeholder teams: bulk-create up to 20 teams with auto-generated names and full rosters via `POST /api/leagues/[slug]/teams` with `action: 'generate_placeholder'`
- Quick-generate button on teams page and setup checklist for fast league setup

### Fixed

- Fixed "No SQL statements detected" error when PUTting empty config to `/api/leagues/[slug]/config`
- Fixed D1/DO status desync: league status in D1 now updates to "active" when fixtures are generated
- Fixed league detail page using stale D1 status instead of canonical DO status
- Fixed team detail page showing write-action buttons (Settings, Transfer, Add Tactic, Generate Lineup) to non-managers — now gated by `canManage` permission

## [1.1.0] - 2026-04-26

### Added
- Tactics management: save, edit, and delete team-specific tactic configurations (formation + tactic code + aggression)
- Saved lineups: auto-generate and activate lineups for matches, view starting XI and substitutes
- Transfer market: list players for transfer with asking price, make bids on available players
- Transfer workflow: accept/reject incoming offers, automatic budget adjustment on completed transfers
- Transfer log: view completed transfers across the league
- Team settings: configure default formation, tactic, and aggression per team
- Team budget tracking with automatic deductions on transfers
- API routes for team tactics (`/api/leagues/[slug]/teams/[teamId]/tactics`)
- API routes for saved lineups (`/api/leagues/[slug]/teams/[teamId]/lineups`)
- API routes for transfers (`/api/leagues/[slug]/transfers`)
- Database migration 0003: team_tactics, team_saved_lineups, transfer_listings, transfer_offers, transfer_log tables
- Transfer Market link on league detail page
- Manage links on league teams list page
- League invitations: invite users by email, assign role and team on invite
- Invite links: generate time-expiry invite links with configurable TTL (24h–30d), copy and share
- Join page: accept or decline invite links at `/leagues/[slug]/join?token=...`
- Email invitations disabled in UI until email service is implemented (API routes remain functional with TODO notes)
- Invitation acceptance/rejection from the leagues dashboard
- Members management page: view members, update roles, remove members, assign teams
- Team manager assignment: assign any league member as a team manager from the members page
- API route for league members (`/api/leagues/[slug]/members`)
- API route for invitations (`/api/invitations`)

### Changed

- Relicensed from GPL-3.0 to AGPL-3.0-or-later
- Corrected original ESMS license reference from LGPLv2 to LGPL-3.0
- Added SPDX license identifiers and copyright attribution headers to all source files derived from ESMS (Eli Bendersky, 1998-2005)
- Added Mersenne Twister attribution (Makoto Matsumoto and Takuji Nishimura, 1997) to random.ts
- Added NOTICE file with full third-party copyright and licensing details
- Added `"license": "AGPL-3.0"` field to package.json

### Fixed

- Password complexity rules (uppercase, lowercase, number) now enforced server-side via better-auth hook, not just client-side

### Security

- Team management security audit (v1.1.0): fixed 8 issues across new API routes
- Fixed truthy checks on numeric IDs (`!id` → `typeof id === 'number' && id > 0`) in transfers, tactics, and lineups routes
- Removed `budget` from team settings update allowlist — managers can no longer set arbitrary budgets
- Added non-negative integer validation on transfer `asking_price` and offer `amount` to prevent budget manipulation
- Added tactic code and formation allowlist validation to prevent arbitrary data insertion
- Added 10 KB size limits on lineup and conditionals JSON payloads

## [1.0.0] - 2026-04-26

### Added

- Initial release of NextSMS (Next Soccer Management Simulator)
- Modern web migration of Eli Bendersky's ESMS+ to vinext (Vite-based Next.js)
- Cloudflare Workers deployment with D1 (SQLite) database
- Team management: create, delete, roster generation
- Player generation with skills, abilities, preferred sides, and statistics
- Match simulation engine with live commentary, tactics, conditionals, and post-match updates
- Round-robin fixture scheduling (home & away)
- League table tracking with automatic standings
- Teamsheet creator with formation-based lineup selection
- Authentication via better-auth (email/password)
- League import for legacy ESMS roster and configuration files
- Tailwind CSS v4 styling with Geist fonts
- GNU General Public License v3.0 (GPL-3.0), relicensed from original ESMS LGPLv2

### Security

- Full pre-release security audit conducted (see SECURITY.md)
- Added authentication to all 11 legacy API routes that were previously unauthenticated
- Added column allowlists to all dynamic UPDATE functions in db.ts to prevent SQL column injection
- Added negative amount validation on transfer offers to prevent budget manipulation
- Fixed authorization bypass on league config PUT endpoint (now requires admin role)
- Added security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- Added file size limits (5 MB), roster file limits (20), player count limits (50/team) on league import
- Added server-side slug validation and name length limits on league import
- Added try/catch with cleanup for failed imports to prevent partial data states
- Moved seed route config overwrite inside empty-teams guard
- Added CSRF protection via `trustedOrigins` in better-auth config
- Added `src/middleware.ts` as a global route protection safety net
- Fixed `GET /api/leagues/[slug]/fixtures` missing membership check
- Made `deleteTeam` atomic using `db.batch()`
- Added numeric validation on imported config values
- Fixed truthy checks on numeric IDs across legacy routes (`!id` → `typeof id === 'number' && id > 0`)
- Added `manager_user_id` column to teams table for team ownership tracking
- Added `requireTeamManager` auth helper — enforced on transfers, tactics, lineups, and team settings
- Fixed import creating duplicate players by skipping auto-roster generation during legacy import
- Added password complexity validation (uppercase, lowercase, number) on registration
