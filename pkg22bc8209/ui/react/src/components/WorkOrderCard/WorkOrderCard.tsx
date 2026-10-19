/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useState } from 'react';
import { Check, Pencil, X as XIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';
import { WorkOrderStatusTag } from '../RiskChart/Tags';

export interface WorkOrderCardProps {
  workOrder: WorkOrder | null | undefined;
  onApprove: () => Promise<void>;
  onDismiss: (reason: string) => Promise<void>;
  loading?: boolean;
}

/**
 * A single work order with Approve / Edit / Dismiss actions (FRONTEND §5.4, §6).
 * Approve gives instant feedback (pill flips solid + a success banner);
 * Dismiss requires a reason; Edit is a P2 no-op placeholder.
 */
export default function WorkOrderCard({ workOrder, onApprove, onDismiss, loading = false }: WorkOrderCardProps) {
  const { reportError } = useErrorReporter();
  const [status, setStatus] = useState<WorkOrderStatus | null>(workOrder?.status ?? null);
  const [busy, setBusy] = useState<'approve' | 'dismiss' | null>(null);
  const [justApproved, setJustApproved] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Keep local (optimistic) status in sync when a fresh work order object arrives.
  useEffect(() => {
    setStatus(workOrder?.status ?? null);
  }, [workOrder?.wo_id, workOrder?.status]);

  if (loading) {
    return (
      <Card variant="outlined" size="md">
        <div className="h-20 animate-pulse rounded bg-[#F7F7F5]" />
      </Card>
    );
  }

  if (!workOrder) {
    return (
      <Card variant="outlined" size="md">
        <CardContent className="text-sm text-[#6B7280]">No work order drafted.</CardContent>
      </Card>
    );
  }

  const handleApprove = async () => {
    setBusy('approve');
    setActionError(null);
    try {
      await onApprove();
      setStatus('APPROVED');
      setJustApproved(true);
      window.setTimeout(() => setJustApproved(false), 4000);
    } catch (err) {
      reportError(err);
      setActionError('Could not approve this work order. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = async () => {
    if (!reason.trim()) return;
    setBusy('dismiss');
    setActionError(null);
    try {
      await onDismiss(reason.trim());
      setStatus('DISMISSED');
      setDismissOpen(false);
      setReason('');
    } catch (err) {
      reportError(err);
      setActionError('Could not dismiss this work order. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const effectiveStatus = status ?? workOrder.status;
  const pending = effectiveStatus === 'PENDING_APPROVAL';

  return (
    <Card variant="outlined" size="md">
      <CardHeader>
        <CardTitle>{workOrder.title}</CardTitle>
        <CardDescription>
          {workOrder.wo_id} · Priority {workOrder.priority} · {workOrder.crew} · est. {workOrder.est_hours}h
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div>{workOrder.description}</div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkOrderStatusTag status={effectiveStatus} size="sm" />
          <span className="text-xs text-[#6B7280]">
            Drafted by {workOrder.drafted_by} on {workOrder.drafted_on}
          </span>
        </div>
        {effectiveStatus === 'APPROVED' && workOrder.approved_by ? (
          <div className="text-xs text-[#6B7280]">
            Approved by {workOrder.approved_by} on {workOrder.approved_on}
          </div>
        ) : null}
        {effectiveStatus === 'DISMISSED' && workOrder.dismiss_reason ? (
          <div className="text-xs text-[#6B7280]">Dismissed: {workOrder.dismiss_reason}</div>
        ) : null}
        {justApproved ? (
          <div className="rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: '#2E7D3214', color: '#2E7D32' }}>
            Work order approved
          </div>
        ) : null}
        {actionError ? <div className="text-xs font-medium text-[#DC2626]">{actionError}</div> : null}
      </CardContent>
      {pending ? (
        <CardFooter>
          <Button size="sm" appearance="success" loading={busy === 'approve'} onClick={handleApprove} leadingIcon={<Check />}>
            Approve
          </Button>
          <Button size="sm" variant="outline" appearance="secondary" onClick={() => setEditOpen(true)} leadingIcon={<Pencil />}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            appearance="danger"
            onClick={() => setDismissOpen(true)}
            leadingIcon={<XIcon />}
          >
            Dismiss
          </Button>
        </CardFooter>
      ) : null}

      <Modal open={dismissOpen} onOpenChange={setDismissOpen}>
        <ModalContent width={420}>
          <ModalHeader>
            <ModalTitle>Dismiss work order</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <label htmlFor={`dismiss-reason-${workOrder.wo_id}`} className="mb-1 block text-xs font-medium text-[#111827]">
              Reason (required)
            </label>
            <Textarea
              id={`dismiss-reason-${workOrder.wo_id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this work order being dismissed?"
              rows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" appearance="secondary" onClick={() => setDismissOpen(false)}>
              Cancel
            </Button>
            <Button appearance="danger" disabled={!reason.trim()} loading={busy === 'dismiss'} onClick={handleDismiss}>
              Dismiss work order
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={editOpen} onOpenChange={setEditOpen}>
        <ModalContent width={380}>
          <ModalHeader>
            <ModalTitle>Edit work order</ModalTitle>
          </ModalHeader>
          <ModalBody>Editing work orders isn&apos;t available yet.</ModalBody>
          <ModalFooter>
            <Button onClick={() => setEditOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
