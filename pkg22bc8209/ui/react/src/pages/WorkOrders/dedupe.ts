/*
 * Work-order list hygiene (FRONTEND §5.6). The agent may draft more than one order for the
 * same asset over a replay (a visit on an earlier as-of date drafts, a later visit drafts
 * again), so the raw list can carry duplicates. Pure module so Jest can test it;
 * pages/WorkOrders/WorkOrders.tsx consumes it.
 */

import type { WorkOrder } from '@/Interfaces';

/** Sort key: newest draft first, highest WO number on a tie. */
export function compareNewestFirst(a: WorkOrder, b: WorkOrder): number {
  return b.drafted_on.localeCompare(a.drafted_on) || b.wo_id.localeCompare(a.wo_id);
}

/**
 * One live card per asset: an APPROVED order supersedes any PENDING draft for the same asset
 * (the pending one is a stale duplicate, not a second job), and within a status only the most
 * recently drafted row survives. Dismissed orders are kept per asset, newest only. Rows without
 * an asset fall back to their title as the key.
 */
export function dedupe(rows: WorkOrder[]): WorkOrder[] {
  const assetKey = (wo: WorkOrder) => wo.asset_id || wo.title;
  const approvedAssets = new Set(rows.filter((wo) => wo.status === 'APPROVED').map(assetKey));
  const byKey = new Map<string, WorkOrder>();
  rows.forEach((wo) => {
    if (wo.status === 'PENDING_APPROVAL' && approvedAssets.has(assetKey(wo))) return;
    const key = `${wo.status}|${assetKey(wo)}`;
    const current = byKey.get(key);
    if (!current || compareNewestFirst(wo, current) < 0) byKey.set(key, wo);
  });
  return Array.from(byKey.values()).sort(compareNewestFirst);
}

/** Only orders that existed on the replay date — a Jun 9 draft must not show up in January. */
export function knownBy(rows: WorkOrder[], asOf: string): { shown: WorkOrder[]; hiddenFuture: number } {
  const shown = rows.filter((wo) => !wo.drafted_on || wo.drafted_on <= asOf);
  return { shown, hiddenFuture: rows.length - shown.length };
}
