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

import React, { Suspense, lazy, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import ErrorReporterProvider from './components/ErrorBoundary/ErrorBoundary';
import { PanelState } from './components/Panel/Panel';
import RouteErrorBoundary from './components/Panel/RouteErrorBoundary';
import SideNav from './components/SideNav/SideNav';
import TopNav from './components/TopNav/TopNav';
import { AsOfProvider, useAsOf } from './contexts/AsOfProvider';
import './styles/before-it-breaks.css';

const Overview = lazy(() => import('./pages/Overview/Overview'));
const Buildings = lazy(() => import('./pages/Buildings/Buildings'));
const PlanB = lazy(() => import('./pages/PlanB/PlanB'));
const Backtest = lazy(() => import('./pages/Backtest/Backtest'));
const Building = lazy(() => import('./pages/Building/Building'));
const Asset = lazy(() => import('./pages/Asset/Asset'));
const WorkOrders = lazy(() => import('./pages/WorkOrders/WorkOrders'));
const Predictions = lazy(() => import('./pages/Predictions/Predictions'));
const AgentDrawer = lazy(() => import('./components/AgentDrawer/AgentDrawer'));

/** Pages that already mount their own <AgentDrawer> (Anuva's) — don't double it there. */
const ROUTES_WITH_OWN_DRAWER = [/^\/building\//, /^\/asset\//, /^\/workorders/];

/**
 * Anuva's AgentDrawer (floating "✦ Ask the agent" trigger + side panel) on every page
 * that doesn't already render it, fed the global as-of date.
 */
function GlobalAgentDrawer() {
  const { asOf } = useAsOf();
  const { pathname } = useLocation();
  if (ROUTES_WITH_OWN_DRAWER.some((pattern) => pattern.test(pathname))) return null;
  return (
    <RouteErrorBoundary name="The agent drawer">
      <Suspense fallback={null}>
        <AgentDrawer asOf={asOf} />
      </Suspense>
    </RouteErrorBoundary>
  );
}

/**
 * Interim bridge: AgentDrawer owns its open state and exposes no `open` prop yet, so the
 * top-bar button presses the drawer's own floating trigger. Returns false when no
 * trigger is mounted, and the button falls back to its explanatory popover.
 * Replace with shared open state once AgentDrawer accepts `open` / `onOpenChange`.
 */
function openAgentDrawer(): boolean {
  const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.classList.contains('fixed') && button.textContent?.trim() === 'Ask the agent',
  );
  if (!trigger) return false;
  trigger.click();
  return true;
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
  // Light theme only (FRONTEND §2): the projector build never flips to dark, even if an
  // earlier session stored a dark preference.
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <ErrorReporterProvider>
      <AsOfProvider>
        <div className="flex h-screen max-w-full flex-col overflow-hidden">
          <TopNav onAskAgent={openAgentDrawer} />
          <div className="flex min-h-0 flex-1">
            <SideNav />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex-1 overflow-auto bg-[var(--c3-style-basic-bg-page)]">
                <AppRoutes />
              </main>
            </div>
          </div>
          <GlobalAgentDrawer />
        </div>
      </AsOfProvider>
    </ErrorReporterProvider>
  );
}
