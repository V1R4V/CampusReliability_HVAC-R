/*
 * Navigation configuration for Before It Breaks (owner: Arnav — others request items here).
 *
 * Each item maps to a <Route> in App.tsx and sits under one of three headings that mirror
 * the manager's three questions (FRONTEND §1): Today (what needs attention), Act (what do
 * I do / what if I don't) and Evidence (how we know). Overview / Buildings / Outage plan /
 * Backtest are Arnav's pages; Work orders is Anuva's; Predictions is Vibhrav's (ML.md §8).
 * Building and Asset are detail pages — routed, not listed.
 */

import { Building2, ClipboardList, History, LayoutDashboard, ShieldAlert, TrendingUp } from 'lucide-react';

import { NavigationItem } from '@/types/navigation';

export const NAV_SECTIONS = ['Today', 'Act', 'Evidence'] as const;

export const navigationConfig: NavigationItem[] = [
  {
    id: 'overview',
    path: '/overview',
    icon: LayoutDashboard,
    label: 'Overview',
    tooltip: 'What needs attention today',
    section: 'Today',
  },
  {
    id: 'buildings',
    path: '/buildings',
    icon: Building2,
    label: 'Buildings',
    tooltip: 'Every campus building and its worst system status',
    section: 'Today',
  },
  {
    id: 'planb',
    path: '/planb',
    // Renamed from "Plan B" (owner's call): says what the page answers.
    icon: ShieldAlert,
    label: 'Outage plan',
    tooltip: 'If a chilled-water loop fails',
    section: 'Act',
  },
  {
    id: 'workorders',
    path: '/workorders',
    icon: ClipboardList,
    label: 'Work orders',
    tooltip: 'Work orders drafted by the agent, awaiting approval',
    section: 'Act',
  },
  {
    id: 'predictions',
    path: '/predictions',
    icon: TrendingUp,
    label: 'Predictions',
    tooltip: 'Failure probabilities by method',
    section: 'Evidence',
  },
  {
    id: 'backtest',
    path: '/backtest',
    icon: History,
    label: 'Backtest',
    tooltip: 'How we know: lead time vs false alarms',
    section: 'Evidence',
  },
];
