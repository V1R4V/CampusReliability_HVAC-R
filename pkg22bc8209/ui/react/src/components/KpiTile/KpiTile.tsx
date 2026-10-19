/*
 * KpiTile — one headline number (FRONTEND §6).
 *
 * Value ≥ 40px for the projector, sentence-case label, optional unit, optional delta
 * (arrow + "vs yesterday"; colour = direction × whether up is good, i.e. status
 * meaning), optional sub-line and a ProvenanceChip slot. Handles its own loading and
 * error states so a KPI row never shows a blank tile.
 */

import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { Skeleton } from '@/components/Panel/Panel';
import type { Provenance } from '@/shared/api';

export interface KpiDelta {
  /** Signed change vs the comparison period. */
  value: number;
  /** e.g. "vs yesterday". */
  vsLabel?: string;
  /** When true (default) an increase is coloured as worse. */
  upIsBad?: boolean;
}

export interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  /** Small unit after the value, e.g. "days". */
  unit?: string;
  sub?: React.ReactNode;
  delta?: KpiDelta;
  chip?: Provenance;
  chipTitle?: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

function DeltaLine({ delta }: { delta: KpiDelta }) {
  const { value, vsLabel = 'vs yesterday', upIsBad = true } = delta;
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const worse = (direction === 'up' && upIsBad) || (direction === 'down' && !upIsBad);
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const text = direction === 'flat' ? 'No change' : `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[14px] font-medium leading-5',
        direction === 'flat'
          ? 'text-[var(--bib-ink-muted)]'
          : worse
            ? 'text-[var(--bib-status-due)]'
            : 'text-[var(--bib-status-healthy)]',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {text}
      <span className="font-normal text-[var(--bib-ink-muted)]">{vsLabel}</span>
    </span>
  );
}

export default function KpiTile({
  label,
  value,
  unit,
  sub,
  delta,
  chip,
  chipTitle,
  loading = false,
  error = null,
  className,
}: KpiTileProps) {
  return (
    <Card variant="outlined" size="md" className={cn('min-w-0 gap-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
          {label}
        </span>
        {chip ? <ProvenanceChip kind={chip} size="sm" title={chipTitle} /> : null}
      </div>

      {loading ? (
        <Skeleton className="h-[44px] w-2/3" />
      ) : error ? (
        <p className="text-[15px] leading-5 text-[var(--c3-style-basic-fg-danger)]">{error}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[40px] font-semibold leading-[44px] tracking-[-0.01em] text-[var(--bib-ink)]">{value}</span>
          {unit ? <span className="text-[18px] font-medium text-[var(--bib-ink-muted)]">{unit}</span> : null}
        </div>
      )}

      {!loading && !error && delta ? <DeltaLine delta={delta} /> : null}
      {sub && !loading ? <p className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">{sub}</p> : null}
    </Card>
  );
}
