/*
 * Navigation configuration for Before It Breaks (owner: Arnav — others request items here).
 *
 * Each item maps to a <Route> in App.tsx. Overview / Buildings / Plan B / Backtest are
 * Arnav's pages; Work orders is Anuva's; Predictions is Vibhrav's (RiskForecast, ML.md §8).
 * Building and Asset are detail pages — routed, not listed.
 */

import { Building2, ClipboardList, History, LayoutDashboard, ShieldAlert, TrendingUp } from 'lucide-react';

import { NavigationItem } from '@/types/navigation';

export const navigationConfig: NavigationItem[] = [
  {
    id: 'overview',
    path: '/overview',
    icon: LayoutDashboard,
    label: 'Overview',
    tooltip: 'What needs attention today',
  },
  {
    id: 'buildings',
    path: '/buildings',
    icon: Building2,
    label: 'Buildings',
    tooltip: 'Every campus building and its worst system status',
  },
  {
    id: 'planb',
    path: '/planb',
    icon: ShieldAlert,
    label: 'Plan B',
    tooltip: 'Simulate a chilled-water loop failure',
  },
  {
    id: 'workorders',
    path: '/workorders',
    icon: ClipboardList,
    label: 'Work orders',
    tooltip: 'Work orders drafted by the agent, awaiting approval',
  },
  {
    id: 'predictions',
    path: '/predictions',
    icon: TrendingUp,
    label: 'Predictions',
    tooltip: 'Failure probabilities by method',
  },
  {
    id: 'backtest',
    path: '/backtest',
    icon: History,
    label: 'Backtest',
    tooltip: 'How we know: lead time vs false alarms',
  },
];
