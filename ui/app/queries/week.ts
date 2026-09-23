export const serviceAvailabilityQuery = `timeseries {
  total = sum(dt.service.request.count),
  failures = sum(dt.service.request.failure_count)
}, by: { dt.entity.service }, from: now()-7d, to: now()
| fieldsAdd name = entityName(dt.entity.service)
| filter isNotNull(name)
| fieldsAdd total_count = arraySum(total), failure_count = arraySum(failures)
| fieldsAdd availability_pct = if(total_count > 0, ((total_count - failure_count) / total_count) * 100, else: 100)
| fields name, availability_pct, total_count, failure_count
| sort availability_pct asc
| limit 50`;
