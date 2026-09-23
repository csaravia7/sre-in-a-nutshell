const METRIC_BLOCK = `timeseries {
  total = sum(dt.service.request.count),
  failures = sum(dt.service.request.failure_count),
  response_time = avg(dt.service.request.response_time)
}`;

function buildKpiTail(extraFields = ''): string {
  return `| fieldsAdd total_count = arraySum(total), failure_count = arraySum(failures), avg_response_time = arrayAvg(response_time)
| filter total_count > 0
| fieldsAdd error_rate_pct = if(total_count > 0, (failure_count / total_count) * 100, else: 0)
| fieldsAdd availability_pct = 100 - error_rate_pct
| fields name${extraFields}, availability_pct, error_rate_pct, total_count, avg_response_time
| sort total_count desc
| limit 200`;
}

export function namespaceQuery([from, to]: readonly [string, string]): string {
  return `${METRIC_BLOCK}, by: { dt.entity.service, dt.entity.cloud_application_namespace, dt.entity.cloud_application }, from: ${from}, to: ${to}
| fieldsAdd namespace = entityName(dt.entity.cloud_application_namespace)
| filter isNotNull(namespace)
| fieldsAdd total_count = arraySum(total), failure_count = arraySum(failures), service_response_time = arrayAvg(response_time)
| filter total_count > 0
| fieldsAdd weighted_response_time = service_response_time * total_count
| summarize total_count = sum(total_count), failure_count = sum(failure_count), weighted_response_time = sum(weighted_response_time), service_count = count(), by: { namespace }
| fieldsAdd name = namespace, avg_response_time = weighted_response_time / total_count
| fieldsAdd error_rate_pct = (failure_count / total_count) * 100
| fieldsAdd availability_pct = 100 - error_rate_pct
| fields name, availability_pct, error_rate_pct, total_count, avg_response_time, service_count
| sort total_count desc
| limit 200`;
}

export function serviceQuery(namespace: string, [from, to]: readonly [string, string]): string {
  const escaped = namespace.replace(/"/g, '\\"');
  return `${METRIC_BLOCK}, by: { dt.entity.service, dt.entity.cloud_application_namespace, dt.entity.cloud_application }, from: ${from}, to: ${to}
| fieldsAdd name = entityName(dt.entity.service), namespace = entityName(dt.entity.cloud_application_namespace), entity_id = dt.entity.service, workload = entityName(dt.entity.cloud_application)
| filter namespace == "${escaped}"
| filter isNotNull(name)
${buildKpiTail(', entity_id, workload')}`;
}
