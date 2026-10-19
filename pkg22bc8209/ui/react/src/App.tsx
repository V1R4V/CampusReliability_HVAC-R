/*
 * Before It Breaks — application shell (owner: Arnav).
 *
 * TopNav (as-of scrubber, weather, Ask the agent) and SideNav are rendered here,
 * OUTSIDE <Routes>, so they are on every screen; the router only swaps <main>.
 * AsOfProvider holds the one global as-of date + the campus snapshot for it.
 *
 * Routes (FRONTEND §4): /overview · /buildings · /planb/:segment? · /backtest (Arnav),
 * /building/:buildingId · /asset/:assetId · /workorders (Anuva), /predictions (Vibhrav).
 * Pages are code-split (`React.lazy`) and wrapped in a RouteErrorBoundary, so a page that
 * fails to load or render fails on its own route with a Retry — never a blank app.
 */

import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import ErrorReporterProvider from './components/ErrorBoundary/ErrorBoundary';
import { PanelState } from './components/Panel/Panel';
import RouteErrorBoundary from './components/Panel/RouteErrorBoundary';
import SideNav from './components/SideNav/SideNav';
import TopNav from './components/TopNav/TopNav';
import { AsOfProvider, useAsOf } from './contexts/AsOfProvider';
import './styles/before-it-breaks.css';
import './styles/theme-dark.css';

const RELOAD_FLAG_PREFIX = 'bib.chunkReload.';

/**
 * `React.lazy` that self-heals a failed chunk load. The dev server returns 500 for a module
 * while another save is mid-flight (lint error, half-written file); `React.lazy` then caches
 * the rejected import for the life of the page, so the route stays on "Failed to fetch
 * dynamically imported module" even after the file is fixed. On the first failure we reload
 * once (flag in sessionStorage); if it fails again the error surfaces in RouteErrorBoundary.
 */
function lazyWithReload<T extends React.ComponentType<unknown>>(
  name: string,
  loader: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  const flag = RELOAD_FLAG_PREFIX + name;
  return lazy(() =>
    loader()
      .then((mod) => {
        try {
          window.sessionStorage.removeItem(flag);
        } catch {
          // storage unavailable — nothing to clear
        }
        return mod;
      })
      .catch((err: unknown) => {
        let reloaded = false;
        try {
          reloaded = window.sessionStorage.getItem(flag) === '1';
          if (!reloaded) window.sessionStorage.setItem(flag, '1');
        } catch {
          // storage unavailable — fall through to a single reload attempt
        }
        if (!reloaded) {
          window.location.reload();
          return new Promise<{ default: T }>(() => undefined); // keep Suspense pending while reloading
        }
        throw err;
      }),
  );
}

const Overview = lazyWithReload('Overview', () => import('./pages/Overview/Overview'));
const Buildings = lazyWithReload('Buildings', () => import('./pages/Buildings/Buildings'));
const PlanB = lazyWithReload('PlanB', () => import('./pages/PlanB/PlanB'));
const Backtest = lazyWithReload('Backtest', () => import('./pages/Backtest/Backtest'));
const Building = lazyWithReload('Building', () => import('./pages/Building/Building'));
const Asset = lazyWithReload('Asset', () => import('./pages/Asset/Asset'));
const WorkOrders = lazyWithReload('WorkOrders', () => import('./pages/WorkOrders/WorkOrders'));
const Predictions = lazyWithReload('Predictions', () => import('./pages/Predictions/Predictions'));
const AgentDrawer = lazyWithReload('AgentDrawer', () => import('./components/AgentDrawer/AgentDrawer'));

/** The one agent drawer, on every page, opened only from the TopNav button. */
function GlobalAgentDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { asOf } = useAsOf();
  if (!open) return null;
  return (
    <RouteErrorBoundary name="The agent drawer">
      <Suspense fallback={null}>
        <AgentDrawer asOf={asOf} open={open} onOpenChange={onOpenChange} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

function PageLoading() {
  return (
    <div className="p-6">
      <PanelState state="loading" lines={6} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-[16px] text-[var(--bib-ink-muted)]">
      <p>
        Page not found.{' '}
        <Link to="/overview" className="font-medium text-[var(--bib-ink)] underline underline-offset-2">
          Back to Overview
        </Link>
      </p>
    </div>
  );
}

function AppRoutes() {
  const { pathname } = useLocation();
  return (
    // Keyed on the path so a caught error clears as soon as the user navigates away.
    <RouteErrorBoundary key={pathname} name="This page">
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/buildings" element={<Buildings />} />
          <Route path="/planb/:segment?" element={<PlanB />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/building/:buildingId" element={<Building />} />
          <Route path="/asset/:assetId" element={<Asset />} />
          <Route path="/workorders" element={<WorkOrders />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  // Theme: hooks/useTheme (via TopNav/ThemeToggle) owns the `dark` class on <html>, and
  // main.tsx re-applies the stored choice before first paint. Light stays the default
  // (FRONTEND §2); nothing here should strip the class or the toggle and the page disagree.
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <ErrorReporterProvider>
      <AsOfProvider>
        <div className="flex h-screen max-w-full flex-col overflow-hidden bg-[var(--bib-canvas)] text-[var(--bib-ink)]">
          <TopNav
            onAskAgent={() => {
              setAgentOpen(true);
              return true;
            }}
          />
          <div className="flex min-h-0 flex-1">
            <SideNav />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 overflow-auto bg-[var(--bib-canvas)]">
                <AppRoutes />
              </main>
            </div>
          </div>
          <GlobalAgentDrawer open={agentOpen} onOpenChange={setAgentOpen} />
        </div>
      </AsOfProvider>
    </ErrorReporterProvider>
  );
}
