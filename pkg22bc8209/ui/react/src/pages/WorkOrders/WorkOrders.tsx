/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

/*
 * Work Orders (FRONTEND §5.6, owner: Anuva) · `workOrders()` — every agent-drafted work
 * order, by status. Approve / Dismiss act in place and refetch; the list stays on screen
 * (dimmed) while it refreshes. Built from the shared Panel/PanelState + WorkOrderCard.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';
import { PanelState } from '@/components/Panel/Panel';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import { useAsOf } from '@/contexts/AsOfProvider';
import { errorMessage } from '@/shared/api';
import { approveWorkOrder, dismissWorkOrder, fetchWorkOrders } from '@/shared/api/anuva';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';

const APPROVER = 'Facilities manager';
/** Hard cap per tab so a long history can never flood the DOM (preview safety). */
const MAX_PER_TAB = 100;

const TABS: { value: WorkOrderStatus; label: string; empty: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval', empty: 'Nothing awaiting approval — the agent drafts a work order when an asset crosses the threshold.' },
  { value: 'APPROVED', label: 'Approved', empty: 'No approved work orders yet.' },
  { value: 'DISMISSED', label: 'Dismissed', empty: 'No dismissed work orders.' },
];

export default function WorkOrders() {
  const { asOf } = useAsOf();
  const { reportError } = useErrorReporter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWorkOrders()
      .then((rows) => {
        if (!cancelled) setWorkOrders(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        reportError(err);
        setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reportError]);

  const byStatus = useMemo(() => {
    const groups = new Map<WorkOrderStatus, WorkOrder[]>(TABS.map((tab) => [tab.value, []]));
    (workOrders ?? []).forEach((workOrder) => groups.get(workOrder.status)?.push(workOrder));
    return groups;
  }, [workOrders]);

  const total = workOrders?.length ?? 0;
  const pending = byStatus.get('PENDING_APPROVAL')?.length ?? 0;

  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-7 text-[var(--bib-ink)]">Work orders</h1>
          <p className="text-[15px] leading-5 text-[var(--bib-ink-muted)]">
            {workOrders
              ? `${total} agent-drafted · ${pending} awaiting approval`
              : 'Agent-drafted work orders across the campus'}
          </p>
        </div>
      </header>

      {loading && !workOrders ? (
        <PanelState state="loading" lines={6} />
      ) : !workOrders ? (
        <PanelState state="error" title="Couldn’t load work orders" message={error ?? undefined} onRetry={reload} />
      ) : (
        <>
          {error ? (
            <PanelState state="error" title="Couldn’t refresh work orders" message={error} onRetry={reload} />
          ) : null}
          <Tabs defaultValue="PENDING_APPROVAL" className={cn('transition-opacity', loading ? 'opacity-70' : 'opacity-100')}>
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label} ({byStatus.get(tab.value)?.length ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((tab) => {
              const rows = byStatus.get(tab.value) ?? [];
              return (
                <TabsContent key={tab.value} value={tab.value} className="mt-4 flex flex-col gap-3">
                  {rows.length === 0 ? (
                    <PanelState state="empty" message={tab.empty} />
                  ) : (
                    <>
                      {rows.slice(0, MAX_PER_TAB).map((workOrder) => (
                        <WorkOrderCard
                          key={workOrder.wo_id}
                          workOrder={workOrder}
                          onApprove={async () => {
                            await approveWorkOrder(workOrder.wo_id, APPROVER);
                            reload();
                          }}
                          onDismiss={async (reason) => {
                            await dismissWorkOrder(workOrder.wo_id, reason);
                            reload();
                          }}
                        />
                      ))}
                      {rows.length > MAX_PER_TAB ? (
                        <p className="text-[13px] text-[var(--bib-ink-muted)]">
                          Showing the first {MAX_PER_TAB} of {rows.length}.
                        </p>
                      ) : null}
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}

      <AgentDrawer asOf={asOf} />
    </div>
  );
}
