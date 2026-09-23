# SRE Brief — Dynatrace AppEngine build spec

Build input for a Dynatrace app that replaces the daily dashboard sweep for an on-call SRE team.
Intended as the source document for an AI coding assistant and for human review before any code is written.

---

## 0. Before writing code

These are unresolved. Answer them first — several change the architecture, not just the copy.

| # | Question | Why it blocks |
|---|---|---|
| 1 | Who owns this app after handover? | Custom apps are not covered by Dynatrace support. Named owner, repo, and upgrade responsibility must exist before install. |
| 2 | Are acknowledgements personal or shared? | Personal means duplicated triage effort. Shared means one person can hide an incident from the team. Recommendation: personal acks, shared read-only counters. |
| 3 | What is the collapse rule at scale? | The layout assumes ~5 rows. A tenant with 400 open problems needs grouping. Retrofitting grouping into a list UI is expensive. |
| 4 | Are deployment events reliably populated in this tenant? | If not, cut that section. An empty section trains users to ignore the app. |
| 5 | Is the shift boundary per-user or fixed? | Follow-the-sun rotations need a team handover time, not a personal "last visit". |
| 6 | What is the acceptable query cost per user per day? | Drives refresh policy and timeframe bounds. This is a DPS line item. |

---

## 1. Purpose

One app, two modes, serving two different questions.

- **Today** — what requires action in the next few hours, ranked by consequence, with per-user acknowledgement.
- **This week** — what is trending worse, with week-over-week comparison.

They share auth, team config, and navigation. They share almost no components.

### Non-goals

- Not a replacement for alerting.
- Not a real-time wallboard. No auto-refresh timer.
- Not a single screen showing everything. Two modes is deliberate.
- Not a service-detail view. Rows link out to the native apps.

### The one sentence the app exists to say

> "Nothing else changed since you last looked."

No dashboard can say this. If the per-user diff and the acknowledgement state get cut, the product is a dashboard and should be built as one.

---

## 2. Today mode — content

Exactly five row types, ranked by consequence, not by severity label.

| Rank | Row type | Ranking basis | Action label |
|---|---|---|---|
| 1 | Open problems | sessions or users affected, descending | Act now |
| 2 | Error budget burn rate | current burn multiple vs. target | Act now |
| 3 | Saturation approaching a limit | projected time to limit | Watch |
| 4 | Change events since last visit | chronological | Context |
| 5 | Newly silent sources | time since last data point | Silent |

### Row anatomy

- Action pill: `Act now` / `Watch` / `Context` / `Silent`
- Title, 15px medium
- Right-aligned metadata (duration, magnitude)
- One line of supporting detail, 14px secondary
- Per-row acknowledge control
- Click target opens the relevant native app via intent

### Deliberately excluded from Today

Raw latency and throughput charts, host CPU, per-service tiles, anything currently healthy. A view that is mostly green is reassurance, not a tool.

### Footer

- Left: `Nothing else changed since you last looked` (only when the residual list is empty)
- Right: `Mark all reviewed` — primary action, writes `lastSeen = now`, clears `acked`

---

## 3. This week mode — content

Every number must carry its prior-period comparison. A bare figure is decoration.

| Block | Metric | Comparison |
|---|---|---|
| Alert noise | % of alerts with no human action | vs. previous week |
| On-call load | out-of-hours pages, and distribution across the rotation | vs. previous week |
| Repeat incidents | same failure signature firing more than once | vs. previous week |
| SLO trend | 4-week sparkline per SLO, current attainment | direction, not snapshot |
| Coverage drift | new unmonitored services, untagged entities, missing SLOs | net change |
| Capacity trend | ingest growth, reclaimable K8s headroom | vs. previous week |

No real-time data in this mode. Fixed week boundaries.

---

## 4. Data contracts

**All DQL below is unverified against a real tenant.** Field names, event kinds, and table names must be confirmed in a Notebook before implementation. Treat these as shape, not as truth.

### 4.1 Problems since last visit

```dql
fetch dt.davis.problems, from: -24h
| filter event.start >= toTimestamp("<lastSeen>")
     or event.end   >= toTimestamp("<lastSeen>")
| fields display_id, event.name, event.status, event.start, event.end,
         affected_entity_ids, event.category
| sort event.start desc
| limit 200
```

Split opened / resolved / still-open client-side from `event.status`. One query serves three sections.

Impact ranking requires a session or user count per problem. If that is not available on the problem record, a second query joining affected entities to RUM or request counts is needed — confirm feasibility before committing to impact-based ranking, and fall back to severity + duration if not.

### 4.2 Change events since last visit

```dql
fetch events, from: -24h
| filter event.start >= toTimestamp("<lastSeen>")
| filter event.kind == "DEPLOYMENT_EVENT"
| fields event.start, deployment.name, dt.entity.service
| sort event.start desc
| limit 50
```

Highest risk of returning nothing. Verify first; cut the section if sparse.

### 4.3 Newly silent sources

Compare entities reporting in the last 24h against those reporting in the preceding 7 days. Two aggregations, diffed client-side. Threshold configurable (default: no data for 2h on something that reported hourly for 7 days).

### 4.4 Saturation

Per-metric threshold config, not hardcoded. Candidate metrics: connection pool utilisation, disk free, queue depth, quota consumption.

