import React, { useCallback, useState } from 'react';
import { Tab, Tabs } from '@dynatrace/strato-components/navigation';
import { NamespaceCardsSection } from '../sections/analysis/NamespaceCardsSection';
import { ServiceComparisonSection } from '../sections/analysis/ServiceComparisonSection';
import { AvailabilityHeatmapSection } from '../sections/analysis/AvailabilityHeatmapSection';
import { TimeseriesSection } from '../sections/analysis/LatencyTimeseriesSection';
import {
  DEFAULT_FILTERS,
  filtersForNewNamespace,
  type AnalysisFilters,
} from '../sections/analysis/filters';
import { useTranslation } from '../i18n/LanguageProvider';

export function Analysis() {
  const { t } = useTranslation();
  // Kept across selections so switching namespaces doesn't kick you out of the
  // tab you're working in.
  const [view, setView] = useState(0);
  const [namespace, setNamespace] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnalysisFilters>(DEFAULT_FILTERS);

  const onFiltersChange = useCallback((patch: Partial<AnalysisFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  function selectNamespace(name: string) {
    setFilters(filtersForNewNamespace);
    setNamespace(name);
  }

  // The tabs are per-namespace analyses, so there is nothing to tab between
  // until one is picked.
  if (namespace === null) {
    return (
      <div className="page">
        <NamespaceCardsSection onSelect={selectNamespace} />
      </div>
    );
  }

  return (
    <div className="page">
      {/* Breadcrumb lives in its own row above the tab bar so the tab buttons
          are never covered, regardless of how many tabs or how long their labels are. */}
      <div className="analysis-tabs-breadcrumb">
        <button className="namespace-back-link" onClick={() => setNamespace(null)}>
          {t('analysis.back')}
        </button>
        <span className="namespace-breadcrumb-sep" aria-hidden="true">›</span>
        {/* No service count here: each tab counts a different window, and a
            number captured at selection time goes stale when the segment
            changes. Each section shows its own live count instead. */}
        <span className="namespace-breadcrumb-name">{namespace}</span>
      </div>

      {/* keepMounted preserves each tab's own sort and paging, and warms the
          other tab's query while you read this one. */}
      <Tabs selectedIndex={view} onChange={setView}>
        <Tab title={t('analysis.view.comparison')} keepMounted>
          <ServiceComparisonSection
            namespace={namespace}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        </Tab>
        <Tab title={t('analysis.view.heatmap')} keepMounted>
          <AvailabilityHeatmapSection
            namespace={namespace}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        </Tab>
        <Tab title={t('analysis.view.timeseries')} keepMounted>
          <TimeseriesSection
            namespace={namespace}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        </Tab>
      </Tabs>
    </div>
  );
}
