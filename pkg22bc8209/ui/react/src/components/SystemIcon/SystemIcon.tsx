/*
 * SystemIcon — equipment systems are distinguished by Lucide icons, never by colour
 * (FRONTEND §2). Covers the contract's three systems (cooling · heating · air) and
 * tolerates future ones (electrical, plumbing) with a sensible fallback glyph.
 */

import React from 'react';
import { CircleDashed, Droplets, Flame, Snowflake, Wind, Zap, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
  air_handling: Wind,
  electrical: Zap,
  plumbing: Droplets,
};

const LABELS: Record<string, string> = {
  cooling: 'Cooling',
  heating: 'Heating',
  air: 'Air handling',
  air_handling: 'Air handling',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
};

const SIZES = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
} as const;

export function systemLabel(system: string | null | undefined): string {
  const key = (system ?? '').toLowerCase();
  if (LABELS[key]) return LABELS[key];
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Unknown system';
}

export interface SystemIconProps {
  system: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Render the system name next to the glyph. */
  withLabel?: boolean;
  className?: string;
}

export default function SystemIcon({ system, size = 'md', withLabel = false, className }: SystemIconProps) {
  const Icon = ICONS[(system ?? '').toLowerCase()] ?? CircleDashed;
  const label = systemLabel(system);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-[var(--bib-ink-muted)]', className)}
      title={withLabel ? undefined : label}
    >
      <Icon className={SIZES[size]} role="img" aria-label={label} />
      {withLabel ? <span className="text-[14px] text-[var(--bib-ink)]">{label}</span> : null}
    </span>
  );
}
