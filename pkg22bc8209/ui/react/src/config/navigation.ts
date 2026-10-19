/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { ClipboardList, FlaskConical, House, ShieldAlert, TrendingUp } from 'lucide-react';

import { NavigationItem } from '@/types/navigation';

/**
 * Navigation configuration for the application
 * To add a new page:
 * 1. Add a new item to this array
 * 2. Make sure the path matches your route in App.tsx
 * 3. Add the corresponding page component
 */
export const navigationConfig: NavigationItem[] = [
  {
    id: 'dashboard',
    path: '/',
    icon: House,
    iconActive: House,
    label: 'Campus health',
    tooltip: 'What needs attention today',
  },
  {
    id: 'planb',
    path: '/planb',
    icon: ShieldAlert,
    iconActive: ShieldAlert,
    label: 'Plan B',
    tooltip: 'Simulate a cooling loop failure',
  },
  // Anuva's top-level page (CONTRACT §5.4 — nav lives in Arnav's navigation.ts; added
  // directly since no shell PR has landed yet. Building/Asset are detail pages, not navs.
  {
    id: 'workorders',
    path: '/workorders',
    icon: ClipboardList,
    iconActive: ClipboardList,
    label: 'Work Orders',
    tooltip: 'Work Orders',
  },
  // Vibhrav's Predictions page (RiskForecast.campus, ML.md §8) — same cross-boundary note as above.
  {
    id: 'predictions',
    path: '/predictions',
    icon: TrendingUp,
    iconActive: TrendingUp,
    label: 'Predictions',
    tooltip: 'Failure probabilities by method',
  },
  {
    id: 'backtest',
    path: '/backtest',
    icon: FlaskConical,
    iconActive: FlaskConical,
    label: 'Backtest',
    tooltip: 'How early each failure was flagged',
  },

  /*
   * Example new navigation item - delete this comment and the lines below to add a new navigation item
   * {
   *   id: 'analytics',
   *   path: '/analytics',
   *   icon: faChartBarRegular,
   *   iconActive: faChartBarSolid,
   *   label: 'Analytics',
   *   tooltip: 'View Analytics & Reports'
   * },
   */
];

/**
 * Helper function to add navigation item dynamically
 */
export const addNavigationItem = (item: NavigationItem) => {
  navigationConfig.push(item);
};

/**
 * Helper function to remove navigation item
 */
export const removeNavigationItem = (id: string) => {
  const index = navigationConfig.findIndex((item) => item.id === id);
  if (index > -1) {
    navigationConfig.splice(index, 1);
  }
};

/**
 * Helper function to update badge count
 */
export const updateNavigationBadge = (id: string, badge?: number) => {
  const item = navigationConfig.find((item) => item.id === id);
  if (item) {
    item.badge = badge;
  }
};
