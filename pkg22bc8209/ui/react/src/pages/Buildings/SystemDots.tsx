/*
 * SystemDots — a building's three systems at a glance (FRONTEND §5.2): cooling · heating ·
 * air as icons (identity) with a status-coloured dot each (state), and the status spelled
 * out for screen readers and on hover. A system with no tracked asset shows a hollow grey
 * dot and says "not tracked" — never a blank.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { statusLabel } from '@/components/StatusPill/StatusPill';
import SystemIcon, { systemLabel } from '@/components/SystemIcon/SystemIcon';
import { formatRisk, type System } from '@/shared/api';
import { SYSTEMS, type BuildingRow } from './buildingRows';

export interface SystemDotsProps {
  row: BuildingRow;
  /** The system currently filtered on — drawn with a soft ring. */
  emphasis?: System | null;
  className?: string;
}

export default function SystemDots({ row, emphasis = null, className }: SystemDotsProps) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)} aria-label="System status">
      {SYSTEMS.map((system) => {
        const summary = row.systems[system];
        const status = summary ? summary.status : 'OFFLINE';
        const text = summary
          ? `${systemLabel(system)}: ${statusLabel(summary.status)} · risk ${formatRisk(summary.risk)} · via ${summary.viaAssetId}`
          : `${systemLabel(system)}: not tracked`;
        return (
          <li
            key={system}
            data-status={status}
            title={text}
            className={cn(
              'inline-flex items-center gap-1 rounded-full',
              emphasis === system && 'bg-[var(--bib-canvas)] px-1.5 py-0.5 shadow-[0_0_0_1px_var(--bib-border)]',
            )}
          >
            <SystemIcon system={system} size="sm" className={cn(!summary && 'opacity-50')} />
            <span
              aria-hidden
              className={cn(
                'block size-2.5 rounded-full',
                summary ? 'bg-[var(--bib-status-color)]' : 'border border-dashed border-[var(--bib-status-offline)]',
              )}
            />
            <span className="sr-only">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
