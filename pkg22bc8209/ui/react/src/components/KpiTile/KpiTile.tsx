/*
 * KpiTile — one headline number (FRONTEND §6).
 *
 * Value ≥ 40px for the projector, uppercase eyebrow label, optional unit, optional
 * icon tile, optional delta pill (arrow + "vs yesterday"; colour = direction × whether
 * up is good, i.e. status meaning), optional sub-line. `tone` paints a thin status bar
 * down the left edge — only when the number itself *is* a status count (inspection
 * due, watch), never as decoration. Handles its own loading and error states so a KPI
 * row never shows a blank tile.
 */

import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { Skeleton } from '@/components/Panel/Panel';
import type { Provenance, Status } from '@/shared/api';

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
  /** Lucide icon shown in a tile at the top-right. */
  icon?: React.ReactNode;
  /** Status the number counts — paints the left edge in that status colour. */
  tone?: Status | 'neutral';
  chip?: Provenance;
  chipTitle?: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

function DeltaPill({ delta }: { delta: KpiDelta }) {
  const { value, vsLabel = 'vs yesterday', upIsBad = true } = delta;
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const worse = (direction === 'up' && upIsBad) || (direction === 'down' && !upIsBad);
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const text = direction === 'flat' ? 'No change' : `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
      <span
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[13px] font-semibold',
          direction === 'flat'
            ? 'bg-[var(--bib-canvas)] text-[var(--bib-ink-muted)]'
            : worse
              ? 'bg-[var(--bib-status-due-soft)] text-[var(--bib-status-due)]'
              : 'bg-[var(--bib-status-healthy-soft)] text-[var(--bib-status-healthy)]',
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {text}
      </span>
      {vsLabel}
    </span>
  );
}

export default function KpiTile({
  label,
  value,
  unit,
  sub,
  delta,
  icon,
  tone = 'neutral',
  chip,
  chipTitle,
  loading = false,
  error = null,
  className,
}: KpiTileProps) {
  const statusTone = tone !== 'neutral';
  return (
    <div
      data-status={statusTone ? tone : undefined}
      className={cn('bib-card relative flex min-w-0 flex-col gap-2 overflow-hidden p-4 pl-5', className)}
    >
      {statusTone ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] bg-[var(--bib-status-color)]" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <span className="bib-eyebrow pt-1">{label}</span>
        {chip ? <ProvenanceChip kind={chip} size="sm" title={chipTitle} /> : null}
        {icon ? <span className="bib-icon-tile size-9 [&_svg]:size-5">{icon}</span> : null}
      </div>

      {loading ? (
        <Skeleton className="h-[44px] w-2/3" />
      ) : error ? (
        <p className="text-[15px] leading-5 text-[var(--c3-style-basic-fg-danger)]">{error}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="bib-kpi">{value}</span>
          {unit ? <span className="text-[18px] font-medium text-[var(--bib-ink-muted)]">{unit}</span> : null}
        </div>
      )}

      {!loading && !error && delta ? <DeltaPill delta={delta} /> : null}
      {sub && !loading ? <p className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">{sub}</p> : null}
    </div>
  );
}
