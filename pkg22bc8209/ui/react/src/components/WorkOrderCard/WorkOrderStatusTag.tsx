/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { WO_STATUS_LABEL } from '@/shared/api';
import type { WorkOrderStatus } from '@/Interfaces';

export interface WorkOrderStatusTagProps {
  status: WorkOrderStatus;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Work-order status tag (FRONTEND §2): outline = pending approval, solid = approved,
 * muted = dismissed. Complements Arnav's `StatusPill`, which covers asset status only.
 * Colours are the `--bib-wo` / ink tokens, so it follows light / night mode.
 */
export function WorkOrderStatusTag({ status, size = 'md', className }: WorkOrderStatusTagProps) {
  const tone =
    status === 'APPROVED'
      ? 'border-[var(--bib-wo)] bg-[var(--bib-wo)] text-[var(--bib-surface)]'
      : status === 'PENDING_APPROVAL'
        ? 'border-[var(--bib-wo)] bg-transparent text-[var(--bib-wo)]'
        : 'border-[var(--bib-border)] bg-[var(--bib-status-offline-soft)] text-[var(--bib-ink-muted)]';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border font-medium leading-none',
        size === 'sm' ? 'h-[22px] px-2.5 text-[13px]' : 'h-[26px] px-3 text-[14px]',
        tone,
        className,
      )}
    >
      {WO_STATUS_LABEL[status]}
    </span>
  );
}
