/*
 * CriticalityBadge — what a building is for (patient care · research lab · instruction ·
 * office). Icons tell the categories apart; the badge is deliberately grey because
 * criticality is not a status (FRONTEND §2).
 */

import React from 'react';
import { Briefcase, FlaskConical, GraduationCap, HeartPulse, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CRITICALITY_LABEL, type Criticality } from '@/shared/api';

const ICONS: Record<Criticality, LucideIcon> = {
  patient_care: HeartPulse,
  research_lab: FlaskConical,
  instruction: GraduationCap,
  office: Briefcase,
};

export interface CriticalityBadgeProps {
  criticality: Criticality | string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function CriticalityBadge({ criticality, size = 'sm', className }: CriticalityBadgeProps) {
  const key = criticality as Criticality;
  const Icon = ICONS[key];
  const label = CRITICALITY_LABEL[key] ?? criticality;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-[var(--bib-border)] bg-[var(--bib-surface)] text-[var(--bib-ink-muted)]',
        size === 'sm' ? 'h-[22px] px-1.5 text-[13px]' : 'h-[26px] px-2 text-[14px]',
        className,
      )}
    >
      {Icon ? <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden /> : null}
      {label}
    </span>
  );
}
