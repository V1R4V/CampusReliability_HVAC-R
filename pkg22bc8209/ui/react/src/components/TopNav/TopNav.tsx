/*
 * TopNav — the application bar (FRONTEND §4), built on the C3 TopNavBar.
 *
 * Brand on the left (ink mark + name + campus), the global as-of DateScrubber in the
 * centre (given the full remaining width — the brand and actions are pinned to their
 * content width), and the real-weather chip + "Ask the agent" on the right. Rendered
 * once by App.tsx, outside <Routes>, so it is on every screen.
 */

import React from 'react';
import { Activity } from 'lucide-react';

import { TopNavBar } from '@/components/ui/top-nav-bar';
import AskAgentButton from './AskAgentButton';
import DateScrubber from './DateScrubber';
import ThemeToggle from './ThemeToggle';
import WeatherChip from './WeatherChip';

export interface TopNavProps {
  /** Opens the agent drawer (Anuva's); return true when it opened. */
  onAskAgent?: () => boolean | void;
}

export default function TopNav({ onAskAgent }: TopNavProps) {
  return (
    <TopNavBar
      logo={
        <span className="inline-flex size-9 items-center justify-center rounded-[6px] bg-[var(--bib-ink)] text-white shadow-[0_2px_6px_rgb(17_24_39_/_0.25)] [&_svg]:size-5">
          <Activity aria-hidden />
        </span>
      }
      appName={
        <span className="flex flex-col leading-tight">
          <span className="text-[18px] font-semibold leading-6 tracking-[-0.01em] text-[var(--bib-ink)]">Before It Breaks</span>
          <span className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-[var(--bib-ink-muted)]">
            UW–Madison · FP&amp;M utilities
          </span>
        </span>
      }
      center={<DateScrubber />}
      actions={
        <>
          <WeatherChip />
          <ThemeToggle />
          <AskAgentButton onOpen={onAskAgent} />
        </>
      }
      className="z-20 h-auto min-h-[72px] shrink-0 gap-6 border-[var(--bib-border)] bg-[var(--bib-surface)] px-5 py-2 shadow-[0_1px_0_var(--bib-border),0_4px_16px_rgb(17_24_39_/_0.04)] [&>div:first-child]:flex-none [&>div:last-child]:flex-none [&>div:last-child]:gap-3"
    />
  );
}
