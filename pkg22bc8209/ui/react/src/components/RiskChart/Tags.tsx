/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import type { AssetStatus, ProvenanceKind, WorkOrderStatus } from '@/Interfaces';
import { PROVENANCE_LABEL, STATUS_COLOR, STATUS_LABEL, WORK_ORDER_COLOR, WORK_ORDER_LABEL } from './statusColors';

/**
 * TEMPORARY stand-ins for Arnav's `StatusPill` / `ProvenanceChip` (docs/FRONTEND.md §6).
 * Colored/outlined text tag, enum spelled out in words per FRONTEND §2. Swap
 * every usage for his real components once they ship — do not fork further.
 */
export function StatusTag({ status, size = 'md' }: { status: AssetStatus; size?: 'sm' | 'md' }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
      style={{ borderColor: color, color, backgroundColor: `${color}14` }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function WorkOrderStatusTag({ status, size = 'md' }: { status: WorkOrderStatus; size?: 'sm' | 'md' }) {
  const color = WORK_ORDER_COLOR[status];
  const solid = status === 'APPROVED';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
      style={
        solid
          ? { backgroundColor: color, borderColor: color, color: '#FFFFFF' }
          : { borderColor: color, color, backgroundColor: status === 'DISMISSED' ? `${color}14` : 'transparent' }
      }
    >
      {WORK_ORDER_LABEL[status]}
    </span>
  );
}

export function ProvenanceTag({ kind }: { kind: ProvenanceKind }) {
  const tone =
    kind === 'REAL'
      ? { fg: '#2E7D32', bg: '#2E7D3214' }
      : kind === 'SYNTHETIC'
        ? { fg: '#6B7280', bg: '#6B728014' }
        : { fg: '#F59E0B', bg: '#F59E0B14' };
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap"
      style={{ color: tone.fg, backgroundColor: tone.bg }}
    >
      {PROVENANCE_LABEL[kind]}
    </span>
  );
}
