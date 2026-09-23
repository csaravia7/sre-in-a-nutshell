export function problemsQuery(lastSeen: string): string {
  return `fetch dt.davis.problems, from: -24h
| filter toTimestamp(event.start) >= toTimestamp("${lastSeen}") or toTimestamp(event.end) >= toTimestamp("${lastSeen}")
| fields display_id, event.name, event.status, event.start, event.end, event.category
| sort event.start desc
| limit 200`;
}

export function changeEventsQuery(lastSeen: string): string {
  return `fetch events, from: -24h
| filter toTimestamp(event.start) >= toTimestamp("${lastSeen}")
| filter event.kind == "DEPLOYMENT_EVENT"
| fields event.start, event.name, dt.entity.service, deployment.name
| sort event.start desc
| limit 50`;
}
