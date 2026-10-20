/*
 * WorkOrderCard: one agent-drafted work order (FRONTEND §5.4, §6).
 *
 * Title and what to do first; the WO number, crew, estimate and drafted date in one quiet
 * line; the status pill; actions only while it is pending. Approve gives instant feedback
 * (pill flips, short confirmation); Dismiss requires a reason; Edit opens a form for the
 * title, description, priority, crew and estimate. Edits are optimistic: the card shows the
 * change at once, the modal closes, and if the save fails the card reverts with a message.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Building2, Check, Clock3, Hash, Pencil, Users, X as XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputNumber } from '@/components/ui/input-number';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalSubtitle, ModalTitle } from '@/components/ui/modal';
import { Radio } from '@/components/ui/radio';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useErrorReporter } from '@/components/ErrorBoundary/ErrorBoundary';
import { Skeleton } from '@/components/Panel/Panel';
import WorkOrderPill from '@/components/StatusPill/WorkOrderPill';
import { formatDate } from '@/shared/api';
import type { WorkOrder, WorkOrderEditFields, WorkOrderStatus } from '@/Interfaces';

export interface WorkOrderBuilding {
  name: string;
  criticality: string;
}

export interface WorkOrderCardProps {
  workOrder: WorkOrder | null | undefined;
  onApprove: () => Promise<void>;
  onDismiss: (reason: string) => Promise<void>;
  /** Saves the changed fields of a pending order (member `WorkOrder.edit`). Without it the Edit button is hidden. */
  onEdit?: (fields: WorkOrderEditFields) => Promise<void>;
  loading?: boolean;
  /** Extra context line, e.g. the asset or building name when the list mixes assets. */
  context?: string;
  /** What is at stake: the buildings this order protects (resolved from `building_ids` by the page). */
  buildings?: WorkOrderBuilding[];
  /** Replay date; an approval stamped after it (a real click today) is shown without its date. */
  asOf?: string;
  className?: string;
}

/** "9 buildings · Chemistry, Birge, Sterling +6 · 3 research labs" */
function buildingsLine(buildings: WorkOrderBuilding[]): string {
  const names = buildings.map((b) => b.name.replace(/\s+(Hall|Building)$/i, ''));
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  const labs = buildings.filter((b) => b.criticality === 'research_lab').length;
  const care = buildings.filter((b) => b.criticality === 'patient_care').length;
  const critical = [care ? `${care} patient care` : null, labs ? `${labs} research ${labs === 1 ? 'lab' : 'labs'}` : null].filter(Boolean).join(', ');
  return `${buildings.length} ${buildings.length === 1 ? 'building' : 'buildings'} · ${shown}${critical ? ` · ${critical}` : ''}`;
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'Priority 1 · urgent', 2: 'Priority 2', 3: 'Priority 3' };
const PRIORITY_OPTIONS: { value: number; label: string; sub: string }[] = [
  { value: 1, label: 'Priority 1', sub: 'Urgent: inspection due, high impact' },
  { value: 2, label: 'Priority 2', sub: 'This week' },
  { value: 3, label: 'Priority 3', sub: 'When a crew is free' },
];
const NOTICE_MS = 4000;
const EST_HOURS_MIN = 1;
const EST_HOURS_MAX = 80;
const TITLE_MAX = 120;

interface EditForm {
  title: string;
  description: string;
  priority: number;
  crew: string;
  /** Kept as text while typing; validated on save. */
  estHours: string;
}

function formFrom(wo: WorkOrder): EditForm {
  return { title: wo.title, description: wo.description, priority: wo.priority, crew: wo.crew, estHours: String(wo.est_hours) };
}

function parseHours(text: string): number | null {
  const value = Number(text);
  if (!Number.isInteger(value) || value < EST_HOURS_MIN || value > EST_HOURS_MAX) return null;
  return value;
}

/** Only the fields that changed, in the shape the member call wants; null when nothing changed. */
function changedFields(wo: WorkOrder, form: EditForm): WorkOrderEditFields | null {
  const fields: WorkOrderEditFields = {};
  const title = form.title.trim();
  const description = form.description.trim();
  const crew = form.crew.trim();
  const hours = parseHours(form.estHours);
  if (title !== wo.title) fields.title = title;
  if (description !== wo.description) fields.description = description;
  if (form.priority !== wo.priority) fields.priority = form.priority;
  if (crew !== wo.crew) fields.crew = crew;
  if (hours != null && hours !== wo.est_hours) fields.est_hours = hours;
  return Object.keys(fields).length > 0 ? fields : null;
}

