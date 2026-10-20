/*
 * MorningBrief — the agent's one-paragraph brief for the as-of date (FRONTEND §5.1),
 * read first at 7am: how many assets need inspection and why the top one matters.
 * Rendered on the dark hero surface so it is the first thing the eye lands on, with the
 * top of the queue as a direct call to action so the brief is something you can act on.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Skeleton } from '@/components/Panel/Panel';
import StatusPill from '@/components/StatusPill/StatusPill';
import WorkOrderPill from '@/components/StatusPill/WorkOrderPill';
import { formatDate, formatRisk, withAsOf, type QueueItem } from '@/shared/api';

export interface MorningBriefProps {
  brief: string | null;
  asOf: string;
  loading: boolean;
  /** Top of the ranked queue — becomes the brief's "open this" action when it needs attention. */
  topItem?: QueueItem | null;
}

export default function MorningBrief({ brief, asOf, loading, topItem }: MorningBriefProps) {
  const text = brief && brief.trim() ? brief : `No brief available for ${formatDate(asOf)}.`;
  const actionable = topItem && topItem.status !== 'HEALTHY' ? topItem : null;
  return (
    <section className="bib-hero flex flex-col gap-4 p-5 md:flex-row md:items-start md:p-6" aria-labelledby="bib-morning-brief">
      <span className="bib-hero-tile mt-0.5 size-11 shrink-0 [&_svg]:size-5">
        <Sparkles aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div
          id="bib-morning-brief"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-white/70"
        >
          <span>Morning brief</span>
          <span aria-hidden className="size-1 rounded-full bg-white/40" />
          <span className="bib-num">{formatDate(asOf)}</span>
          <span aria-hidden className="size-1 rounded-full bg-white/40" />
          <span className="font-medium normal-case tracking-normal text-white/60">Drafted by the agent</span>
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-3/4 opacity-30" />
        ) : (
          <p className="mt-2 max-w-[90ch] text-[20px] leading-[30px] text-white">{text}</p>
        )}
      </div>
      {actionable ? (
        <Link
          to={withAsOf(`/asset/${actionable.asset_id}`, asOf)}
          className="group flex shrink-0 flex-col gap-2 rounded-[6px] border border-white/15 bg-white/[0.07] px-4 py-3 text-left outline-none transition-colors hover:bg-white/[0.12] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)] md:min-w-[260px]"
        >
          <span className="text-[13px] font-semibold uppercase leading-4 tracking-[0.08em] text-white/60">Start here</span>
          <span className="inline-flex items-center gap-2 text-[17px] font-semibold leading-6 text-white">
            <span className="bib-num">{actionable.asset_id}</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span className="truncate text-[14px] leading-5 text-white/75">{actionable.name}</span>
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={actionable.status} size="sm" />
            <span className="bib-num text-[13px] text-white/75">risk {formatRisk(actionable.risk)}</span>
            {actionable.work_order_status ? <WorkOrderPill status={actionable.work_order_status} size="sm" /> : null}
          </span>
        </Link>
      ) : null}
    </section>
  );
}
