/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import { useMemo } from 'react';
import { STATUS_COLOR, STATUS_LABEL } from '@/components/RiskChart/statusColors';
import type { AssetStatus, CampusBuilding, CampusPlant, CampusSegment } from '@/Interfaces';

interface SchematicProps {
  plants: CampusPlant[];
  segments: CampusSegment[];
  buildings: CampusBuilding[];
  /** Segment drawn emphasized (Plan B selection). */
  highlightSegment?: string | null;
  /** Buildings shown as having lost service (Plan B animation). */
  darkened?: string[];
  onBuildingClick?: (buildingId: string) => void;
  onSegmentClick?: (segmentId: string) => void;
}

const WIDTH = 640;
const ROW_H = 64;
const TOP = 16;
const PLANT_X = 8;
const PLANT_W = 118;
const SEG_LABEL_X = PLANT_X + PLANT_W + 14;
const FIRST_DOT_X = SEG_LABEL_X + 84;
const RIGHT_PAD = 36;
const DARK = '#9CA3AF';

/** Dots for healthy things stay muted so the eye goes to amber/red (FRONTEND §2). */
function dotColor(status: AssetStatus): string {
  return status === 'HEALTHY' ? '#86B98A' : STATUS_COLOR[status];
}

/** Plant names wrap onto two lines inside the plant box ("West Campus" / "Cogeneration"). */
function plantLines(name: string): string[] {
  const short = name.replace(/ (Heating Plant|Facility)$/, '');
  const words = short.split(' ');
  if (short.length <= 14 || words.length < 2) return [short];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function shortName(name: string): string {
  const trimmed = name.replace(/\b(Building|Hall)\b/g, '').replace(/\s+/g, ' ').trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 13)}…` : trimmed;
}

/**
 * Network schematic (docs/FRONTEND.md §5.1/§5.5): plants on the left feed loop segments, each
 * segment a line of the buildings it serves. Line color = segment worst status, dot color =
 * building worst status. Doubles as the Plan B view via `highlightSegment` / `darkened`.
 */
export default function Schematic({
  plants,
  segments,
  buildings,
  highlightSegment,
  darkened = [],
  onBuildingClick,
  onSegmentClick,
}: SchematicProps) {
  const layout = useMemo(() => {
    const byPlant = plants.map((p) => ({
      plant: p,
      segments: segments
        .filter((s) => s.plant_id === p.plant_id)
        .sort((a, b) => a.segment_id.localeCompare(b.segment_id))
        .map((s) => ({ segment: s, buildings: buildings.filter((b) => b.segment_id === s.segment_id) })),
    }));
    const maxBuildings = Math.max(1, ...segments.map((s) => buildings.filter((b) => b.segment_id === s.segment_id).length));
    const spacing = Math.min(96, (WIDTH - FIRST_DOT_X - RIGHT_PAD) / Math.max(1, maxBuildings - 1));
    let row = 0;
    const groups = byPlant.map((g) => {
      const startRow = row;
      const rows = g.segments.map((s) => ({ ...s, y: TOP + (row++ + 0.5) * ROW_H }));
      return { plant: g.plant, rows, y0: TOP + startRow * ROW_H, y1: TOP + Math.max(row, startRow + 1) * ROW_H };
    });
    return { groups, spacing, height: TOP * 2 + Math.max(row, 1) * ROW_H };
  }, [plants, segments, buildings]);

  const dark = new Set(darkened);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${layout.height}`} className="h-auto w-full" role="img" aria-label="Campus utility network">
      {layout.groups.map(({ plant, rows, y0, y1 }) => (
        <g key={plant.plant_id}>
          <rect x={PLANT_X} y={y0 + 6} width={PLANT_W} height={y1 - y0 - 12} rx={8} fill="#F3F4F6" stroke="#D1D5DB" />
          {plantLines(plant.name).map((line, i, lines) => (
            <text
              key={line}
              x={PLANT_X + PLANT_W / 2}
              y={(y0 + y1) / 2 + (i - lines.length / 2) * 15 + 6}
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#111827"
            >
              {line}
            </text>
          ))}
          {rows.map(({ segment, buildings: segBuildings, y }) => {
            const selected = highlightSegment === segment.segment_id;
            const faded = highlightSegment != null && !selected;
            const lineColor = dotColor(segment.worst_status);
            const lastX = FIRST_DOT_X + Math.max(0, segBuildings.length - 1) * layout.spacing;
            return (
              <g key={segment.segment_id} opacity={faded ? 0.35 : 1}>
                <line
                  x1={PLANT_X + PLANT_W}
                  y1={y}
                  x2={lastX}
                  y2={y}
                  stroke={lineColor}
                  strokeWidth={selected ? 6 : segment.worst_status === 'HEALTHY' ? 2 : 4}
                  strokeLinecap="round"
                />
                <g
                  className={onSegmentClick ? 'cursor-pointer' : undefined}
                  onClick={onSegmentClick ? () => onSegmentClick(segment.segment_id) : undefined}
                >
                  <rect x={SEG_LABEL_X - 4} y={y - 12} width={70} height={24} rx={12} fill="white" stroke={lineColor} />
                  <text x={SEG_LABEL_X + 31} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#111827">
                    {segment.segment_id}
                  </text>
                  <title>
                    {segment.name} — {STATUS_LABEL[segment.worst_status]}
                    {onSegmentClick ? ' · click to simulate failure' : ''}
                  </title>
                </g>
                {segBuildings.map((b, i) => {
                  const x = FIRST_DOT_X + i * layout.spacing;
                  const isDark = dark.has(b.building_id);
                  return (
                    <g
                      key={b.building_id}
                      className={onBuildingClick ? 'cursor-pointer' : undefined}
                      onClick={onBuildingClick ? () => onBuildingClick(b.building_id) : undefined}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={10}
                        fill={isDark ? '#1F2937' : dotColor(b.worst_status)}
                        stroke={isDark ? DARK : 'white'}
                        strokeWidth={2}
                        strokeDasharray={isDark ? '3 2' : undefined}
                        style={{ transition: 'fill 200ms ease' }}
                      />
                      <text x={x} y={y + 26} textAnchor="middle" fontSize={12} fill={isDark ? DARK : '#374151'}>
                        {shortName(b.name)}
                      </text>
                      <title>
                        {b.name} — {isDark ? 'loses cooling' : STATUS_LABEL[b.worst_status]}
                      </title>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
