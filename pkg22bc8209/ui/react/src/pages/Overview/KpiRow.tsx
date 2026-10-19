/*
 * KpiRow — the four headline numbers on the Overview (FRONTEND §5.1), straight from
 * `campusSnapshot.kpis`. Delta arrow only on inspection due; dollar figures are
 * labelled ESTIMATE because they rest on stated assumptions.
 */

import React from 'react';

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
  loading: boolean;
  error: string | null;
}

export default function KpiRow({ kpis, pendingWorkOrders, loading, error }: KpiRowProps) {
  const workOrders = `${pendingWorkOrders} work order${pendingWorkOrders === 1 ? '' : 's'} awaiting approval`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Inspection due"
        value={kpis ? formatNumber(kpis.inspection_due) : '—'}
        delta={kpis ? { value: kpis.inspection_due_delta, vsLabel: 'vs yesterday', upIsBad: true } : undefined}
        sub={kpis ? `${kpis.failed} failed · ${workOrders}` : undefined}
        chip="SYNTHETIC"
        chipTitle="Counted from risk computed on synthetic sensor data."
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Watch"
        value={kpis ? formatNumber(kpis.watch) : '—'}
        sub={`Risk ≥ ${WATCH_THRESHOLD.toFixed(1)} but not yet persistent`}
        chip="SYNTHETIC"
        chipTitle="Counted from risk computed on synthetic sensor data."
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Energy waste"
        value={kpis ? formatUsd(kpis.energy_waste_usd_per_day) : '—'}
        unit="/day"
        sub={
          kpis
            ? `${kpis.assets_over_5pct_energy} assets >5% over weather-expected · $${ENERGY_USD_PER_KWH.toFixed(2)}/kWh`
            : undefined
        }
        chip="ESTIMATE"
        chipTitle="Excess kWh over the weather-normalised baseline × $0.10/kWh (assumption)."
        loading={loading}
        error={error}
      />
      <KpiTile
        label="Cooling exposure"
        value={kpis ? formatUsd(kpis.cooling_exposure_usd_per_day) : '—'}
        unit="/day"
        sub={`Rental chillers if at-risk cooling fails · $${formatNumber(CHILLER_RENTAL_USD_PER_DAY)}/chiller/day`}
        chip="ESTIMATE"
        chipTitle="$10M ÷ ~30 chillers ÷ ~90 days ≈ $3,704 per rental chiller per day."
        loading={loading}
        error={error}
      />
    </div>
  );
}
