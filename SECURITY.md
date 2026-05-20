# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in NextSMS, please do NOT open a public issue. Report it privately:

- **GitHub Security Advisories**: [Report a vulnerability](https://github.com/crowterliam/nextsms/security/advisories/new)
- **GitHub**: [@crowterliam](https://github.com/crowterliam)

Please include:
- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

We aim to acknowledge reports within 48 hours and provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.5.x | Yes |
| < 1.5.0 | No |

## Security Measures

This project implements the following security controls:

### Application Security
- Authentication via better-auth with CSRF protection
- Default-deny middleware: unauthenticated requests to non-public routes return 401
- CSRF protection via `X-Requested-With` header on all state-changing requests
- Content-Security-Policy headers (no `unsafe-eval` in `script-src`)
- SQL injection prevention via parameterized queries (D1/SQLite)
- Column allowlists on all dynamic UPDATE operations
- Input validation with type checks, length limits, and bounds checking

### Infrastructure Security
- Deployment on Cloudflare Workers (edge runtime, no persistent server)
- D1 (SQLite) database with Cloudflare-managed encryption at rest
- Secrets managed via Cloudflare dashboard / `.dev.vars` (never committed)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

### Supply Chain Security
- Dependabot enabled for npm and GitHub Actions dependencies
- Weekly automated dependency update checks
- OSV-Scanner for vulnerability and license compliance scanning
- Semgrep SAST scanning on every push/PR

### Branch Protection
- `master` branch requires passing CI checks before merge
- Pull request reviews required for all changes
- Force pushes and branch deletion disabled on `master`

## Security Changelog

### v1.5.1 (2026-05)
- Full security audit across all 36 API routes, middleware, auth, and client components (30 findings)
- Middleware enforces default-deny authentication
- CSRF protection via `X-Requested-With` header
- `safeFetch` utility for all client-side mutations
- Tactic code allowlist validation
- Aggression bounds validation
- Strict numeric ID validation throughout
- Cookie security attributes configured
- Path traversal prevention in imports
- `parseJsonBody` helper for standardized error responses

### v1.1.0 (2026-04)
- Team management security audit (8 issues fixed)
- Tactic code and formation allowlist validation
- Transfer amount validation
- Lineup and conditionals payload size limits

### v1.0.0 (2026-04)
- Pre-release security audit
- Authentication on all API routes
- Column allowlists in db.ts
- Transfer offer validation
- Security headers configured
- File size limits on imports
- Password complexity validation
