/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import type { ReactNode } from 'react';
import { ProvenanceTag } from '@/components/RiskChart/Tags';
import type { ProvenanceKind } from '@/Interfaces';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Change vs. the previous day; rendered as ▲/▼ with sign. */
  delta?: number | null;
  /** Status color for the value (FRONTEND §2: color means status only — omit for neutral figures). */
  color?: string;
  chip?: ProvenanceKind;
}

/** Headline number tile (docs/FRONTEND.md §6) — projector-sized value, one-line context underneath. */
export default function KpiTile({ label, value, sub, delta, color, chip }: KpiTileProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
        {chip ? <ProvenanceTag kind={chip} /> : null}
      </div>
      <div className="text-[40px] font-semibold leading-none tabular-nums" style={{ color: color ?? '#111827' }}>
        {value}
      </div>
      <div className="flex min-h-[20px] items-center gap-2 text-sm text-[#6B7280]">
        {delta != null && delta !== 0 ? (
          <span className="font-medium tabular-nums text-[#374151]">
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs. yesterday
          </span>
        ) : null}
        {sub}
      </div>
    </div>
  );
}
