/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X as XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { Skeleton } from '@/components/Panel/Panel';
import { formatDate } from '@/shared/api';
import type { WorkOrder, WorkOrderStatus } from '@/Interfaces';
import { WorkOrderStatusTag } from './WorkOrderStatusTag';

export interface WorkOrderCardProps {
  workOrder: WorkOrder | null | undefined;
  onApprove: () => Promise<void>;
  onDismiss: (reason: string) => Promise<void>;
  loading?: boolean;
  /** Extra context line, e.g. the asset or building name when the list mixes assets. */
  context?: string;
  className?: string;
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'Priority 1 · urgent', 2: 'Priority 2', 3: 'Priority 3' };

const APPROVED_BANNER_MS = 4000;

/**
 * WorkOrderCard: one agent-drafted work order (FRONTEND §5.4, §6).
 *
 * Title and what to do first; the WO number, crew, estimate and drafted date in one quiet
 * line; the status pill; actions only while it is pending. Approve gives instant feedback
 * (pill flips, short confirmation); Dismiss requires a reason; Edit is a placeholder.
 * Tokens throughout, so it follows light / night mode.
 */
export default function WorkOrderCard({ workOrder, onApprove, onDismiss, loading = false, context, className }: WorkOrderCardProps) {
  const { reportError } = useErrorReporter();
  const [status, setStatus] = useState<WorkOrderStatus | null>(workOrder?.status ?? null);
  const [busy, setBusy] = useState<'approve' | 'dismiss' | null>(null);
  const [justApproved, setJustApproved] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const bannerTimer = useRef<number | null>(null);

  // Keep local (optimistic) status in sync when a fresh work order object arrives.
  useEffect(() => {
    setStatus(workOrder?.status ?? null);
  }, [workOrder?.wo_id, workOrder?.status]);

  // Never let the banner timer fire into an unmounted card.
  useEffect(
    () => () => {
      if (bannerTimer.current !== null) window.clearTimeout(bannerTimer.current);
    },
    [],
  );

  if (loading) {
    return (
      <Card variant="outlined" size="md" className={className}>
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!workOrder) {
    return (
      <Card variant="outlined" size="md" className={className}>
        <p className="text-[15px] text-[var(--bib-ink-muted)]">No work order drafted.</p>
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
      if (bannerTimer.current !== null) window.clearTimeout(bannerTimer.current);
      bannerTimer.current = window.setTimeout(() => setJustApproved(false), APPROVED_BANNER_MS);
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
  const urgent = workOrder.priority === 1;

  return (
    <Card variant="outlined" size="md" className={cn('gap-3', className)} data-wo-status={effectiveStatus}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 pr-7">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-6 text-[var(--bib-ink)]">{workOrder.title}</h3>
          {context ? <p className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">{context}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-[3px] border px-1.5 text-[12px] font-semibold uppercase leading-5 tracking-[0.04em]',
              urgent ? 'border-[var(--bib-ink)] text-[var(--bib-ink)]' : 'border-[var(--bib-border)] text-[var(--bib-ink-muted)]',
            )}
          >
            {PRIORITY_LABEL[workOrder.priority] ?? `Priority ${workOrder.priority}`}
          </span>
          <WorkOrderStatusTag status={effectiveStatus} size="sm" />
        </div>
      </div>

      <p className="text-[15px] leading-6 text-[var(--bib-ink)]">{workOrder.description}</p>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-5 text-[var(--bib-ink-muted)]">
        <div>
          <dt className="sr-only">Work order</dt>
          <dd className="font-medium text-[var(--bib-ink)]">{workOrder.wo_id}</dd>
        </div>
        <div>
          <dt className="sr-only">Crew</dt>
          <dd>{workOrder.crew}</dd>
        </div>
        <div>
          <dt className="sr-only">Estimate</dt>
          <dd>{workOrder.est_hours} h</dd>
        </div>
        <div>
          <dt className="sr-only">Drafted</dt>
          <dd>Drafted {formatDate(workOrder.drafted_on)}</dd>
        </div>
        {effectiveStatus === 'APPROVED' && workOrder.approved_by ? (
          <div>
            <dt className="sr-only">Approved</dt>
            <dd>
              Approved by {workOrder.approved_by}
              {workOrder.approved_on ? ` on ${formatDate(workOrder.approved_on)}` : ''}
            </dd>
          </div>
        ) : null}
        {effectiveStatus === 'DISMISSED' && workOrder.dismiss_reason ? (
          <div>
            <dt className="sr-only">Dismissed</dt>
            <dd>Dismissed: {workOrder.dismiss_reason}</dd>
          </div>
        ) : null}
      </dl>

      {justApproved ? (
        <div
          role="status"
          className="bib-rise rounded-[6px] bg-[var(--bib-status-healthy-soft)] px-2.5 py-1.5 text-[13px] font-medium leading-4 text-[var(--bib-status-healthy)]"
        >
          Work order approved
        </div>
      ) : null}
      {actionError ? (
        <div role="alert" className="text-[13px] font-medium leading-4 text-[var(--bib-status-due)]">
          {actionError}
        </div>
      ) : null}

      {pending ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--bib-border)] pt-3">
          <Button size="sm" variant="outline" appearance="secondary" onClick={() => setEditOpen(true)} leadingIcon={<Pencil />}>
            Edit
          </Button>
          <Button size="sm" variant="outline" appearance="danger" onClick={() => setDismissOpen(true)} leadingIcon={<XIcon />}>
            Dismiss
          </Button>
          <Button size="sm" appearance="success" loading={busy === 'approve'} onClick={handleApprove} leadingIcon={<Check />}>
            Approve
          </Button>
        </div>
      ) : null}

      <Modal open={dismissOpen} onOpenChange={setDismissOpen}>
        <ModalContent width={420}>
          <ModalHeader>
            <ModalTitle>Dismiss work order</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <label
              htmlFor={`dismiss-reason-${workOrder.wo_id}`}
              className="mb-1 block text-[13px] font-medium leading-4 text-[var(--bib-ink)]"
            >
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
          <ModalBody>Editing work orders is not available yet.</ModalBody>
          <ModalFooter>
            <Button onClick={() => setEditOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
