# Changelog

All notable changes to NextSMS are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

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
