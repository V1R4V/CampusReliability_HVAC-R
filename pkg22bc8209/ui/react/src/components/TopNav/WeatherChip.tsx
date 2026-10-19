/*
 * WeatherChip — the real NOAA daily high for the as-of date, with its label
 * (cold snap / heat / normal) and a REAL chip (FRONTEND §4). Reads the shared
 * campus snapshot, so it never fires its own request.
 */

import React from 'react';
import { CloudSun, Snowflake, Sun, type LucideIcon } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipSubtitle,
  TooltipText,
  TooltipTitle,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { Skeleton } from '@/components/Panel/Panel';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate } from '@/shared/api';

function iconFor(label: string, tmax: number): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('cold') || lower.includes('snap') || lower.includes('freez') || tmax <= 32) return Snowflake;
  if (lower.includes('hot') || lower.includes('heat') || tmax >= 85) return Sun;
  return CloudSun;
}

function titleCase(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export default function WeatherChip() {
  const { snapshot, snapshotLoading, snapshotError } = useAsOf();

  if (!snapshot) {
    if (snapshotLoading) return <Skeleton className="h-9 w-[168px]" />;
    return (
      <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
        {snapshotError ? 'Weather unavailable' : ''}
      </span>
    );
  }

  const weather = snapshot.weather;
  const Icon = iconFor(weather.label ?? '', weather.tmax_f);
  const high = Math.round(weather.tmax_f);
  const low = Math.round(weather.tmin_f);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Weather on ${formatDate(snapshot.as_of)}: high ${high}°F, ${weather.label}`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[var(--bib-border)] bg-[var(--bib-surface)] px-3 outline-none hover:bg-[var(--c3-style-basic-bg-hover)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
        >
          <Icon className="size-5 text-[var(--bib-ink-muted)]" aria-hidden />
          <span className="text-[16px] font-semibold leading-5 text-[var(--bib-ink)]">{high}°F</span>
          <span className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">{titleCase(weather.label ?? '')}</span>
          <ProvenanceChip kind="REAL" size="sm" title={weather.source} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipText>
          <TooltipTitle>
            High {high}°F · Low {low}°F · {formatDate(snapshot.as_of)}
          </TooltipTitle>
          <TooltipSubtitle>{weather.source}</TooltipSubtitle>
        </TooltipText>
      </TooltipContent>
    </Tooltip>
  );
}
