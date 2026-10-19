/*
 * MorningBrief — the agent's one-paragraph brief for the as-of date (FRONTEND §5.1),
 * read first at 7am: how many assets need inspection and why the top one matters.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
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
    <Card variant="outlined" size="md" className="flex-row items-start gap-4 bg-[var(--bib-canvas)]">
      <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--bib-border)] bg-[var(--bib-surface)]">
        <Sparkles className="size-5 text-[var(--bib-ink)]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
          <span>Morning brief · {formatDate(asOf)}</span>
          <span className="font-normal normal-case tracking-normal">· drafted by the agent</span>
          <ProvenanceChip
            kind="SYNTHETIC"
            size="sm"
            title="Summarises risk computed from synthetic sensor data; buildings and counts are real."
          />
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-3/4" />
        ) : (
          <p className="mt-1 text-[18px] leading-7 text-[var(--bib-ink)]">{text}</p>
        )}
      </div>
    </Card>
  );
}
