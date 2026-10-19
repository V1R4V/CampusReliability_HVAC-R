/*
 * AskAgentButton — "✦ Ask the agent" in the top bar (FRONTEND §4).
 *
 * `onOpen` should open Anuva's agent drawer and return true when it did. When it is
 * absent or returns false (no drawer mounted), the button opens an honest popover with
 * the suggested prompts instead — never a dead click.
 */

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SUGGESTED_PROMPTS = [
  'What should 2 crews inspect this week?',
  'What if S3 fails on a 95°F day?',
  'Which buildings are wasting the most energy?',
];

export interface AskAgentButtonProps {
  /** Try to open the agent drawer; return true if it opened. */
  onOpen?: () => boolean | void;
}

export default function AskAgentButton({ onOpen }: AskAgentButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const handleClick = () => {
    const opened = onOpen?.();
    if (opened !== true) setFallbackOpen(true);
  };

  return (
    <Popover open={fallbackOpen} onOpenChange={setFallbackOpen}>
      <PopoverTrigger asChild>
        {/* The span takes Radix's anchor ref (the DS Button is a plain function component). */}
        <span className="inline-flex">
          <Button
            variant="solid"
            appearance="accent"
            size="md"
            leadingIcon={<Sparkles />}
            onClick={(event) => {
              // Radix toggles the popover on trigger click; we decide ourselves below.
              event.preventDefault();
              handleClick();
            }}
          >
            Ask the agent
          </Button>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[16px] font-semibold leading-6 text-[var(--bib-ink)]">Agent drawer unavailable here</div>
            <p className="mt-1 text-[14px] leading-5 text-[var(--bib-ink-muted)]">
              The agent drawer did not open on this page. The ranked queue on the Overview is current; it is what the
              agent reasons over.
            </p>
          </div>
          <ul className="flex flex-col gap-2" aria-label="Suggested prompts">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <li
                key={prompt}
                className="rounded-md border border-dashed border-[var(--bib-border)] px-3 py-2 text-[14px] leading-5 text-[var(--bib-ink-muted)]"
              >
                “{prompt}”
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
