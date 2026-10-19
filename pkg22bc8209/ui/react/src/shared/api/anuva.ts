/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { c3Action, c3MemberAction } from '@/c3Action';
import type { AskResponse, AssetHistory, Briefing, BuildingDashboard, WorkOrder, WorkOrderStatus } from '@/Interfaces';

/**
 * Anuva's data-access functions — Building dashboard, Asset detail, Work
 * Orders, Agent drawer. One function per docs/CONTRACT.md §5.2 call; her
 * pages import from here and never call `c3Action` directly (brief §7).
 */

/** `BuildingDashboard.compute(building_id, as_of)`. */
export async function fetchBuildingDashboard(buildingId: string, asOf: string): Promise<BuildingDashboard> {
  return c3Action('BuildingDashboard', 'compute', [buildingId, asOf]);
}

/** `AssetHistory.get(asset_id)`. */
export async function fetchAssetHistory(assetId: string): Promise<AssetHistory> {
  return c3Action('AssetHistory', 'get', [assetId]);
}

/** `Briefing.generate(asset_id, as_of)` — also drafts a PENDING_APPROVAL work order server-side. */
export async function fetchBriefing(assetId: string, asOf: string): Promise<Briefing> {
  return c3Action('Briefing', 'generate', [assetId, asOf]);
}

/** Raw shape of a built-in `WorkOrder.fetch` row — platform id/ref, not the contract's flat keys. */
interface RawWorkOrderRow {
  id: string;
  asset?: { id: string } | null;
  building_ids?: string[];
  title: string;
  description: string;
  priority: number;
  crew: string;
  est_hours: number;
  status: WorkOrderStatus;
  drafted_by: string;
  drafted_on: string;
  approved_by: string | null;
  approved_on: string | null;
  dismiss_reason: string | null;
}

/**
 * Built-in `WorkOrder.fetch`, remapped from platform keys to the contract's
 * flat shape (CONTRACT §5.2: `id` → `wo_id`, `asset.id` → `asset_id`).
 */
export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const response = await c3Action('WorkOrder', 'fetch', [
    { include: 'this, asset.id', limit: -1, order: 'descending(drafted_on)' },
  ]);
  const rows: RawWorkOrderRow[] = response?.objs ?? [];
  return rows.map((row) => ({
    wo_id: row.id,
    asset_id: row.asset?.id ?? '',
    building_ids: row.building_ids ?? [],
    title: row.title,
    description: row.description,
    priority: row.priority,
    crew: row.crew,
    est_hours: row.est_hours,
    status: row.status,
    drafted_by: row.drafted_by,
    drafted_on: row.drafted_on,
    approved_by: row.approved_by,
    approved_on: row.approved_on,
    dismiss_reason: row.dismiss_reason,
  }));
}

/**
 * Member `WorkOrder.approve(approver)`. Callers should re-fetch/optimistically
 * update rather than rely on the resolved value's shape (member actions
 * return the platform entity, not the contract's flat JSON).
 */
export async function approveWorkOrder(woId: string, approver: string): Promise<void> {
  await c3MemberAction('WorkOrder', 'approve', { id: woId }, [approver]);
}

/** Member `WorkOrder.dismiss(reason)`. */
export async function dismissWorkOrder(woId: string, reason: string): Promise<void> {
  await c3MemberAction('WorkOrder', 'dismiss', { id: woId }, [reason]);
}

/** `FacilitiesAgent.ask(question, as_of)`. */
export async function askAgent(question: string, asOf: string): Promise<AskResponse> {
  return c3Action('FacilitiesAgent', 'ask', [question, asOf]);
}
