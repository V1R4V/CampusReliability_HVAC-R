/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import type { CSSProperties } from 'react';
import type { AssetStatus, ProvenanceKind, WorkOrderStatus } from '@/Interfaces';

/**
 * TEMPORARY design tokens — docs/FRONTEND.md §2.
 *
 * Arnav owns the real design tokens, `StatusPill` and `ProvenanceChip`. Until
 * those land, every Anuva-owned component (RiskChart, Sparkline, SignalBars,
 * WorkOrderCard, the Asset/Building/WorkOrders pages, AgentDrawer) reads the
 * hex values straight from here instead of inventing its own. When his tokens
 * ship, swap the imports below for his components in one pass — do not fork
 * this file or duplicate the hex values elsewhere.
 */
export const STATUS_COLOR: Record<AssetStatus, string> = {
  HEALTHY: '#2E7D32',
  WATCH: '#F59E0B',
  INSPECTION_DUE: '#DC2626',
  FAILED: '#111827',
};

export const STATUS_LABEL: Record<AssetStatus, string> = {
  HEALTHY: 'Healthy',
  WATCH: 'Watch',
  INSPECTION_DUE: 'Inspection due',
  FAILED: 'Failed',
};

export const WORK_ORDER_COLOR: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: '#2563EB',
  APPROVED: '#2563EB',
  DISMISSED: '#6B7280',
};

export const WORK_ORDER_LABEL: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  DISMISSED: 'Dismissed',
};

export const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  REAL: 'REAL',
  SYNTHETIC: 'SYNTHETIC',
  ESTIMATE: 'ESTIMATE',
};

export const INK = '#111827';
export const INK_MUTED = '#6B7280';
export const SURFACE = '#FFFFFF';
export const CANVAS = '#F7F7F5';
export const BORDER = '#E5E7EB';

/**
 * Small status tag — stand-in for Arnav's `StatusPill`. Renders the enum in
 * words (per FRONTEND §2: "Status pill text is the enum in words"), colored
 * by status, optionally filled (solid) vs outlined.
 */
export function statusTagStyle(color: string, solid: boolean): CSSProperties {
  return solid
    ? { backgroundColor: color, color: '#FFFFFF', borderColor: color }
    : { backgroundColor: 'transparent', color, borderColor: color };
}
