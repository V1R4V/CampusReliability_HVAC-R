/*
 * Probability → status band and formatting shared by the forecast panel, the building badge
 * and the Predictions page.
 */

import { agreementLabel, formatProbability, probabilityColor, probabilityStatus } from '../probability';

describe('probabilityStatus', () => {
  it('bands at 20% and 50%, with null as offline', () => {
    expect(probabilityStatus(null)).toBe('OFFLINE');
    expect(probabilityStatus(0.05)).toBe('HEALTHY');
    expect(probabilityStatus(0.2)).toBe('WATCH');
    expect(probabilityStatus(0.49)).toBe('WATCH');
    expect(probabilityStatus(0.5)).toBe('INSPECTION_DUE');
    expect(probabilityStatus(0.86)).toBe('INSPECTION_DUE');
  });
  it('colours through the status tokens only', () => {
    expect(probabilityColor(0.86)).toBe('var(--bib-status-due)');
    expect(probabilityColor(0.3)).toBe('var(--bib-status-watch)');
    expect(probabilityColor(0.01)).toBe('var(--bib-status-healthy)');
    expect(probabilityColor(undefined)).toBe('var(--bib-ink-faint)');
  });
});

describe('formatProbability / agreementLabel', () => {
  it('rounds to whole percent and never shows a false 0%', () => {
    expect(formatProbability(0.8618)).toBe('86%');
    expect(formatProbability(0.004)).toBe('<1%');
    expect(formatProbability(0)).toBe('0%');
    expect(formatProbability(null)).toBe('—');
  });
  it('labels agreement from the spread', () => {
    expect(agreementLabel(0.1)).toBe('strong');
    expect(agreementLabel(0.22)).toBe('moderate');
    expect(agreementLabel(0.5)).toBe('weak');
    expect(agreementLabel(null)).toBeNull();
  });
});
