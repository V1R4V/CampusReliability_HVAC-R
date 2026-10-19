/*
 * ProvenanceChip — the honesty label (RULES §4, FRONTEND §2).
 *
 * `REAL` on cited facts (weather, buildings, costs), `SYNTHETIC` on anything generated
 * for the demo (sensors, loop layout, planted failures), `ESTIMATE` on figures derived
 * from stated assumptions ($/day). Deliberately colour-free: provenance is not status.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import type { Provenance } from '@/shared/api';

const TITLES: Record<Provenance, string> = {
  REAL: 'Real — from a cited public source (NOAA weather, UW buildings and plants, reported costs, FP&M work-order format).',
  SYNTHETIC: 'Synthetic — generated for this demo because UW does not publish it (sensor readings, loop layout, planted failures).',
  ESTIMATE: 'Estimate — derived from stated assumptions ($3,704 per rental chiller per day; $0.10/kWh).',
};

const STYLES: Record<Provenance, string> = {
  REAL: 'border-solid border-[var(--bib-ink)] text-[var(--bib-ink)]',
  SYNTHETIC: 'border-dashed border-[var(--bib-ink-muted)] text-[var(--bib-ink-muted)]',
  ESTIMATE: 'border-dotted border-[var(--bib-ink-muted)] text-[var(--bib-ink-muted)]',
};

export interface ProvenanceChipProps {
  kind: Provenance;
  size?: 'sm' | 'md';
  /** Override the hover explanation (e.g. to name the exact source). */
  title?: string;
  className?: string;
}

export default function ProvenanceChip({ kind, size = 'md', title, className }: ProvenanceChipProps) {
  return (
    <span
      title={title ?? TITLES[kind]}
      className={cn(
        'inline-flex shrink-0 items-center rounded-[3px] border bg-[var(--bib-surface)] px-1.5 font-semibold uppercase leading-none tracking-[0.08em]',
        size === 'sm' ? 'h-[18px] text-[11px]' : 'h-[20px] text-[12px]',
        STYLES[kind],
        className,
      )}
    >
      {kind}
    </span>
  );
}
