/*
 * TopNav — the application bar (FRONTEND §4), built on the C3 TopNavBar.
 *
 * Brand on the left, the global as-of DateScrubber in the centre (given the full
 * remaining width — the brand and actions are pinned to their content width), and
 * the real-weather chip + "Ask the agent" on the right. Rendered once by App.tsx,
 * outside <Routes>, so it is on every screen.
 */

import React from 'react';
import { Activity } from 'lucide-react';

import { TopNavBar } from '@/components/ui/top-nav-bar';
import AskAgentButton from './AskAgentButton';
import DateScrubber from './DateScrubber';
import WeatherChip from './WeatherChip';

export interface TopNavProps {
  /** Opens the agent drawer (Anuva's); return true when it opened. */
  onAskAgent?: () => boolean | void;
}

export default function TopNav({ onAskAgent }: TopNavProps) {
  return (
    <TopNavBar
      logo={<Activity aria-hidden />}
      appName={
        <span className="flex flex-col leading-tight">
          <span className="text-[18px] font-semibold leading-6 text-[var(--bib-ink)]">Before It Breaks</span>
          <span className="text-[12px] font-normal leading-4 text-[var(--bib-ink-muted)]">UW–Madison · FP&amp;M utilities</span>
        </span>
      }
      center={<DateScrubber />}
      actions={
        <>
          <WeatherChip />
          <AskAgentButton onOpen={onAskAgent} />
        </>
      }
      className="h-auto min-h-16 shrink-0 gap-6 py-1.5 [&>div:first-child]:flex-none [&>div:last-child]:flex-none [&>div:last-child]:gap-3"
    />
  );
}
