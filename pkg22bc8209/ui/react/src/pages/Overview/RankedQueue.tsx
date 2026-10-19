/*
 * RankedQueue — "Inspect next" (FRONTEND §5.1): the campus queue ranked by status,
 * then risk × impact. Filter by system (icons, never colour); each row links to the
 * asset detail, carries a status pill, days in status, a risk bar with the threshold
 * tick, the driving signal, buildings served, $/day (cooling only) and the work-order
 * pill — or a "Draft work order" action when none exists yet. A thin bar on the left
 * edge of each row wears the asset's status colour.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Panel, PanelState } from '@/components/Panel/Panel';
import StatusPill from '@/components/StatusPill/StatusPill';
import WorkOrderPill from '@/components/StatusPill/WorkOrderPill';
import SystemIcon from '@/components/SystemIcon/SystemIcon';
import type { SystemFilter } from '@/contexts/AsOfProvider';
import { formatDate, formatUsd, withAsOf, type QueueItem } from '@/shared/api';
import RiskBar from './RiskBar';

const FILTERS: { value: SystemFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'heating', label: 'Heating' },
  { value: 'air', label: 'Air' },
];

/** Rows shown before "Show all" — keeps the panel beside the schematic. */
const PAGE_SIZE = 8;

export interface RankedQueueProps {
  queue: QueueItem[];
  asOf: string;
  threshold: number;
  filter: SystemFilter;
  onFilterChange: (filter: SystemFilter) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  icon?: React.ReactNode;
}

function QueueRow({
  item,
  rank,
  threshold,
  asOf,
}: {
  item: QueueItem;
  rank: number;
  threshold: number;
  asOf: string;
}) {
  const assetHref = withAsOf(`/asset/${item.asset_id}`, asOf);
  const attention = item.status !== 'HEALTHY';
  return (
    <div
      data-status={item.status}
      className={cn(
        'relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 rounded-md py-3 pl-4 pr-2',
        attention && 'bg-[var(--bib-status-soft)]/40',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--bib-status-color)]', !attention && 'opacity-40')}
      />
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        <span
          className={cn(
            'bib-num inline-flex size-8 items-center justify-center rounded-full text-[14px] font-semibold',
            rank === 1
              ? 'bg-[var(--bib-ink)] text-white shadow-[0_2px_6px_rgb(17_24_39_/_0.3)]'
              : 'border border-[var(--bib-border)] bg-[var(--bib-surface)] text-[var(--bib-ink)]',
          )}
        >
          {rank}
        </span>
        <SystemIcon system={item.system} size="sm" />
      </div>

      <Link
        to={assetHref}
        className="bib-row-link -m-1 min-w-0 rounded-md p-1 outline-none focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[16px] font-semibold leading-6 text-[var(--bib-ink)]">{item.asset_id}</span>
          <span className="min-w-0 truncate text-[16px] leading-6 text-[var(--bib-ink-soft)]">{item.name}</span>
          <StatusPill status={item.status} size="sm" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
          <RiskBar risk={item.risk} threshold={threshold} status={item.status} />
          <span>
            {item.days_in_status} {item.days_in_status === 1 ? 'day' : 'days'} in status
          </span>
          <span className="font-medium text-[var(--bib-ink)]">{item.driver_label}</span>
          <span>
            {item.buildings_served} {item.buildings_served === 1 ? 'building' : 'buildings'}
          </span>
          {item.cost_per_day_usd != null ? (
            <span className="bib-num font-medium text-[var(--bib-ink)]">{formatUsd(item.cost_per_day_usd, { perDay: true })}</span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-col items-end gap-2 pt-0.5">
        {item.work_order_status ? (
          <WorkOrderPill status={item.work_order_status} size="sm" />
        ) : (
          <Button asChild variant="outline" appearance="secondary" size="sm">
            <Link to={assetHref}>
              Draft work order <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RankedQueue({
  queue,
  asOf,
  threshold,
  filter,
  onFilterChange,
  loading,
  error,
  onRetry,
  icon,
}: RankedQueueProps) {
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => (filter === 'all' ? queue : queue.filter((q) => q.system === filter)), [queue, filter]);
  const needsAttention = filtered.some((q) => q.status !== 'HEALTHY');
  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? '';

  const filterTabs = (
    <Tabs value={filter} onValueChange={(value) => onFilterChange(value as SystemFilter)} variant="boxed" size="md">
      <TabsList aria-label="Filter by system">
        {FILTERS.map((f) => (
          <TabsTrigger key={f.value} value={f.value} className="gap-1.5 px-3">
            {f.value !== 'all' ? <SystemIcon system={f.value} size="sm" /> : null}
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <Panel
      title="Inspect next"
      subtitle="Ranked by status, then risk × what’s at stake"
      icon={icon}
      chip="SYNTHETIC"
      chipTitle="Risk is computed from synthetic sensor data; buildings and costs are real."
      actions={filterTabs}
    >
      {loading ? (
        <PanelState state="loading" lines={6} />
      ) : error ? (
        <PanelState state="error" message={error} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <PanelState
          state="empty"
          message={`No ${filter === 'all' ? '' : `${filterLabel} `}assets in the queue as of ${formatDate(asOf)}.`}
        />
      ) : (
        <div className="flex flex-col">
          {!needsAttention ? (
            <div
              data-status="HEALTHY"
              className="mb-3 flex items-center gap-2 rounded-md bg-[var(--bib-status-soft)] px-3 py-2 text-[15px] leading-5 text-[var(--bib-ink)]"
            >
              <span className="size-2.5 shrink-0 rounded-full bg-[var(--bib-status-color)]" aria-hidden />
              All systems within normal ranges as of {formatDate(asOf)}.
            </div>
          ) : null}
          <ol className="-mx-2 flex flex-col divide-y divide-[var(--bib-border)]">
            {visible.map((item) => (
              <li key={item.asset_id} className="py-0.5">
                <QueueRow item={item} rank={queue.indexOf(item) + 1} threshold={threshold} asOf={asOf} />
              </li>
            ))}
          </ol>
          {filtered.length > PAGE_SIZE ? (
            <Button
              variant="ghost"
              appearance="secondary"
              size="sm"
              className="mt-2 self-start"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
            </Button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
