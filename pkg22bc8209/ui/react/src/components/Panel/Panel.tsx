/*
 * Panel + PanelState — the card every page section is built from.
 *
 * Every panel in the app handles loading (skeleton), empty and error (one-line message
 * with Retry) — never a blank card (FRONTEND §6). Pages compose `<Panel>` for the frame
 * and `<PanelState>` for the three non-content states.
 */

import React from 'react';
import { Inbox } from 'lucide-react';

import {
  Alert,
  AlertAction,
  AlertAppearanceIcon,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import type { Provenance } from '@/shared/api';

export interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Honesty label shown next to the title. */
  chip?: Provenance;
  chipTitle?: string;
  /** Right-aligned header controls (filters, buttons). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Panel({ title, subtitle, chip, chipTitle, actions, children, className, contentClassName }: PanelProps) {
  const hasHeader = Boolean(title || subtitle || actions || chip);
  return (
    <Card variant="outlined" size="md" className={cn('min-w-0 gap-3', className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {title ? <h2 className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">{title}</h2> : null}
              {chip ? <ProvenanceChip kind={chip} size="sm" title={chipTitle} /> : null}
            </div>
            {subtitle ? <p className="mt-0.5 text-[14px] leading-5 text-[var(--bib-ink-muted)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('min-w-0', contentClassName)}>{children}</div>
    </Card>
  );
}

/** Pulsing placeholder block; size it with Tailwind (`h-5 w-1/2`). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bib-skeleton', className)} />;
}

export interface PanelStateProps {
  state: 'loading' | 'empty' | 'error';
  /** Error detail or empty-state copy. */
  message?: string;
  /** Error headline; defaults to "Couldn’t load this panel". */
  title?: string;
  onRetry?: () => void;
  /** Number of skeleton lines while loading. */
  lines?: number;
  className?: string;
}

const SKELETON_WIDTHS = ['w-3/4', 'w-full', 'w-1/2', 'w-5/6'];

export function PanelState({ state, message, title, onRetry, lines = 3, className }: PanelStateProps) {
  if (state === 'loading') {
    return (
      <div className={cn('flex flex-col gap-3 py-1', className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-5', SKELETON_WIDTHS[i % SKELETON_WIDTHS.length])} />
        ))}
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <Alert variant="soft" appearance="destructive" className={className}>
        <AlertAppearanceIcon appearance="destructive" />
        <AlertContent>
          <AlertTitle>{title ?? 'Couldn’t load this panel'}</AlertTitle>
          {message ? <AlertDescription>{message}</AlertDescription> : null}
        </AlertContent>
        {onRetry ? <AlertAction onClick={onRetry}>Retry</AlertAction> : null}
      </Alert>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-dashed border-[var(--bib-border)] px-4 py-5 text-[15px] text-[var(--bib-ink-muted)]',
        className,
      )}
    >
      <Inbox className="size-5 shrink-0" aria-hidden />
      <span>{message ?? 'Nothing to show.'}</span>
    </div>
  );
}
