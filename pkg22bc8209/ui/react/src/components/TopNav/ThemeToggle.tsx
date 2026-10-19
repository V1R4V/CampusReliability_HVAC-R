/*
 * ThemeToggle — the light/dark switch in the application bar, sitting with the
 * other utility chips to the right of the as-of scrubber.
 *
 * The switch itself is the C3 design-system Switch (role="switch" + aria-checked
 * come for free); the sun/moon icons either side are decoration that shows which
 * end is live. hooks/useTheme.ts owns the actual work — it puts `dark` on <html>
 * and persists the choice to localStorage, so the preference survives a reload
 * (main.tsx re-applies it before first paint, so there is no light flash).
 *
 * Dark values for the app's own tokens live in styles/theme-dark.css.
 */

import React from 'react';
import { Moon, Sun } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipSubtitle,
  TooltipText,
  TooltipTitle,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export default function ThemeToggle() {
  const { currentTheme, toggleTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[var(--bib-border)] bg-[var(--bib-surface)] px-2.5">
          <Sun className={cn('size-4', isDark ? 'text-[var(--bib-ink-faint)]' : 'text-[var(--bib-ink)]')} aria-hidden />
          <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Dark mode" />
          <Moon className={cn('size-4', isDark ? 'text-[var(--bib-ink)]' : 'text-[var(--bib-ink-faint)]')} aria-hidden />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipText>
          <TooltipTitle>{isDark ? 'Switch to light mode' : 'Switch to dark mode'}</TooltipTitle>
          <TooltipSubtitle>Remembered on this device</TooltipSubtitle>
        </TooltipText>
      </TooltipContent>
    </Tooltip>
  );
}
