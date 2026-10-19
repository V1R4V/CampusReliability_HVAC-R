/*
 * SnapshotBanner — shown when the campus snapshot for the current as-of date failed
 * to load but an earlier one is still on screen, so stale numbers are never mistaken
 * for the selected date (FRONTEND §6: every error has a one-line message + Retry).
 */

import React from 'react';

import {
  Alert,
  AlertAction,
  AlertAppearanceIcon,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useAsOf } from '@/contexts/AsOfProvider';
import { formatDate } from '@/shared/api';

export default function SnapshotBanner() {
  const { asOf, snapshot, snapshotError, snapshotLoading, refreshSnapshot } = useAsOf();
  if (!snapshotError || snapshotLoading || !snapshot) return null;
  return (
    <Alert variant="soft" appearance="destructive">
      <AlertAppearanceIcon appearance="destructive" />
      <AlertContent>
        <AlertTitle>Couldn’t load {formatDate(asOf)}</AlertTitle>
        <AlertDescription>
          {snapshotError} Showing the last successful load ({formatDate(snapshot.as_of)}) instead.
        </AlertDescription>
      </AlertContent>
      <AlertAction onClick={refreshSnapshot}>Retry</AlertAction>
    </Alert>
  );
}
