/*
 * One live card per asset, and the replay clock: a draft dated after the as-of date does not
 * exist yet from the manager's point of view.
 */

import type { WorkOrder } from '@/Interfaces';
import { dedupe, knownBy } from '../dedupe';

function wo(partial: Partial<WorkOrder> & Pick<WorkOrder, 'wo_id' | 'status' | 'drafted_on'>): WorkOrder {
  return {
    asset_id: 'S3-PIPE',
    building_ids: [],
    title: 'Inspect chilled water main, segment S3',
    description: '',
    priority: 1,
    crew: 'Utilities – Piping',
    est_hours: 6,
    drafted_by: 'agent',
    approved_by: null,
    approved_on: null,
    dismiss_reason: null,
    ...partial,
  };
}

describe('dedupe', () => {
  it('lets an approved order supersede a stale pending draft for the same asset', () => {
    const rows = [
      wo({ wo_id: 'WO 26-071221', status: 'PENDING_APPROVAL', drafted_on: '2026-06-08' }),
      wo({ wo_id: 'WO 26-071213', status: 'APPROVED', drafted_on: '2026-06-09', approved_by: 'Facilities manager', approved_on: '2026-06-09' }),
    ];
    expect(dedupe(rows).map((r) => r.wo_id)).toEqual(['WO 26-071213']);
  });

  it('keeps only the newest pending draft per asset, newest first overall', () => {
    const rows = [
      wo({ wo_id: 'WO 26-071210', status: 'PENDING_APPROVAL', drafted_on: '2026-06-07' }),
      wo({ wo_id: 'WO 26-071221', status: 'PENDING_APPROVAL', drafted_on: '2026-06-08' }),
      wo({ wo_id: 'WO 26-070118', status: 'APPROVED', drafted_on: '2026-01-21', asset_id: 'VIL-UH-2' }),
    ];
    expect(dedupe(rows).map((r) => r.wo_id)).toEqual(['WO 26-071221', 'WO 26-070118']);
  });

  it('keeps dismissed orders per asset and does not cross assets', () => {
    const rows = [
      wo({ wo_id: 'WO 26-070342', status: 'DISMISSED', drafted_on: '2026-03-03', asset_id: 'CHA-CHL-1', dismiss_reason: 'Spike cleared' }),
      wo({ wo_id: 'WO 26-071213', status: 'PENDING_APPROVAL', drafted_on: '2026-06-09' }),
    ];
    expect(dedupe(rows)).toHaveLength(2);
  });
});

describe('knownBy', () => {
  it('hides drafts dated after the as-of date and counts them', () => {
    const rows = [
      wo({ wo_id: 'WO 26-071213', status: 'PENDING_APPROVAL', drafted_on: '2026-06-09' }),
      wo({ wo_id: 'WO 26-070118', status: 'APPROVED', drafted_on: '2026-01-21', asset_id: 'VIL-UH-2' }),
    ];
    const january = knownBy(rows, '2026-01-25');
    expect(january.shown.map((r) => r.wo_id)).toEqual(['WO 26-070118']);
    expect(january.hiddenFuture).toBe(1);
    expect(knownBy(rows, '2026-06-09').hiddenFuture).toBe(0);
  });
});
