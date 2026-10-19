/*
 * SideNav — left navigation on the C3 SideNavPanelV2, driven by config/navigation.ts.
 *
 * Light theme only (FRONTEND §2), so the template's theme toggle is gone; the footer
 * instead carries the data-provenance legend so the honesty labels are explained on
 * every screen. The Work orders item shows how many agent-drafted work orders await
 * approval (from the shared campus snapshot).
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { SideNavPanelV2, SideNavPanelV2Item } from '@/components/ui/side-nav-panel-v2';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { navigationConfig } from '@/config/navigation';
import { useAsOf } from '@/contexts/AsOfProvider';
import { DATA_SOURCE } from '@/shared/api';
import { NavigationItem } from '@/types/navigation';

// Persisted so a refresh keeps the rail expanded/collapsed the way the presenter left it.
const SIDENAV_EXPANDED_KEY = 'c3.sidenav.expanded';

const readStoredExpanded = (): boolean => {
  try {
    const stored = window.localStorage.getItem(SIDENAV_EXPANDED_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    // localStorage can be unavailable (private mode, blocked cookies) — default to expanded.
    return true;
  }
};

function ProvenanceLegend() {
  return (
    <div className="flex flex-col gap-2 px-2 text-[12px] leading-4 text-[var(--bib-ink-muted)]">
      <span className="font-semibold uppercase tracking-[0.06em]">Data provenance</span>
      <div className="flex items-start gap-2">
        <ProvenanceChip kind="REAL" size="sm" />
        <span>weather · buildings · plants · costs</span>
      </div>
      <div className="flex items-start gap-2">
        <ProvenanceChip kind="SYNTHETIC" size="sm" />
        <span>sensors · loop layout · planted failures</span>
      </div>
      <div className="flex items-start gap-2">
        <ProvenanceChip kind="ESTIMATE" size="sm" />
        <span>$/day figures</span>
      </div>
      {DATA_SOURCE === 'fixtures' ? (
        <span className="font-semibold text-[var(--bib-status-due)]">Fixture mode — not live data</span>
      ) : null}
    </div>
  );
}

export default function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState<boolean>(readStoredExpanded);
  const { pendingWorkOrders } = useAsOf();

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDENAV_EXPANDED_KEY, String(expanded));
    } catch {
      // Ignore storage failures — the toggle still works for this session.
    }
  }, [expanded]);

  const isActiveRoute = (item: NavigationItem): boolean => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  };

  // Controlled value must be a string ('' when nothing matches) so the panel never
  // flips controlled → uncontrolled.
  const activeValue = navigationConfig.find(isActiveRoute)?.path ?? '';

  const badgeFor = (item: NavigationItem): number | undefined => {
    if (item.id === 'workorders') return pendingWorkOrders > 0 ? pendingWorkOrders : undefined;
    return item.badge;
  };

  return (
    <SideNavPanelV2
      expanded={expanded}
      onExpandedChange={setExpanded}
      value={activeValue}
      onValueChange={(path) => navigate(path)}
      className="shrink-0 border-r border-[var(--c3-style-basic-border-border)] bg-[var(--c3-style-basic-bg-primary)]"
      footer={expanded ? <ProvenanceLegend /> : undefined}
    >
      {navigationConfig.map((item) => {
        const badge = badgeFor(item);
        return (
          <SideNavPanelV2Item
            key={item.id}
            value={item.path}
            icon={<item.icon />}
            label={<span className="text-[16px] leading-6">{item.label}</span>}
            title={item.tooltip}
            disabled={item.disabled}
            trailing={
              badge ? (
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--bib-wo)] px-1.5 text-[12px] font-semibold text-[var(--bib-wo)]"
                  aria-label={`${badge} pending approval`}
                >
                  {badge}
                </span>
              ) : undefined
            }
          />
        );
      })}
    </SideNavPanelV2>
  );
}
