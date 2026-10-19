/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, X as XIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
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
  /** Called when the user follows the asset link (e.g. so a drawer can close itself). */
  onNavigate?: () => void;
}

const APPROVED_BANNER_MS = 4000;

/**
 * A single work order with Approve / Edit / Dismiss actions (FRONTEND §5.4, §6).
 * Approve gives instant feedback (pill flips solid + a success banner);
 * Dismiss requires a reason; Edit is a P2 no-op placeholder. Tokens throughout,
 * so it follows light / night mode.
 */
export default function WorkOrderCard({ workOrder, onApprove, onDismiss, loading = false, onNavigate }: WorkOrderCardProps) {
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
      <Card variant="outlined" size="md">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!workOrder) {
    return (
      <Card variant="outlined" size="md">
        <CardContent className="text-[15px] text-[var(--bib-ink-muted)]">No work order drafted.</CardContent>
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

  return (
    <Card variant="outlined" size="md" data-wo-status={effectiveStatus}>
      <CardHeader>
        <CardTitle>{workOrder.title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-4">
          {workOrder.asset_id ? (
            <>
              <Link
                to={`/asset/${workOrder.asset_id}`}
                onClick={onNavigate}
                className="font-medium text-[var(--bib-ink)] underline-offset-2 hover:underline"
              >
                {workOrder.asset_id}
              </Link>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span>{workOrder.wo_id}</span>
          <span aria-hidden>·</span>
          <span>Priority {workOrder.priority}</span>
          <span aria-hidden>·</span>
          <span>{workOrder.crew}</span>
          <span aria-hidden>·</span>
          <span>est. {workOrder.est_hours} h</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-[15px] leading-5 text-[var(--bib-ink)]">{workOrder.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <WorkOrderStatusTag status={effectiveStatus} size="sm" />
          <span className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
            Drafted by {workOrder.drafted_by} on {formatDate(workOrder.drafted_on)}
          </span>
        </div>
        {effectiveStatus === 'APPROVED' && workOrder.approved_by ? (
          <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">
            Approved by {workOrder.approved_by} on {formatDate(workOrder.approved_on)}
          </div>
        ) : null}
        {effectiveStatus === 'DISMISSED' && workOrder.dismiss_reason ? (
          <div className="text-[13px] leading-4 text-[var(--bib-ink-muted)]">Dismissed: {workOrder.dismiss_reason}</div>
        ) : null}
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
          <ModalBody>Editing work orders isn&apos;t available yet.</ModalBody>
          <ModalFooter>
            <Button onClick={() => setEditOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}
