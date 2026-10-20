/*
 * Work orders (FRONTEND §5.6): everything the agent has drafted, by status. Nothing runs
 * until a person approves it. The list respects the replay clock (a draft dated after the
 * as-of date is not yet known), an approved order supersedes a stale pending draft for the
 * same asset (pages/WorkOrders/dedupe.ts), and cards can be dragged into your own order.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import PageHeader from '@/components/PageHeader/PageHeader';
import { PanelState } from '@/components/Panel/Panel';
import Reorderable from '@/components/Reorderable/Reorderable';
import WorkOrderCard, { type WorkOrderBuilding } from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate } from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, editWorkOrder, fetchWorkOrders } from '@/shared/api/anuva';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';
import { dedupe, knownBy } from './dedupe';

const TABS: { value: WorkOrderStatus; label: string; empty: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval', empty: 'No work orders pending.' },
  { value: 'APPROVED', label: 'Approved', empty: 'No approved work orders yet.' },
  { value: 'DISMISSED', label: 'Dismissed', empty: 'No dismissed work orders.' },
];

export default function WorkOrders() {
  const { asOf, snapshot, buildingsById } = useAsOf();
  const { reportError } = useErrorReporter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWorkOrders()
      .then((rows) => {
        if (!cancelled) setWorkOrders(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          reportError(err);
          setError('Could not load work orders.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reportError]);

  const { shown, hiddenFuture } = useMemo(() => knownBy(workOrders, asOf), [workOrders, asOf]);
  const visible = useMemo(() => dedupe(shown), [shown]);
  const assetName = useMemo(() => new Map((snapshot?.queue ?? []).map((q) => [q.asset_id, q.name] as const)), [snapshot]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((tab) => [tab.value, visible.filter((wo) => wo.status === tab.value).length])) as Record<WorkOrderStatus, number>,
    [visible],
  );

  const buildingsFor = (wo: WorkOrder): WorkOrderBuilding[] =>
    (wo.building_ids ?? [])
      .map((id) => buildingsById.get(id))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({ name: b.name, criticality: b.criticality }));

  return (
    <div className="flex min-h-full flex-col gap-5 p-6 xl:px-8">
      <PageHeader
        eyebrow="What did the agent draft?"
        title="Work orders"
        icon={<ClipboardList />}
        description="Every work order here was drafted by the agent from a briefing. Nothing is scheduled until a person approves it; dismissals need a reason."
        meta={
          loading
            ? []
            : [
                <>
                  As of <span className="font-semibold text-[var(--bib-ink)]">{formatDate(asOf)}</span>
                </>,
                <>
                  <span className="bib-num font-semibold text-[var(--bib-ink)]">{counts.PENDING_APPROVAL}</span> awaiting approval
                </>,
                <>
                  <span className="bib-num font-semibold text-[var(--bib-ink)]">{counts.APPROVED}</span> approved
                </>,
                <>
                  <span className="bib-num font-semibold text-[var(--bib-ink)]">{counts.DISMISSED}</span> dismissed
                </>,
              ]
        }
      />

      {loading ? (
        <PanelState state="loading" lines={6} />
      ) : error ? (
        <PanelState state="error" message={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <>
          <Tabs defaultValue="PENDING_APPROVAL" variant="bordered" size="lg">
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 px-4 text-[15px]">
                  {tab.label}
                  <span className="bib-num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bib-canvas-deep)] px-1.5 text-[12px] font-semibold text-[var(--bib-ink)]">
                    {counts[tab.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((tab) => {
              const rows = visible.filter((wo) => wo.status === tab.value).slice(0, 100);
              return (
                <TabsContent key={tab.value} value={tab.value} className="mt-5">
                  {rows.length === 0 ? (
                    <PanelState state="empty" message={tab.empty} />
                  ) : (
                    <Reorderable
                      storageKey={`workorders.${tab.value}`}
                      className="grid gap-4 xl:grid-cols-2"
                      items={rows.map((wo) => ({
                        id: wo.wo_id,
                        node: (
                          <WorkOrderCard
                            workOrder={wo}
                            context={assetName.get(wo.asset_id) ?? wo.asset_id}
                            buildings={buildingsFor(wo)}
                            asOf={asOf}
                            className="h-full"
                            onApprove={async () => {
                              await approveWorkOrder(wo.wo_id, 'Facilities manager', asOf);
                              setRefreshKey((k) => k + 1);
                            }}
                            onDismiss={async (reason) => {
                              await dismissWorkOrder(wo.wo_id, reason, asOf);
                              setRefreshKey((k) => k + 1);
                            }}
                            onEdit={async (fields) => {
                              await editWorkOrder(wo.wo_id, fields, asOf);
                              setRefreshKey((k) => k + 1);
                            }}
                          />
                        ),
                      }))}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
          {hiddenFuture > 0 ? (
            <p className="text-[13px] leading-5 text-[var(--bib-ink-muted)]">
              {hiddenFuture} work {hiddenFuture === 1 ? 'order' : 'orders'} drafted after {formatDate(asOf)} not shown. Move the as-of date forward to see{' '}
              {hiddenFuture === 1 ? 'it' : 'them'}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
