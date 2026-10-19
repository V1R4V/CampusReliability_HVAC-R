/*
 * Work-order list hygiene (FRONTEND §5.6). The seed resets an approved work order to pending
 * and the agent drafts a fresh one for the same asset, so the raw list carries duplicates.
 * Pure module so Jest can test it; pages/WorkOrders/WorkOrders.tsx consumes it.
 */

import type { WorkOrder } from '@/Interfaces';

/**
 * One card per asset and status: keep the most recently drafted (highest WO number on a
 * tie), newest first. Rows without an asset fall back to their title as the key.
 */
export function dedupe(rows: WorkOrder[]): WorkOrder[] {
  const byKey = new Map<string, WorkOrder>();
  rows.forEach((wo) => {
    const key = `${wo.status}|${wo.asset_id || wo.title}`;
    const current = byKey.get(key);
    if (!current || wo.drafted_on > current.drafted_on || (wo.drafted_on === current.drafted_on && wo.wo_id > current.wo_id)) {
      byKey.set(key, wo);
    }
  });
  return Array.from(byKey.values()).sort((a, b) => b.drafted_on.localeCompare(a.drafted_on) || b.wo_id.localeCompare(a.wo_id));
}
