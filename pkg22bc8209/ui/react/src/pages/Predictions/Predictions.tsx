/*
 * Predictions: how likely each asset is to fail in the next 14 days (ML.md §8).
 *
 * One number per asset (the consensus of three condition-based methods), the range the
 * methods disagree over, and days to failure where a method produces one. The per-method
 * columns are off by default; a switch shows them. Three headline cards name the asset
 * most likely to fail in each system. Cards can be dragged into your own order.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Snowflake, Wind } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { Panel, PanelState } from '@/components/Panel/Panel';
import Reorderable from '@/components/Reorderable/Reorderable';
import StatusPill from '@/components/StatusPill/StatusPill';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate } from '@/shared/api';
import { fetchRiskForecastCampus } from '@/shared/api/forecast';
import type { ForecastCampusAsset, RiskForecastCampus, SystemType } from '@/Interfaces';
import { METHOD_COLOR, METHOD_SHORT, formatProbability, probabilityColor } from '@/components/ForecastPanel/useRiskForecast';

const MAX_ROWS = 100;
type SystemFilter = 'all' | SystemType;
const SYSTEMS: SystemType[] = ['cooling', 'heating', 'air'];
const SYSTEM_LABEL: Record<SystemType, string> = { cooling: 'Cooling', heating: 'Heating', air: 'Air handling' };
const SYSTEM_ICON: Record<SystemType, React.ComponentType<{ className?: string }>> = {
  cooling: Snowflake,
  heating: Flame,
  air: Wind,
};
const CONDITION_METHODS = ['heuristic', 'classifier', 'monte_carlo'] as const;

function Pct({ value, bold = false }: { value: number | null; bold?: boolean }) {
  return (
    <span className={bold ? 'font-semibold tabular-nums' : 'tabular-nums'} style={{ color: probabilityColor(value) }}>
      {formatProbability(value)}
    </span>
  );
}

/** Lowest and highest 14-day probability among the three condition-based methods. */
function methodRange(a: ForecastCampusAsset): { lo: number; hi: number } | null {
  const values = CONDITION_METHODS.map((m) => a[`${m}_14d`]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return { lo: Math.min(...values), hi: Math.max(...values) };
}

function daysLabel(days: number | null): string {
  if (days == null) return '';
  return days < 1 ? 'under a day' : `about ${Math.round(days)} days`;
}

function SystemSummary({ system, assets }: { system: SystemType; assets: ForecastCampusAsset[] }) {
  const Icon = SYSTEM_ICON[system];
  const top = assets[0];
  return (
    <Card variant="outlined" size="md" className="h-full gap-2">
      <div className="flex items-center gap-2 pr-7 text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
        <Icon className="size-4" aria-hidden /> {SYSTEM_LABEL[system]}
        <span className="font-normal normal-case tracking-normal">· {assets.length} assets</span>
      </div>
      {!top ? (
        <p className="text-[15px] text-[var(--bib-ink-muted)]">No assets tracked</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              to={`/asset/${top.asset_id}`}
              className="truncate text-[17px] font-semibold leading-6 text-[var(--bib-ink)] underline-offset-2 hover:underline"
              title={top.name}
            >
              {top.name}
            </Link>
            <span className="text-[40px] font-semibold leading-[44px] tabular-nums" style={{ color: probabilityColor(top.consensus_14d) }}>
              {formatProbability(top.consensus_14d)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
            <span>chance of failure within 14 days</span>
            {top.days_to_failure_p50 != null ? <span>· likely in {daysLabel(top.days_to_failure_p50)}</span> : null}
          </div>
          {top.status ? <StatusPill status={top.status} size="sm" /> : null}
        </>
      )}
    </Card>
  );
}

export default function Predictions() {
  const { asOf } = useAsOf();
  const { reportError } = useErrorReporter();
  const [data, setData] = useState<RiskForecastCampus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SystemFilter>('all');
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRiskForecastCampus(asOf)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load predictions.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, reportError]);

  const bySystem = useMemo(() => {
    const out: Record<SystemType, ForecastCampusAsset[]> = { cooling: [], heating: [], air: [] };
    (data?.assets ?? []).forEach((a) => {
      if (out[a.system]) out[a.system].push(a);
    });
    return out;
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.assets ?? [];
    return (filter === 'all' ? all : all.filter((a) => a.system === filter)).slice(0, MAX_ROWS);
  }, [data, filter]);

  const elevated = useMemo(() => (data?.assets ?? []).filter((a) => (a.consensus_14d ?? 0) >= 0.2).length, [data]);

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Predictions</h1>
          <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            Chance each asset fails within 14 days, as of{' '}
            <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
            {data ? `. ${elevated} of ${data.assets.length} assets above 20%.` : '.'}
          </p>
        </div>
        <label className="flex items-center gap-3 text-[15px] leading-5 text-[var(--bib-ink)]">
          <Switch id="bib-show-methods" checked={showMethods} onCheckedChange={setShowMethods} />
          Show the four methods
        </label>
      </header>

      {loading ? (
        <PanelState state="loading" lines={6} />
      ) : error || !data ? (
        <PanelState state="error" message={error ?? undefined} />
      ) : data.assets.length === 0 ? (
        <PanelState state="empty" message={`No predictions for ${formatDate(asOf)}. Pick a date inside Jan 1 to Aug 31, 2026.`} />
      ) : (
        <Reorderable
          storageKey="predictions"
          className="grid gap-4 xl:grid-cols-3"
          items={[
            ...SYSTEMS.map((s) => ({ id: `system-${s}`, node: <SystemSummary system={s} assets={bySystem[s]} /> })),
            {
              id: 'table',
              className: 'xl:col-span-3',
              node: (
                <Panel
                  title="All assets"
                  subtitle="Ranked by chance of failure within 14 days"
                  actions={
                    <Tabs value={filter} onValueChange={(v) => setFilter(v as SystemFilter)} size="sm">
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="cooling">Cooling</TabsTrigger>
                        <TabsTrigger value="heating">Heating</TabsTrigger>
                        <TabsTrigger value="air">Air</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  }
                  contentClassName="-mx-4 -mb-4"
                >
                  <Table size="sm" hover>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Fails within 14 days</TableHead>
                        {showMethods ? (
                          <>
                            {CONDITION_METHODS.map((m) => (
                              <TableHead key={m} className="text-right">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: METHOD_COLOR[m] }} aria-hidden />
                                  {METHOD_SHORT[m]}
                                </span>
                              </TableHead>
                            ))}
                            <TableHead className="text-right">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: METHOD_COLOR.weibull }} aria-hidden />
                                {METHOD_SHORT.weibull}
                              </span>
                            </TableHead>
                          </>
                        ) : (
                          <TableHead className="text-right">Methods range</TableHead>
                        )}
                        <TableHead className="text-right">Likely when</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((a) => {
                        const range = methodRange(a);
                        return (
                          <TableRow key={a.asset_id}>
                            <TableCell>
                              <Link to={`/asset/${a.asset_id}`} className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline">
                                {a.name}
                              </Link>
                              <div className="text-[12px] text-[var(--bib-ink-muted)]">{a.asset_id}</div>
                            </TableCell>
                            <TableCell>{SYSTEM_LABEL[a.system] ?? a.system}</TableCell>
                            <TableCell>{a.status ? <StatusPill status={a.status} size="sm" /> : null}</TableCell>
                            <TableCell className="text-right text-[16px]">
                              <Pct value={a.consensus_14d} bold />
                            </TableCell>
                            {showMethods ? (
                              <>
                                {CONDITION_METHODS.map((m) => (
                                  <TableCell key={m} className="text-right">
                                    <Pct value={a[`${m}_14d`]} />
                                  </TableCell>
                                ))}
                                <TableCell className="text-right">
                                  <Pct value={a.weibull_14d} />
                                </TableCell>
                              </>
                            ) : (
                              <TableCell className="text-right tabular-nums text-[var(--bib-ink-muted)]">
                                {range ? `${formatProbability(range.lo)} to ${formatProbability(range.hi)}` : ''}
                              </TableCell>
                            )}
                            <TableCell className="text-right text-[var(--bib-ink-muted)]">{daysLabel(a.days_to_failure_p50)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Panel>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
