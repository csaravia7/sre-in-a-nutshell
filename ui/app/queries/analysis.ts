const METRIC_TIMESERIES = `timeseries {
  total         = sum(dt.service.request.count),
  failures      = sum(dt.service.request.failure_count),
  response_time = percentile(dt.service.request.response_time, 50)
}, by: { dt.smartscape.service }`;

const METRIC_AGGREGATION = `| fieldsAdd
    total_count           = arraySum(total),
    failure_count         = arraySum(failures),
    service_response_time = arrayAvg(response_time)
| filter total_count > 0
| fieldsAdd weighted_response_time = service_response_time * total_count
| fields dt.smartscape.service, total_count, failure_count, weighted_response_time`;

const NAMESPACE_LOOKUP = `smartscapeNodes "SERVICE"
    | traverse edgeTypes: {belongs_to}, targetTypes: {K8S_NAMESPACE}
    | fields
        service_id = toSmartscapeId(dt.traverse.history[-1][\`id\`]),
        namespace  = name,
        cluster    = k8s.cluster.name`;

/**
 * Same traversal as NAMESPACE_LOOKUP, but constrained to one namespace *inside*
 * the subquery.
 *
 * Doing it here rather than with a `| filter namespace == "…"` after the lookup
 * matters: a service can traverse to more than one target, and `lookup` keeps
 * only one match per service. Filtering afterwards means we first pick an
 * arbitrary match and then test it, so the drill-down can both miss services
 * and — if the picked match isn't the one we want — show services from
 * elsewhere. Filtering inside leaves only matching rows to pick from, so a
 * non-null `namespace` can only ever be the selected one.
 */
function namespaceLookupFor(namespace: string): string {
  const escaped = namespace.replace(/"/g, '\\"');
  return `smartscapeNodes "SERVICE"
    | traverse edgeTypes: {belongs_to}, targetTypes: {K8S_NAMESPACE}
    | filter name == "${escaped}"
    | fields
        service_id = toSmartscapeId(dt.traverse.history[-1][\`id\`]),
        namespace  = name,
        cluster    = k8s.cluster.name`;
}

const SERVICE_DETAIL_LOOKUP = `smartscapeNodes "SERVICE"
    | fields
        service_id = toSmartscapeId(id),
        name       = name`;

const WORKLOAD_LOOKUP = `smartscapeNodes "SERVICE"
    | traverse edgeTypes: {belongs_to}, targetTypes: {K8S_DEPLOYMENT, K8S_STATEFULSET}
    | fields
        service_id    = toSmartscapeId(dt.traverse.history[-1][\`id\`]),
        workload      = name,
        workload_type = type`;

const KPI_FIELDS = `| fieldsAdd
    avg_response_time = weighted_response_time / total_count,
    error_rate_pct    = (failure_count / total_count) * 100,
    availability_pct  = 100 - (failure_count / total_count) * 100`;

export function namespaceQuery([from, to]: readonly [string, string]): string {
  return `${METRIC_TIMESERIES}, from: ${from}, to: ${to}
${METRIC_AGGREGATION}
| lookup [
    ${NAMESPACE_LOOKUP}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { namespace, cluster }
| filter isNotNull(namespace)
| summarize
    total_count            = sum(total_count),
    failure_count          = sum(failure_count),
    weighted_response_time = sum(weighted_response_time),
    service_count          = count(),
    by: { namespace }
${KPI_FIELDS}
| fieldsAdd name = namespace
| fields name, availability_pct, error_rate_pct, total_count, avg_response_time, service_count
| sort total_count desc
| limit 200`;
}

/**
 * Per-service availability bucketed into calendar days, for the heatmap view.
 *
 * Unlike the other analysis queries this one keeps the `timeseries` arrays intact
 * (`interval: 1d`) instead of collapsing them with `arraySum` — one array element
 * per day becomes one heatmap cell. `timeframe` is carried through so the UI can
 * label each column with the day it actually covers rather than guessing.
 */
export function heatmapQuery(namespace: string, [from, to]: readonly [string, string]): string {
  return `timeseries {
  total    = sum(dt.service.request.count),
  failures = sum(dt.service.request.failure_count)
}, by: { dt.smartscape.service }, from: ${from}, to: ${to}, interval: 1d
| filter arraySum(total) > 0
| lookup [
    ${namespaceLookupFor(namespace)}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { namespace, cluster }
| filter isNotNull(namespace)
| lookup [
    ${SERVICE_DETAIL_LOOKUP}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { name }
| filter isNotNull(name)
| lookup [
    ${WORKLOAD_LOOKUP}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { workload, workload_type }
| fieldsAdd entity_id = dt.smartscape.service
| fields name, workload, entity_id, namespace, cluster, timeframe, total, failures
| limit 300`;
}

export function serviceQuery(namespace: string, [from, to]: readonly [string, string]): string {
  return `${METRIC_TIMESERIES}, from: ${from}, to: ${to}
${METRIC_AGGREGATION}
| lookup [
    ${namespaceLookupFor(namespace)}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { namespace, cluster }
| filter isNotNull(namespace)
| lookup [
    ${SERVICE_DETAIL_LOOKUP}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { name }
| filter isNotNull(name)
| lookup [
    ${WORKLOAD_LOOKUP}
  ],
  sourceField: dt.smartscape.service,
  lookupField: service_id,
  fields: { workload, workload_type }
| fieldsAdd entity_id = dt.smartscape.service
${KPI_FIELDS}
| fields name, workload, workload_type, entity_id, namespace, cluster, availability_pct, error_rate_pct, total_count, avg_response_time
| sort total_count desc
| limit 200`;
}
