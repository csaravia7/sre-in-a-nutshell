# SRE in a Nutshell

> **BETA** — Dynatrace App for on-call SRE teams at Interbank.

Surfaces the metrics that matter most during an incident or daily review — without the noise of a full dashboard. Focused on **namespace-level service health** with availability, error rate, throughput, and latency comparisons across time windows.

---

## What it does

**Analysis view** (default):
- Shows all Kubernetes namespaces with their key SRE indicators for the last 24 hours.
- Select a namespace to drill into its individual services.
- Each service shows its **current value** alongside **yesterday** and **7 days ago** references with % change — so you can spot trends at a glance.
- Filter by name or by availability range (dual-handle slider).
- Sort by availability (best/worst first) with one click.

---

## Target environment

| Field | Value |
|---|---|
| Dynatrace tenant | `https://<TENANT_ID>.apps.dynatrace.com/` |
| App ID | `my.sre.in.a.nutshell` |
| App version | `0.0.1` |

---

## Required scopes

| Scope | Purpose |
|---|---|
| `storage:logs:read` | Log queries |
| `storage:buckets:read` | Bucket metadata |
| `storage:events:read` | Change events |
| `storage:metrics:read` | Service metrics (DQL timeseries) |
| `storage:entities:read` | Entity name resolution |
| `storage:filter-segments:read` | Global segment selector |
| `state:user-app-states:read` | Per-user preferences |
| `state:user-app-states:write` | Per-user preferences |

---

## Development

### Prerequisites

- Node.js 18+
- Access to the Dynatrace tenant listed above
- `dt-app` CLI (installed via `npm install`)

### Commands

```bash
npm run start       # Dev server with hot reload (opens browser automatically)
npm run build       # Compile and bundle → dist/
npm run deploy      # Build + deploy to the tenant in app.config.json
npm run lint        # ESLint — must pass before deploying
npm run update      # Update dt-app and SDK dependencies
```

### Project structure

```
app.config.json              # App metadata, scopes, icon path
ui/
  main.tsx                   # React entry point
  styles.css                 # All custom styles (CSS variables for light/dark)
  assets/
    icon.svg                 # Interbank icon (blue square, no wordmark)
  app/
    App.tsx                  # Router + theme wiring (useCurrentTheme)
    components/              # Shared UI: Header, SectionCard, ResizableTh, …
    pages/                   # Route-level components: Analysis, Today, Week
    sections/
      analysis/              # NamespaceCardsSection, ServiceComparisonSection, shared.tsx
      today/                 # ProblemsSection, ChangeEventsSection
    queries/                 # All DQL queries as named exports (analysis.ts, today.ts, week.ts)
    i18n/                    # EN/ES translations (translations.ts, LanguageProvider.tsx)
```

### Key conventions

- **All DQL queries live in `ui/app/queries/`** — never inline a query in a component.
- **Strato Design System** components are preferred; fall back to plain React/HTML only when no Strato component fits.
- Import Strato from subcategory paths (`/layouts`, `/typography`, etc.) — never from the package root.
- `npm run build` and `npm run lint` must both pass before deploying.

---

## Deploying

1. Ensure `environmentUrl` in `app.config.json` points to the correct tenant.
2. Run `npm run deploy` — this builds and pushes the app in one step.
3. Open the App Launcher in Dynatrace and find **SRE in a Nutshell**.

---

## Useful links

- [Dynatrace Developer Portal](https://dt-url.net/developers)
- [Strato Design System docs](https://dt-url.net/strato)
- [DQL reference](https://dt-url.net/dql)
