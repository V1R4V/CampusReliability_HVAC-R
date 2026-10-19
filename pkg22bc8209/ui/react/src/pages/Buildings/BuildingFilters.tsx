/*
 * BuildingFilters — the one control row above the Buildings index (FRONTEND §5.2):
 * search, a system filter (icons, never colour), status chips with live counts, and the
 * cards / table switch. Systems use the same boxed Tabs as the Overview queue so the two
 * pages feel like one app.
 */

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

import { InputSearch } from '@/components/ui/input-search';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import SystemIcon from '@/components/SystemIcon/SystemIcon';
import { STATUS_LABEL, type Status } from '@/shared/api';
import { STATUS_ORDER, type SystemFilterValue, type ViewMode } from './buildingRows';

const SYSTEM_TABS: { value: SystemFilterValue; label: string }[] = [
  { value: 'all', label: 'All systems' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'heating', label: 'Heating' },
  { value: 'air', label: 'Air' },
];

export interface BuildingFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  system: SystemFilterValue;
  onSystemChange: (system: SystemFilterValue) => void;
  statuses: ReadonlySet<Status>;
  onToggleStatus: (status: Status) => void;
  /** Buildings per status under the current system filter (before the status filter). */
  counts: Record<Status, number>;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export default function BuildingFilters({
  query,
  onQueryChange,
  system,
  onSystemChange,
  statuses,
  onToggleStatus,
  counts,
  view,
  onViewChange,
}: BuildingFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="w-full max-w-[320px]">
        <InputSearch
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange('')}
          placeholder="Search buildings, loops, uses"
          aria-label="Search buildings"
        />
      </div>

      <Tabs value={system} onValueChange={(value) => onSystemChange(value as SystemFilterValue)} variant="boxed" size="md">
        <TabsList aria-label="Filter by equipment system">
          {SYSTEM_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 px-3">
              {tab.value !== 'all' ? <SystemIcon system={tab.value} size="sm" /> : null}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        {STATUS_ORDER.map((status) => {
          const active = statuses.has(status);
          const count = counts[status] ?? 0;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              data-status={status}
              disabled={count === 0 && !active}
              onClick={() => onToggleStatus(status)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[13px] font-medium outline-none transition-colors',
                'focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)] disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'border-[var(--bib-ink)] bg-[var(--bib-status-soft)] text-[var(--bib-ink)]'
                  : 'border-[var(--bib-border)] bg-[var(--bib-surface)] text-[var(--bib-ink-muted)] hover:border-[var(--bib-ink-muted)]',
              )}
            >
              <span aria-hidden className="size-2 rounded-full bg-[var(--bib-status-color)]" />
              {STATUS_LABEL[status]}
              <span className="tabular-nums text-[var(--bib-ink-muted)]">{count}</span>
            </button>
          );
        })}
      </div>

      <Tabs
        value={view}
        onValueChange={(value) => onViewChange(value as ViewMode)}
        variant="boxed"
        size="md"
        className="ml-auto"
      >
        <TabsList aria-label="View as">
          <TabsTrigger value="cards" className="gap-1.5 px-3">
            <LayoutGrid aria-hidden />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5 px-3">
            <List aria-hidden />
            Table
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
