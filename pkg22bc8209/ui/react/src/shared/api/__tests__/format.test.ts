/*
 * Number and date formatting (FRONTEND §2): `$67K/day`, `$15.8M`, `+8.5%`, `Jun 9, 2026`,
 * and the UTC day arithmetic behind the scrubber and the charts.
 */

import {
  REPLAY_DAYS,
  addDays,
  clampDate,
  dayIndexOf,
  daysBetween,
  formatCompact,
  formatDate,
  formatNumber,
  formatPct,
  formatRisk,
  formatThreshold,
  formatUsd,
  isoFromDayIndex,
} from '../format';
import { REPLAY_END, REPLAY_START } from '../contract';

describe('formatUsd', () => {
  it('rounds to K and M the way the pitch quotes them', () => {
    expect(formatUsd(66672, { perDay: true })).toBe('$67K/day');
    expect(formatUsd(15_800_000)).toBe('$15.8M');
    expect(formatUsd(10_000_000)).toBe('$10M');
    expect(formatUsd(1840)).toBe('$1,840');
    expect(formatUsd(111_000, { perDay: true, approx: true })).toBe('~$111K/day');
  });
  it('handles missing values and negatives', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(-3704)).toBe('−$3,704');
  });
});

describe('percentages, risk and thresholds', () => {
  it('signs percentages by default', () => {
    expect(formatPct(8.5)).toBe('+8.5%');
    expect(formatPct(-1.25)).toBe('−1.3%');
    expect(formatPct(8.5, { signed: false })).toBe('8.5%');
    expect(formatPct(null)).toBe('—');
  });
  it('shows risk to one decimal and thresholds at slider precision', () => {
    expect(formatRisk(4.7)).toBe('4.7');
    expect(formatRisk(3)).toBe('3.0');
    expect(formatThreshold(3)).toBe('3.0');
    expect(formatThreshold(2.75)).toBe('2.75');
  });
  it('formats counts and compact magnitudes', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatCompact(350_000)).toBe('350K');
    expect(formatCompact(1_200_000)).toBe('1.2M');
  });
});

describe('dates (UTC, never a local-time shift)', () => {
  it('formats the demo date', () => {
    expect(formatDate('2026-06-09')).toBe('Jun 9, 2026');
    expect(formatDate('2026-06-09', { year: false })).toBe('Jun 9');
    expect(formatDate(null)).toBe('—');
  });
  it('maps day indexes onto the replay window both ways', () => {
    expect(dayIndexOf(REPLAY_START)).toBe(0);
    expect(dayIndexOf(REPLAY_END)).toBe(REPLAY_DAYS - 1);
    expect(isoFromDayIndex(dayIndexOf('2026-06-09'))).toBe('2026-06-09');
    expect(isoFromDayIndex(-5)).toBe(REPLAY_START);
    expect(isoFromDayIndex(10_000)).toBe(REPLAY_END);
  });
  it('lands eight days before the real break and clamps to the window', () => {
    expect(addDays('2026-06-17', -8)).toBe('2026-06-09');
    expect(daysBetween('2026-06-17', '2026-08-10')).toBe(54);
    expect(clampDate('2025-12-25')).toBe(REPLAY_START);
    expect(clampDate('2026-09-15')).toBe(REPLAY_END);
    expect(clampDate('2026-03-03')).toBe('2026-03-03');
  });
});
