/*
 * PageHeader — the one header pattern every page opens with.
 *
 * Eyebrow (the manager's question the page answers), a 26px title with optional
 * inline badges (status pill, criticality), a one-line description, an optional row of
 * "meta" facts separated by dots, and right-aligned actions. Detail pages pass
 * `backTo` for a quiet "← Back" link above the title. Keeps every page's top edge
 * identical so moving between screens never feels like changing apps.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** The question this page answers, e.g. "What needs attention today?" */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Inline chips next to the title (status pill, criticality). */
  badges?: React.ReactNode;
  /** Short facts rendered in one row, separated by dots. */
  meta?: React.ReactNode[];
  /** Lucide icon (or any node) shown in a tile left of the title. */
  icon?: React.ReactNode;
  /** Right-aligned controls. */
  actions?: React.ReactNode;
  backTo?: { to: string; label: string };
  className?: string;
  children?: React.ReactNode;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  meta,
  icon,
  actions,
  backTo,
  className,
  children,
}: PageHeaderProps) {
  const facts = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== '');
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {backTo ? (
        <Link
          to={backTo.to}
          className="inline-flex w-fit items-center gap-1 rounded-md text-[14px] font-medium leading-5 text-[var(--bib-ink-muted)] outline-none hover:text-[var(--bib-ink)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backTo.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? <span className="bib-icon-tile mt-1 size-12 [&_svg]:size-6">{icon}</span> : null}
          <div className="min-w-0">
            {eyebrow ? <div className="bib-eyebrow mb-1">{eyebrow}</div> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.01em] text-[var(--bib-ink)]">{title}</h1>
              {badges}
            </div>
            {description ? <p className="mt-1 max-w-[88ch] text-[15px] leading-6 text-[var(--bib-ink-muted)]">{description}</p> : null}
            {facts.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
                {facts.map((fact, index) => (
                  <li key={index} className="inline-flex items-center gap-2">
                    {index > 0 ? <span aria-hidden className="size-1 rounded-full bg-[var(--bib-ink-faint)]" /> : null}
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
