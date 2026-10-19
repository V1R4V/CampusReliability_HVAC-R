/*
 * MorningBrief — the agent's one-paragraph brief for the as-of date (FRONTEND §5.1),
 * read first at 7am: how many assets need inspection and why the top one matters.
 * Rendered on the dark hero surface so it is the first thing the eye lands on.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

import { Skeleton } from '@/components/Panel/Panel';
import { formatDate } from '@/shared/api';

export interface MorningBriefProps {
  brief: string | null;
  asOf: string;
  loading: boolean;
}

export default function MorningBrief({ brief, asOf, loading }: MorningBriefProps) {
  const text = brief && brief.trim() ? brief : `No brief available for ${formatDate(asOf)}.`;
  return (
    <section className="bib-hero flex items-start gap-4 p-5 md:p-6" aria-labelledby="bib-morning-brief">
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
    </section>
  );
}
