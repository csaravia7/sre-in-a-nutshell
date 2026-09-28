import React, { useState } from 'react';
import { DateTimePicker } from '@dynatrace/strato-components/forms';
import type { TimeValue } from '@dynatrace/strato-components/core';
import { useTranslation } from '../i18n/LanguageProvider';

const DAY_MS = 86_400_000;

/** Beyond this the heatmap grid stops being readable, so we refuse the range. */
export const MAX_RANGE_DAYS = 62;

export const PRESET_DAYS = [7, 14, 30] as const;

export type AnalysisTimeframe = {
  /** DQL time expression for `from:` — already quoted when absolute. */
  from: string;
  /** DQL time expression for `to:` — already quoted when absolute. */
  to: string;
  /** Expected number of day buckets; used for validation, not for rendering. */
  days: number;
  isCustom: boolean;
};

/**
 * A rolling window ending now. `@d` aligns the start to local midnight so the
 * first heatmap column is a whole day rather than a partial one, which means
 * `days - 1` full days plus today so far — exactly `days` columns.
 */
export function presetTimeframe(days: number): AnalysisTimeframe {
  return { from: `now()-${days - 1}d@d`, to: 'now()', days, isCustom: false };
}

export const DEFAULT_TIMEFRAME = presetTimeframe(7);

/** DateTimePicker hands back either a plain ISO string or a structured TimeValue. */
function toIso(value: TimeValue | string | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value.length > 0 ? value : null;
  return value.absoluteDate.length > 0 ? value.absoluteDate : null;
}

function startOfDay(iso: string): Date | null {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

type CustomRange = { from: string; to: string; days: number };

/**
 * Turns two picked dates into an inclusive whole-day range, clamped at "now"
 * so we never ask Grail for buckets in the future.
 */
function buildCustomRange(fromIso: string, toIso: string): CustomRange | null {
  const start = startOfDay(fromIso);
  const endDay = startOfDay(toIso);
  if (start === null || endDay === null) return null;

  const end = new Date(endDay.getTime());
  end.setDate(end.getDate() + 1); // the picked day is included in full
  const clampedEnd = Math.min(end.getTime(), Date.now());
  if (clampedEnd <= start.getTime()) return null;

  return {
    from: `"${start.toISOString()}"`,
    to: `"${new Date(clampedEnd).toISOString()}"`,
    days: Math.max(1, Math.round((clampedEnd - start.getTime()) / DAY_MS)),
  };
}

type TimeframePickerProps = {
  value: AnalysisTimeframe;
  onChange: (timeframe: AnalysisTimeframe) => void;
};

export function TimeframePicker({ value, onChange }: TimeframePickerProps) {
  const { t, locale } = useTranslation();
  const [showCustom, setShowCustom] = useState(value.isCustom);
  const [fromValue, setFromValue] = useState<TimeValue | string | null>(null);
  const [toValue, setToValue] = useState<TimeValue | string | null>(null);

  const fromIso = toIso(fromValue);
  const toIsoValue = toIso(toValue);
  const candidate = fromIso !== null && toIsoValue !== null ? buildCustomRange(fromIso, toIsoValue) : null;

  // Distinguish "nothing picked yet" from "picked something impossible".
  const rangeError =
    fromIso === null || toIsoValue === null
      ? null
      : candidate === null
        ? t('analysis.timeframe.errorOrder')
        : candidate.days > MAX_RANGE_DAYS
          ? t('analysis.timeframe.errorTooLong', { max: MAX_RANGE_DAYS })
          : null;

  const canApply = candidate !== null && rangeError === null;
  const maxDate = new Date().toISOString();

  function applyPreset(days: number) {
    setShowCustom(false);
    onChange(presetTimeframe(days));
  }

  function applyCustom() {
    if (candidate === null || rangeError !== null) return;
    onChange({ from: candidate.from, to: candidate.to, days: candidate.days, isCustom: true });
  }

  function describeActive(): string {
    if (!value.isCustom) return t('analysis.timeframe.lastDays', { days: value.days });
    const start = fromIso !== null ? startOfDay(fromIso) : null;
    const end = toIsoValue !== null ? startOfDay(toIsoValue) : null;
    if (start === null || end === null) return t('analysis.timeframe.custom');
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    return `${format.format(start)} – ${format.format(end)}`;
  }

  return (
    <div className="timeframe-picker">
      <div className="timeframe-picker-row">
        <span className="timeframe-picker-label">{t('analysis.timeframe.label')}</span>
        <div className="sort-quick-group" role="group" aria-label={t('analysis.timeframe.label')}>
          {PRESET_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              className={`sort-quick-btn${!value.isCustom && value.days === days && !showCustom ? ' active' : ''}`}
              onClick={() => applyPreset(days)}
            >
              {t('analysis.timeframe.lastDays', { days })}
            </button>
          ))}
          <button
            type="button"
            className={`sort-quick-btn${showCustom ? ' active' : ''}`}
            aria-expanded={showCustom}
            onClick={() => setShowCustom((open) => !open)}
          >
            {t('analysis.timeframe.custom')}
          </button>
        </div>
        <span className="timeframe-picker-active">{describeActive()}</span>
        <span className="view-note timeframe-picker-scope">{t('analysis.timeframe.scopeNote')}</span>
      </div>

      {showCustom && (
        <div className="timeframe-picker-custom">
          <label className="timeframe-field">
            <span>{t('analysis.timeframe.from')}</span>
            <DateTimePicker
              type="date"
              value={fromValue}
              max={maxDate}
              placeholder={t('analysis.timeframe.addDate')}
              onChange={setFromValue}
            />
          </label>
          <label className="timeframe-field">
            <span>{t('analysis.timeframe.to')}</span>
            <DateTimePicker
              type="date"
              value={toValue}
              max={maxDate}
              placeholder={t('analysis.timeframe.addDate')}
              onChange={setToValue}
            />
          </label>
          <button className="primary-button" type="button" disabled={!canApply} onClick={applyCustom}>
            {t('analysis.timeframe.apply')}
          </button>
          {rangeError !== null && (
            <span className="timeframe-picker-error" role="alert">{rangeError}</span>
          )}
        </div>
      )}
    </div>
  );
}
