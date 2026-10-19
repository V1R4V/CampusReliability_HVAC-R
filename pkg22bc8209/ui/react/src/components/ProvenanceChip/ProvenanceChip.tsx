/*
 * ProvenanceChip: retired on the owner's call (2026-10-19). Data provenance (what is real,
 * synthetic or estimated) is stated out loud in the pitch and recorded in PROJECT.md / docs
 * rather than shown as chips on every card. The component stays so existing call sites
 * (`chip=` props on KpiTile / Panel and inline uses) keep compiling, but it renders nothing.
 */

import type { Provenance } from '@/shared/api';

export interface ProvenanceChipProps {
  kind: Provenance;
  size?: 'sm' | 'md';
  title?: string;
  className?: string;
}

export default function ProvenanceChip(_props: ProvenanceChipProps): null {
  return null;
}
