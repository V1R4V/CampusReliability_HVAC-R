/*
 * SideNav — left navigation on the C3 SideNavPanelV2, driven by config/navigation.ts.
 *
 * Items are grouped under the three headings from the config (Today · Act · Evidence) so
 * the rail reads as the manager's three questions, not a flat list. Light theme only
 * (FRONTEND §2), so the template's theme toggle is gone. The Work orders item shows how
 * many agent-drafted work orders await approval (from the shared campus snapshot).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { SideNavPanelV2, SideNavPanelV2Item, SideNavPanelV2Section } from '@/components/ui/side-nav-panel-v2';
import { NAV_SECTIONS, navigationConfig } from '@/config/navigation';
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

/** Only ever visible when a developer runs with VITE_USE_FIXTURES=true; never in the live app. */
function FixtureModeNotice() {
  if (DATA_SOURCE !== 'fixtures') return null;
  return (
    <div className="px-2 text-[12px] font-semibold leading-4 text-[var(--bib-status-due)]">Fixture mode: not live data</div>
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
  // flips controlled → uncontrolled. Detail pages light up their parent list page.
  const activeValue = useMemo(() => {
    const direct = navigationConfig.find(isActiveRoute)?.path;
    if (direct) return direct;
    if (location.pathname.startsWith('/building/')) return '/buildings';
    if (location.pathname.startsWith('/asset/')) return '/overview';
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const badgeFor = (item: NavigationItem): number | undefined => {
    if (item.id === 'workorders') return pendingWorkOrders > 0 ? pendingWorkOrders : undefined;
    return item.badge;
  };

  const sections = useMemo(() => {
    const known = NAV_SECTIONS.map((label) => ({
      label,
      items: navigationConfig.filter((item) => item.section === label),
    })).filter((section) => section.items.length > 0);
    const loose = navigationConfig.filter((item) => !item.section || !NAV_SECTIONS.includes(item.section as (typeof NAV_SECTIONS)[number]));
    return loose.length > 0 ? [...known, { label: 'More', items: loose }] : known;
  }, []);

  const renderItem = (item: NavigationItem) => {
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
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--bib-wo)] bg-[var(--bib-surface)] px-1.5 text-[12px] font-semibold tabular-nums text-[var(--bib-wo)]"
              aria-label={`${badge} pending approval`}
            >
              {badge}
            </span>
          ) : undefined
        }
      />
    );
  };

  return (
    <SideNavPanelV2
      expanded={expanded}
      onExpandedChange={setExpanded}
      value={activeValue}
      onValueChange={(path) => navigate(path)}
      className="shrink-0 border-r border-[var(--bib-border)] bg-[var(--bib-surface)]"
      footer={expanded && DATA_SOURCE === 'fixtures' ? <FixtureModeNotice /> : undefined}
    >
      {sections.map((section, index) => (
        <SideNavPanelV2Section
          key={section.label}
          label={<span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--bib-ink-faint)]">{section.label}</span>}
          divider={index < sections.length - 1}
        >
          {section.items.map(renderItem)}
        </SideNavPanelV2Section>
      ))}
    </SideNavPanelV2>
  );
}
