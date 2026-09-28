import { DEFAULT_TIMEFRAME, type AnalysisTimeframe } from '../../components/TimeframePicker';

/**
 * Filters that both analysis tabs share, so narrowing down to a service on one
 * tab carries over when you switch to the other to look at it in more detail.
 *
 * Sorting and pagination stay local to each section — the two views sort by
 * different things, so carrying those over would be meaningless.
 */
export type AnalysisFilters = {
  /** Free-text match on service and workload name. */
  search: string;
  /** Inclusive availability window, in percent. */
  availMin: number;
  availMax: number;
  /** Only the heatmap reads this, but it lives here so it survives tab switches. */
  timeframe: AnalysisTimeframe;
};

export const DEFAULT_FILTERS: AnalysisFilters = {
  search: '',
  availMin: 0,
  availMax: 100,
  timeframe: DEFAULT_TIMEFRAME,
};

/**
 * Filters to apply when moving to a different namespace: the service-level ones
 * are meaningless there, but the timeframe is a deliberate choice worth keeping.
 */
export function filtersForNewNamespace(previous: AnalysisFilters): AnalysisFilters {
  return { ...DEFAULT_FILTERS, timeframe: previous.timeframe };
}

export type AnalysisFiltersProps = {
  filters: AnalysisFilters;
  onFiltersChange: (patch: Partial<AnalysisFilters>) => void;
};
