/*
 * KpiRow — the four headline numbers on the Overview (FRONTEND §5.1), straight from
 * `campusSnapshot.kpis`. Delta arrow only on inspection due; the two status counts
 * paint their tile edge in the status colour when they are non-zero.
 */

import React from 'react';
import { Eye, ShieldAlert, Snowflake, Zap } from 'lucide-react';

import KpiTile from '@/components/KpiTile/KpiTile';
import {
  CHILLER_RENTAL_USD_PER_DAY,
  ENERGY_USD_PER_KWH,
  WATCH_THRESHOLD,
  formatNumber,
  formatUsd,
  type SnapshotKpis,
} from '@/shared/api';

export interface KpiRowProps {
  kpis: SnapshotKpis | null;
  pendingWorkOrders: number;
  /** Buildings whose worst system is INSPECTION_DUE — one asset can put nine buildings at risk. */
  buildingsDue?: number;
  loading: boolean;
  error: string | null;
}

export default function KpiRow({ kpis, pendingWorkOrders, buildingsDue = 0, loading, error }: KpiRowProps) {
  const workOrders = `${pendingWorkOrders} work order${pendingWorkOrders === 1 ? '' : 's'} awaiting approval`;
  const dueSub = kpis
    ? `${kpis.inspection_due === 1 ? '1 asset' : `${kpis.inspection_due} assets`} · ${buildingsDue} ${buildingsDue === 1 ? 'building' : 'buildings'} affected · ${workOrders}`
    : undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Inspection due"
        value={kpis ? formatNumber(kpis.inspection_due) : '—'}
        icon={<ShieldAlert />}
        tone={kpis && kpis.inspection_due > 0 ? 'INSPECTION_DUE' : 'neutral'}
        delta={kpis ? { value: kpis.inspection_due_delta, vsLabel: 'vs yesterday', upIsBad: true } : undefined}
        sub={dueSub}
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Watch"
        value={kpis ? formatNumber(kpis.watch) : '—'}
        icon={<Eye />}
        tone={kpis && kpis.watch > 0 ? 'WATCH' : 'neutral'}
        sub={`Risk ≥ ${WATCH_THRESHOLD.toFixed(1)}, under the inspection threshold`}
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Energy waste"
        value={kpis ? formatUsd(kpis.energy_waste_usd_per_day) : '—'}
        unit="/day"
        icon={<Zap />}
        sub={
          kpis
            ? `${kpis.assets_over_5pct_energy} assets >5% over weather-expected · $${ENERGY_USD_PER_KWH.toFixed(2)}/kWh`
            : undefined
        }
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Cooling exposure"
        value={kpis ? formatUsd(kpis.cooling_exposure_usd_per_day) : '—'}
        unit="/day"
        icon={<Snowflake />}
        sub={`Rental chillers if at-risk cooling fails, sized at peak load (95°F design day) · $${formatNumber(CHILLER_RENTAL_USD_PER_DAY)}/chiller/day`}
        loading={loading}
        error={error}
      />
    </div>
  );
}
