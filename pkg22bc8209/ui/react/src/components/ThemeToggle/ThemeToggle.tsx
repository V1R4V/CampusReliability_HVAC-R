/*
 * ThemeToggle — the night-mode switch in the top bar.
 *
 * Toggles the design system's `dark` class on <html> (styles/tokens.css) — which also
 * flips the app's `--bib-*` tokens via the `.dark` block in styles/before-it-breaks.css —
 * and persists the choice under the template's `ui-theme` key. It deliberately ignores
 * the OS colour-scheme preference: the app is projector-first (FRONTEND §2), so it stays
 * light unless the presenter opts in.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ui-theme';

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    // localStorage can be unavailable (private mode, blocked storage) — light by default.
    return 'light';
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export default function ThemeToggle({ className }: { className?: string }) {
  // Apply the stored theme before first paint of the tree so a reload doesn't flash light.
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStoredTheme();
    applyTheme(stored);
    return stored;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const onCheckedChange = useCallback((checked: boolean) => {
    const next: Theme = checked ? 'dark' : 'light';
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage failures are not worth surfacing — the theme still applies for this session.
    }
    document.dispatchEvent(new CustomEvent('c3-theme-changed', { detail: { theme: next } }));
  }, []);

  const dark = theme === 'dark';
  return (
    <div
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-[var(--bib-ink-muted)]', className)}
      title={dark ? 'Switch to light mode' : 'Switch to night mode'}
    >
      <Sun className={cn('size-4', !dark && 'text-[var(--bib-ink)]')} aria-hidden />
      <Switch size="sm" checked={dark} onCheckedChange={onCheckedChange} aria-label="Night mode" />
      <Moon className={cn('size-4', dark && 'text-[var(--bib-ink)]')} aria-hidden />
    </div>
  );
}
