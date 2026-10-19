/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import type { AssetStatus, WorkOrderStatus } from '@/Interfaces';

/**
 * Colour tokens for Anuva's SVG-heavy components (RiskChart, Sparkline, SignalBars).
 *
 * Every value is a CSS `var()` reference to Arnav's `--bib-*` tokens
 * (styles/before-it-breaks.css), so charts follow light / night mode automatically —
 * Recharts passes these straight through to SVG `stroke`/`fill`, which accept `var()`.
 * Never put raw hex here; add a token to the stylesheet instead (FRONTEND §2: colour
 * means status and nothing else).
 */
export const STATUS_COLOR: Record<AssetStatus, string> = {
  HEALTHY: 'var(--bib-status-healthy)',
  WATCH: 'var(--bib-status-watch)',
  INSPECTION_DUE: 'var(--bib-status-due)',
  FAILED: 'var(--bib-status-failed)',
};

/** Work orders: outline = pending approval, solid = approved (FRONTEND §2). */
export const WORK_ORDER_COLOR: Record<WorkOrderStatus, string> = {
  PENDING_APPROVAL: 'var(--bib-wo)',
  APPROVED: 'var(--bib-wo)',
  DISMISSED: 'var(--bib-ink-muted)',
};

export const INK = 'var(--bib-ink)';
export const INK_MUTED = 'var(--bib-ink-muted)';
export const SURFACE = 'var(--bib-surface)';
export const CANVAS = 'var(--bib-canvas)';
export const BORDER = 'var(--bib-border)';
export const GRID = 'var(--bib-grid)';
export const AXIS = 'var(--bib-axis)';
/** Single-hue magnitude marks (contribution bars, sensor bands) — identity-neutral. */
export const SERIES_1 = 'var(--bib-series-1)';
