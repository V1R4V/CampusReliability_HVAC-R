/*
 * WorkOrderPill — the one work-order status indicator (FRONTEND §2): outline blue while
 * a draft awaits approval, solid blue once approved, quiet grey when dismissed. Text is
 * the enum in words. Blue here is the interactive accent, not a status colour.
 */

import React from 'react';
import { Check, ClipboardList, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { WO_STATUS_LABEL, type WorkOrderStatus } from '@/shared/api';

export interface WorkOrderPillProps {
  status: WorkOrderStatus;
  size?: 'sm' | 'md';
  /** Hide the leading glyph (dense tables). */
  iconless?: boolean;
  className?: string;
}

export default function WorkOrderPill({ status, size = 'md', iconless = false, className }: WorkOrderPillProps) {
  const Icon = status === 'APPROVED' ? Check : status === 'DISMISSED' ? X : ClipboardList;
  return (
    <span
      title={`Work order ${WO_STATUS_LABEL[status].toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none',
        size === 'sm' ? 'h-[22px] px-2.5 text-[13px]' : 'h-[26px] px-3 text-[14px]',
        status === 'APPROVED'
          ? 'border-transparent bg-[var(--bib-wo)] text-white'
          : status === 'PENDING_APPROVAL'
            ? 'border-[var(--bib-wo)] bg-[var(--bib-surface)] text-[var(--bib-wo)]'
            : 'border-[var(--bib-border)] bg-[var(--bib-canvas)] text-[var(--bib-ink-muted)]',
        className,
      )}
    >
      {iconless ? null : <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />}
      {WO_STATUS_LABEL[status]}
    </span>
  );
}
