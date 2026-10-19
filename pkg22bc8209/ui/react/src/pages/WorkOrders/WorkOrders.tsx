/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { approveWorkOrder, dismissWorkOrder, fetchWorkOrders } from '@/shared/api/anuva';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';
import WorkOrderCard from '@/components/WorkOrderCard/WorkOrderCard';
import AgentDrawer from '@/components/AgentDrawer/AgentDrawer';

const DEFAULT_AS_OF = '2026-06-09';

const TABS: { value: WorkOrderStatus; label: string; empty: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval', empty: 'No work orders pending.' },
  { value: 'APPROVED', label: 'Approved', empty: 'No approved work orders yet.' },
  { value: 'DISMISSED', label: 'Dismissed', empty: 'No dismissed work orders.' },
];

/** Work Orders (FRONTEND §5.6). */
export default function WorkOrders() {
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading work orders" size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-[#DC2626]">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-[#111827]">Work Orders</h1>

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
            <TabsContent key={tab.value} value={tab.value} className="mt-4 flex flex-col gap-3">
              {rows.length === 0 ? (
                <div className="text-sm text-[#6B7280]">{tab.empty}</div>
              ) : (
                rows.map((wo) => (
                  <WorkOrderCard
                    key={wo.wo_id}
                    workOrder={wo}
                    onApprove={async () => {
                      await approveWorkOrder(wo.wo_id, 'Facilities manager');
                      setRefreshKey((k) => k + 1);
                    }}
                    onDismiss={async (reason) => {
                      await dismissWorkOrder(wo.wo_id, reason);
                      setRefreshKey((k) => k + 1);
                    }}
                  />
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <AgentDrawer asOf={DEFAULT_AS_OF} />
    </div>
  );
}
