/*
 * StatusPill — the one status indicator used everywhere (FRONTEND §2).
 *
 * Text is the enum in words (Healthy · Watch · Inspection due · Failed); colour comes
 * from the [data-status] tokens in styles/before-it-breaks.css, so this is the only
 * place the status→colour mapping is spelled out. Unknown values render as Offline.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { STATUS_LABEL, type Status } from '@/shared/api';

export type PillStatus = Status | 'OFFLINE';

export interface StatusPillProps {
  status: PillStatus | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  /** Override the label (e.g. "Cooling lost"). */
  label?: string;
  className?: string;
}

export function normalizeStatus(status: string | null | undefined): PillStatus {
  if (status === 'HEALTHY' || status === 'WATCH' || status === 'INSPECTION_DUE' || status === 'FAILED') {
    return status;
  }
  return 'OFFLINE';
}

export function statusLabel(status: string | null | undefined): string {
  const normalized = normalizeStatus(status);
  return normalized === 'OFFLINE' ? 'Offline' : STATUS_LABEL[normalized];
}

export default function StatusPill({ status, size = 'md', label, className }: StatusPillProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={cn('bib-pill', className)} data-status={normalized} data-size={size}>
      {label ?? statusLabel(normalized)}
    </span>
  );
}
