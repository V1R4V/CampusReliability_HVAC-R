/*
 * Work orders (FRONTEND §5.6): everything the agent has drafted, by status. Nothing runs
 * until a person approves it. Duplicate drafts for the same asset (the seed resets a work
 * order to pending after it was approved, and the agent drafts a fresh one) collapse to
 * the newest. Cards can be dragged into your own order.
 */

import React, { useEffect, useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { PanelState } from '@/components/Panel/Panel';
import Reorderable from '@/components/Reorderable/Reorderable';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import { approveWorkOrder, dismissWorkOrder, fetchWorkOrders } from '@/shared/api/anuva';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';

const TABS: { value: WorkOrderStatus; label: string; empty: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval', empty: 'No work orders pending.' },
  { value: 'APPROVED', label: 'Approved', empty: 'No approved work orders yet.' },
  { value: 'DISMISSED', label: 'Dismissed', empty: 'No dismissed work orders.' },
];

/** One card per asset and status: keep the most recently drafted (highest WO number on a tie). */
function dedupe(rows: WorkOrder[]): WorkOrder[] {
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

export default function WorkOrders() {
  const { snapshot } = useAsOf();
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
        if (!cancelled) setWorkOrders(dedupe(rows));
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

  const assetName = useMemo(() => new Map((snapshot?.queue ?? []).map((q) => [q.asset_id, q.name] as const)), [snapshot]);

  if (loading) {
    return (
      <div className="p-6">
        <PanelState state="loading" lines={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PanelState state="error" message={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Work orders</h1>
        <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
          Drafted by the agent. Nothing is scheduled until you approve it.
        </p>
      </header>

      <Tabs defaultValue="PENDING_APPROVAL">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label} ({workOrders.filter((wo) => wo.status === tab.value).length})
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => {
          const rows = workOrders.filter((wo) => wo.status === tab.value).slice(0, 100);
          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
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
                        className="h-full"
                        onApprove={async () => {
                          await approveWorkOrder(wo.wo_id, 'Facilities manager');
                          setRefreshKey((k) => k + 1);
                        }}
                        onDismiss={async (reason) => {
                          await dismissWorkOrder(wo.wo_id, reason);
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
    </div>
  );
}