export default function WorkOrderCard({
  workOrder,
  onApprove,
  onDismiss,
  onEdit,
  loading = false,
  context,
  buildings,
  asOf,
  className,
}: WorkOrderCardProps) {
  const { reportError } = useErrorReporter();
  const ids = useId();
  const [status, setStatus] = useState<WorkOrderStatus | null>(workOrder?.status ?? null);
  /** Optimistic edits layered over the server copy until a fresh work order arrives. */
  const [patch, setPatch] = useState<Partial<WorkOrder>>({});
  const [busy, setBusy] = useState<'approve' | 'dismiss' | 'edit' | null>(null);
  const [notice, setNotice] = useState<'approved' | 'saved' | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  // A fresh work order object (re-fetch after approve / edit) is the truth again.
  useEffect(() => {
    setStatus(workOrder?.status ?? null);
    setPatch({});
  }, [workOrder]);

  // Never let the confirmation timer fire into an unmounted card.
  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const showNotice = (kind: 'approved' | 'saved') => {
    setNotice(kind);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  };

  if (loading) {
    return (
      <div className={cn('bib-card flex flex-col gap-3 p-4', className)}>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className={cn('bib-card p-4', className)}>
        <p className="text-[15px] text-[var(--bib-ink-muted)]">No work order drafted.</p>
      </div>
    );
  }

  const shown: WorkOrder = { ...workOrder, ...patch };
  const effectiveStatus = status ?? workOrder.status;
  const pending = effectiveStatus === 'PENDING_APPROVAL';
  const urgent = shown.priority === 1;

  const handleApprove = async () => {
    setBusy('approve');
    setActionError(null);
    try {
      await onApprove();
      setStatus('APPROVED');
      showNotice('approved');
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

  const openEdit = () => {
    setForm(formFrom(shown));
    setActionError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form || !onEdit) return;
    const fields = changedFields(shown, form);
    setEditOpen(false);
    if (!fields) return;
    const previous = patch;
    setPatch({
      ...patch,
      ...(fields.title != null ? { title: fields.title } : {}),
      ...(fields.description != null ? { description: fields.description } : {}),
      ...(fields.priority != null ? { priority: fields.priority } : {}),
      ...(fields.crew != null ? { crew: fields.crew } : {}),
      ...(fields.est_hours != null ? { est_hours: fields.est_hours } : {}),
    });
    setBusy('edit');
    setActionError(null);
    try {
      await onEdit(fields);
      showNotice('saved');
    } catch (err) {
      reportError(err);
      setPatch(previous);
      setActionError('Could not save the changes. The work order is unchanged.');
    } finally {
      setBusy(null);
    }
  };

  const hours = form ? parseHours(form.estHours) : null;
  const formValid = form != null && form.title.trim().length > 0 && form.crew.trim().length > 0 && hours != null;
  const formDirty = form != null && changedFields(shown, form) != null;

  return (
    <article
      className={cn(
        'bib-card relative flex flex-col gap-3 overflow-hidden p-4',
        effectiveStatus === 'DISMISSED' && 'bg-[var(--bib-canvas)]',
        className,
      )}
      data-wo-status={effectiveStatus}
      aria-busy={busy !== null}
    >
      {pending ? <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] bg-[var(--bib-wo)]" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 pr-7">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-6 text-[var(--bib-ink)]">{shown.title}</h3>
          {context ? <p className="text-[14px] leading-5 text-[var(--bib-ink-muted)]">{context}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-[4px] border px-1.5 text-[12px] font-semibold uppercase leading-5 tracking-[0.04em]',
              urgent ? 'border-[var(--bib-ink)] bg-[var(--bib-ink)] text-white' : 'border-[var(--bib-border)] text-[var(--bib-ink-muted)]',
            )}
          >
            {PRIORITY_LABEL[shown.priority] ?? `Priority ${shown.priority}`}
          </span>
          <WorkOrderPill status={effectiveStatus} size="sm" />
        </div>
      </div>

      <p className="text-[15px] leading-6 text-[var(--bib-ink-soft)]">{shown.description}</p>

      {buildings && buildings.length > 0 ? (
        <p className="inline-flex items-start gap-1.5 text-[13px] leading-5 text-[var(--bib-ink-soft)]">
          <Building2 className="mt-0.5 size-3.5 shrink-0 text-[var(--bib-ink-muted)]" aria-hidden />
          <span>
            <span className="sr-only">At stake: </span>
            {buildingsLine(buildings)}
          </span>
        </p>
      ) : null}

      <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] leading-5 text-[var(--bib-ink-muted)]">
        <div className="inline-flex items-center gap-1.5">
          <Hash className="size-3.5" aria-hidden />
          <dt className="sr-only">Work order</dt>
          <dd className="bib-num font-semibold text-[var(--bib-ink)]">{shown.wo_id}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden />
          <dt className="sr-only">Crew</dt>
          <dd>{shown.crew}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden />
          <dt className="sr-only">Estimate</dt>
          <dd className="bib-num">{shown.est_hours} h</dd>
        </div>
        <div>
          <dt className="sr-only">Drafted</dt>
          <dd>Drafted {formatDate(shown.drafted_on)}</dd>
        </div>
        {effectiveStatus === 'APPROVED' && shown.approved_by ? (
          <div>
            <dt className="sr-only">Approved</dt>
            <dd>
              Approved by {shown.approved_by}
              {shown.approved_on && (!asOf || shown.approved_on <= asOf) ? ` on ${formatDate(shown.approved_on)}` : ''}
            </dd>
          </div>
        ) : null}
        {effectiveStatus === 'DISMISSED' && shown.dismiss_reason ? (
          <div>
            <dt className="sr-only">Dismissed</dt>
            <dd>Dismissed: {shown.dismiss_reason}</dd>
          </div>
        ) : null}
      </dl>

      {notice ? (
        <div
          role="status"
          className="bib-rise inline-flex w-fit items-center gap-2 rounded-[6px] bg-[var(--bib-status-healthy-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--bib-status-healthy)]"
        >
          <Check className="size-4" aria-hidden /> {notice === 'approved' ? 'Work order approved' : 'Changes saved'}
        </div>
      ) : null}
      {busy === 'edit' ? <div className="text-[13px] text-[var(--bib-ink-muted)]">Saving changes…</div> : null}
      {actionError ? (
        <div role="alert" className="text-[13px] font-medium text-[var(--bib-status-due)]">
          {actionError}
        </div>
      ) : null}

      {pending ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--bib-border)] pt-3">
          {onEdit ? (
            <Button size="sm" variant="outline" appearance="secondary" onClick={openEdit} disabled={busy !== null} leadingIcon={<Pencil />}>
              Edit
            </Button>
          ) : null}
          <Button size="sm" variant="outline" appearance="danger" onClick={() => setDismissOpen(true)} disabled={busy !== null} leadingIcon={<XIcon />}>
            Dismiss
          </Button>
          <Button size="sm" appearance="success" loading={busy === 'approve'} disabled={busy !== null && busy !== 'approve'} onClick={handleApprove} leadingIcon={<Check />}>
            Approve
          </Button>
        </div>
      ) : null}

      <Modal open={dismissOpen} onOpenChange={setDismissOpen}>
        <ModalContent width={440}>
          <ModalHeader>
            <ModalTitle>Dismiss work order</ModalTitle>
            <ModalSubtitle>{shown.wo_id}. A reason is required and stays on the record.</ModalSubtitle>
          </ModalHeader>
          <ModalBody>
            <label htmlFor={`${ids}-reason`} className="mb-1 block text-[13px] font-medium text-[var(--bib-ink)]">
              Reason (required)
            </label>
            <Textarea
              id={`${ids}-reason`}
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
        <ModalContent width={560} footerMode="fixed">
          <ModalHeader>
            <ModalTitle>Edit work order</ModalTitle>
            <ModalSubtitle>{shown.wo_id}. Changes go to the draft; approving it is still a separate step.</ModalSubtitle>
          </ModalHeader>
          {form ? (
            <form
              className="contents"
              onSubmit={(event) => {
                event.preventDefault();
                if (formValid && formDirty) handleSave();
              }}
            >
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${ids}-title`} className="text-[13px] font-medium text-[var(--bib-ink)]">
                      Title
                    </label>
                    <Input
                      id={`${ids}-title`}
                      size="lg"
                      value={form.title}
                      maxLength={TITLE_MAX}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      appearance={form.title.trim() ? 'default' : 'danger'}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${ids}-description`} className="text-[13px] font-medium text-[var(--bib-ink)]">
                      What to do
                    </label>
                    <Textarea
                      id={`${ids}-description`}
                      rows={4}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-[13px] font-medium text-[var(--bib-ink)]">Priority</legend>
                    <RadioGroup
                      value={String(form.priority)}
                      onValueChange={(value) => setForm({ ...form, priority: Number(value) })}
                      className="flex-row flex-wrap gap-x-6 gap-y-2"
                      aria-label="Priority"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <Radio key={option.value} value={String(option.value)} label={option.label} subLabel={option.sub} />
                      ))}
                    </RadioGroup>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_168px]">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`${ids}-crew`} className="text-[13px] font-medium text-[var(--bib-ink)]">
                        Crew
                      </label>
                      <Input
                        id={`${ids}-crew`}
                        size="lg"
                        value={form.crew}
                        onChange={(e) => setForm({ ...form, crew: e.target.value })}
                        appearance={form.crew.trim() ? 'default' : 'danger'}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`${ids}-hours`} className="text-[13px] font-medium text-[var(--bib-ink)]">
                        Estimated hours
                      </label>
                      <InputNumber
                        id={`${ids}-hours`}
                        size="lg"
                        min={EST_HOURS_MIN}
                        max={EST_HOURS_MAX}
                        value={form.estHours}
                        onChange={(e) => setForm({ ...form, estHours: e.target.value })}
                        appearance={hours == null ? 'danger' : 'default'}
                      />
                    </div>
                  </div>
                  {!formValid ? (
                    <p role="alert" className="text-[13px] leading-5 text-[var(--bib-status-due)]">
                      A title and a crew are required, and the estimate must be a whole number of hours between {EST_HOURS_MIN} and{' '}
                      {EST_HOURS_MAX}.
                    </p>
                  ) : null}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button type="button" variant="outline" appearance="secondary" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!formValid || !formDirty}>
                  Save changes
                </Button>
              </ModalFooter>
            </form>
          ) : null}
        </ModalContent>
      </Modal>
    </article>
  );
}
