/*
 * Panel + PanelState — the card every page section is built from.
 *
 * Every panel in the app handles loading (skeleton), empty and error (one-line message
 * with Retry) — never a blank card (FRONTEND §6). Pages compose `<Panel>` for the frame
 * and `<PanelState>` for the three non-content states.
 *
 * The frame is the shared `.bib-card` surface (white, hairline, soft lift). An optional
 * `icon` sits in a tile beside the title; `tone="hero"` swaps the surface for the dark
 * ink hero used by the morning brief and the Plan B punchline.
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
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import type { Provenance } from '@/shared/api';

export interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Honesty label shown next to the title (currently renders nothing — owner's call). */
  chip?: Provenance;
  chipTitle?: string;
  /** Lucide icon (or any node) shown in a tile beside the title. */
  icon?: React.ReactNode;
  /** Right-aligned header controls (filters, buttons). */
  actions?: React.ReactNode;
  /** Optional footer row below the content, separated by a hairline. */
  footer?: React.ReactNode;
  tone?: 'default' | 'hero';
  /** Padding density. */
  size?: 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Panel({
  title,
  subtitle,
  chip,
  chipTitle,
  icon,
  actions,
  footer,
  tone = 'default',
  size = 'md',
  children,
  className,
  contentClassName,
}: PanelProps) {
  const hasHeader = Boolean(title || subtitle || actions || chip || icon);
  const hero = tone === 'hero';
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col',
        hero ? 'bib-hero' : 'bib-card',
        size === 'lg' ? 'gap-4 p-6' : 'gap-3 p-4',
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span
                className={cn(
                  'size-9 [&_svg]:size-5',
                  hero ? 'bib-hero-tile' : 'bib-icon-tile',
                )}
                aria-hidden
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {title ? (
                  <h2 className={cn('text-[18px] font-semibold leading-6', hero ? 'text-white' : 'text-[var(--bib-ink)]')}>
                    {title}
                  </h2>
                ) : null}
                {chip ? <ProvenanceChip kind={chip} size="sm" title={chipTitle} /> : null}
              </div>
              {subtitle ? (
                <p className={cn('mt-0.5 text-[14px] leading-5', hero ? 'bib-hero-muted' : 'text-[var(--bib-ink-muted)]')}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('min-w-0 flex-1', contentClassName)}>{children}</div>
      {footer ? (
        <footer
          className={cn(
            'flex flex-wrap items-center gap-3 border-t pt-3 text-[14px] leading-5',
            hero ? 'border-white/10 bib-hero-muted' : 'border-[var(--bib-border)] text-[var(--bib-ink-muted)]',
          )}
        >
          {footer}
        </footer>
      ) : null}
    </section>
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
        'flex items-center gap-3 rounded-md border border-dashed border-[var(--bib-border-strong)] bg-[var(--bib-canvas)] px-4 py-5 text-[15px] text-[var(--bib-ink-muted)]',
        className,
      )}
    >
      <Inbox className="size-5 shrink-0" aria-hidden />
      <span>{message ?? 'Nothing to show.'}</span>
    </div>
  );
}
