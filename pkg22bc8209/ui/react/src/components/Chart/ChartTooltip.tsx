/*
 * ChartTooltip — the one tooltip body for every Recharts chart: a small card with the
 * x-value as a title and one row per series (swatch · name · value). Text wears text
 * tokens; only the swatch carries the series colour (dataviz: text never wears the
 * series colour).
 */

import React from 'react';

export interface ChartTooltipRow {
  key: string;
  name: React.ReactNode;
  value: React.ReactNode;
  color?: string;
  /** Draw the swatch as a dashed line (reference series) instead of a solid one. */
  dashed?: boolean;
}

export interface ChartTooltipProps {
  title?: React.ReactNode;
  rows: ChartTooltipRow[];
  footer?: React.ReactNode;
}

export default function ChartTooltip({ title, rows, footer }: ChartTooltipProps) {
  return (
    <div className="bib-card min-w-[160px] px-3 py-2 text-[13px] shadow-[var(--bib-shadow-raised)]">
      {title ? <div className="mb-1 font-semibold leading-5 text-[var(--bib-ink)]">{title}</div> : null}
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 leading-5">
            <span className="inline-flex items-center gap-2 text-[var(--bib-ink-muted)]">
              {row.color ? (
                <span
                  aria-hidden
                  className="inline-block h-[3px] w-4 rounded-full"
                  style={
                    row.dashed
                      ? { backgroundImage: `repeating-linear-gradient(90deg, ${row.color} 0 4px, transparent 4px 7px)` }
                      : { background: row.color }
                  }
                />
              ) : null}
              {row.name}
            </span>
            <span className="font-semibold tabular-nums text-[var(--bib-ink)]">{row.value}</span>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-1 text-[12px] leading-4 text-[var(--bib-ink-muted)]">{footer}</div> : null}
    </div>
  );
}