**Projection caveat:** linear extrapolation to a limit is wrong for most saturation curves. Either expose the method on hover or downgrade the copy to a direction ("climbing steadily") rather than a predicted time. A wrong projection someone plans around is worse than no projection.

### 4.5 Weekly aggregates

Fixed week boundaries, two windows per metric (current, previous), computed server-side in an app function where possible to reduce round trips.

---

## 5. State model

### Per-user state

Scopes: `state:user-app-states:read`, `state:user-app-states:write`

Use user state, not app state. App state is tenant-shared and two concurrent users will overwrite each other.

```ts
type UserState = {
  lastSeen: string;        // ISO 8601
  acked: string[];         // problem display_ids
  mode: "today" | "week";
};
```

- No `lastSeen` on first run: default to 12h ago and label the window in the header as a first visit.
- `lastSeen` updates **only** on explicit `Mark all reviewed` — never on mount. Updating on mount destroys the product.
- Acked rows dim but remain visible. Removing them makes the app feel like it hides things.

### Team configuration

Belongs in a settings schema, not in shared app state. Admin-editable, platform-versioned.

```
teamName: string
managementZone | entitySelector: string
shiftBoundary: "perUser" | "fixed"
shiftStartTime?: string        // when fixed
saturationThresholds: { metric: string, warnAt: number }[]
silenceThresholdHours: number
sectionsEnabled: string[]      // allows cutting deploys where unpopulated
```

---

## 6. Permissions and visibility

DQL respects the calling user's IAM. Two users will legitimately see different results.

A user missing a scope receives an **error**, not an empty result. Every section needs a distinguishable "you don't have access to this data" state. Without it, missing permissions get reported as bugs.

App scopes required:
- `storage:buckets:read`, `storage:events:read` (adjust per data sources used)
- `state:user-app-states:read` / `:write`
- `settings:objects:read` (team config)
- Intent navigation — no additional scope

---

## 7. States to design

Four sections × four states. The unhappy paths are what users see most.

| State | Requirement |
|---|---|
| Loading | Render each section as its query resolves. Never block the whole view. |
| Empty | Human copy, not "no data". Empty is the success case for several sections. |
| Error | Distinguish permission errors from query failures from timeouts. |
| Partial | One section failing must not blank the others. |
| Over-limit | Query returned at the limit — say so, don't silently truncate. |

---

## 8. Performance and cost

- **No auto-refresh timer.** Refresh on mount, on explicit user action, and optionally on window focus.
- Every query bounded by explicit timeframe and `limit`.
- Parallel query execution at mount; target under 3s to first meaningful paint.
- Chain multi-step aggregation in an app function (`api/`) rather than orchestrating from React state.
- Assume a tenant returning 400 open problems, not 9. Group by pattern above a threshold.

---

## 9. Technical stack

- `npx dt-app create` scaffold
- React + TypeScript
- `@dynatrace/strato-components` and `@dynatrace/strato-components-preview`
- `@dynatrace-sdk/react-hooks` — `useDql`, user state hooks
- `@dynatrace-sdk/client-query` for anything the hooks don't cover
- `@dynatrace-sdk/navigation` — `useIntentLink` for handoff to native apps
- App functions in `api/` for weekly aggregation

Recommended: set up the `dynatrace-apps` MCP server and an `AGENTS.md` so the coding assistant has current Strato component and SDK documentation rather than training-data recollection.

---

## 10. Build phases

**Phase 0 — feasibility (do not skip)**
Run every query in section 4 against the target tenant. Record which return usable data. Cut sections that don't. This determines scope; everything after assumes it is done.

**Phase 1 — state spine**
Scaffold, scopes, user state read/write, persistence verified across reload. If state doesn't persist, the product doesn't exist — find out here.

**Phase 2 — Today mode**
Problems query, three-way client split, row rendering, action-label ranking, per-row ack, mark-all-reviewed, header window line.

**Phase 3 — remaining Today sections**
Change events, silent sources, saturation. Each independently cuttable.

**Phase 4 — This week mode**
Mode switch, weekly aggregation in an app function, comparison rendering, sparklines.

**Phase 5 — hardening**
All states from section 7. Grouping rule at scale. Intent links. Settings schema.

**Phase 6 — pilot**
One team, one tenant, three weeks, instrumented.

---

## 11. Acceptance criteria

1. Setting `lastSeen` backwards visibly changes the result set. (If not, the timestamp filter is silently inert — the most likely bug.)
2. `Mark all reviewed` empties the view, and the view is still empty after reload.
3. Two different users see independent acknowledgement state.
4. A user lacking a scope sees an explicit permission message, not an empty section.
5. One failing section does not blank the others.
6. Every weekly number displays its prior-period comparison.
7. No query runs without an explicit timeframe and limit.
8. Cold load renders something meaningful in under 3 seconds.

---

## 12. Pilot exit criteria

Instrument which sections are expanded and whether `Mark all reviewed` is used.

If acknowledgement goes largely unused after three weeks, the per-user diff is not delivering value and the honest recommendation is to convert this into a dashboard plus a scheduled report — which costs the customer nothing to maintain and carries no support liability.

Recommending that outcome, if the data supports it, is worth more than shipping the app.