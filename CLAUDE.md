# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## App Purpose

**SRE in a Nutshell** — a Dynatrace App targeting on-call SRE teams. Two modes:

- **Today** — actionable items since last visit, ranked by consequence, with per-user acknowledgement
- **This week** — week-over-week trend comparisons

The core product promise: _"Nothing else changed since you last looked."_ If per-user diff and acknowledgement state are removed, it degrades to a dashboard.

Full requirements and build phases are in [specs.md](specs.md).

## Target Environment

- **Dynatrace tenant**: `https://idz18332.apps.dynatrace.com/`
- **App ID**: `my.sre.in.a.nutshell`
- **Current scopes**: `storage:logs:read`, `storage:buckets:read` — additional scopes needed for full feature set (see specs.md §6)

## State Architecture

Per-user state via `useUserAppState` / `useSetUserAppState` (not app state — two users would overwrite each other):

```ts
type UserState = {
  lastSeen: string; // ISO 8601 — updated ONLY on "Mark all reviewed", never on mount
  acked: string[];  // problem display_ids — acked rows dim but stay visible
  mode: "today" | "week";
};
```

- No `lastSeen` on first run → default to 12h ago, label as first visit
- Scopes required: `state:user-app-states:read`, `state:user-app-states:write`

## DQL Patterns

All DQL queries in this app must include explicit timeframe and `limit`. Queries are unverified against the real tenant — confirm field names in a Dynatrace Notebook before implementing. See specs.md §4 for query shapes.

## Key Implementation Rules

- Render sections independently as queries resolve — never block the whole view on one query
- Every section needs four explicit states: loading, empty (with human copy), error (distinguish permission vs. query failure vs. timeout), and partial failure
- No auto-refresh timer — refresh on mount, explicit user action, and optionally window focus
- Weekly aggregation belongs in an `api/` app function, not orchestrated from React state
- `lastSeen` must never update on mount — doing so destroys the product's core value

## Current Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `Home` | Landing page |
| `/data` | `Data` | DQL explorer with live query editor |

Add routes in [ui/app/App.tsx](ui/app/App.tsx) and nav links in [ui/app/components/Header.tsx](ui/app/components/Header.tsx).
