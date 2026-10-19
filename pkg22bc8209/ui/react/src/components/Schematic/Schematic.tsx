/*
 * Schematic — the campus chilled-water network at a glance (FRONTEND §5.1, §6).
 *
 * Plants (left) feed loop segments (one row each, line colour = segment worst status);
 * buildings sit on their loop as dots (dot colour = building worst status). Click a
 * dot → the building dashboard; click a loop → Plan B for that segment. Hover → name
 * and status. Fully data-driven from `campusSnapshot` — no coordinates are hardcoded,
 * so it tracks whatever topology the backend returns.
 *
 * `focusSegment` renders a single loop large (Plan B); `darkened` buildings are drawn
 * as having lost cooling (the Plan B reveal); `highlightSegment` washes a row.
 * HTML + CSS rather than a scaled SVG so text stays at real CSS pixels on a projector.
 */

import React, { useMemo } from 'react';
import { Factory } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipSubtitle,
  TooltipText,
  TooltipTitle,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ProvenanceChip from '@/components/ProvenanceChip/ProvenanceChip';
import { statusLabel } from '@/components/StatusPill/StatusPill';
import { CRITICALITY_LABEL, type Criticality, type Status } from '@/shared/api';
import { shortBuildingName } from './shortBuildingName';

export { shortBuildingName };

export interface SchematicPlant {
  plant_id: string;
  name: string;
}

export interface SchematicSegment {
  segment_id: string;
  plant_id: string;
  name: string;
  worst_status: Status;
}

export interface SchematicBuilding {
  building_id: string;
  name: string;
  segment_id: string;
  criticality: Criticality | string;
  worst_status: Status;
}

export interface SchematicProps {
  plants: SchematicPlant[];
  segments: SchematicSegment[];
  buildings: SchematicBuilding[];
  /** Wash this loop's row to draw the eye (Plan B). */
  highlightSegment?: string | null;
  /** Render only this loop, larger (Plan B). */
  focusSegment?: string | null;
  /** Buildings drawn as having lost cooling (Plan B reveal). */
  darkened?: string[];
  onBuildingClick?: (buildingId: string) => void;
  onSegmentClick?: (segmentId: string) => void;
  showLegend?: boolean;
  className?: string;
}

/* Two geometries: the campus view (compact rows) and the single-loop focus view. All
   vertical positions are fixed pixel offsets so dots, lines and labels line up. The segment
   label column at the left of each row is narrow in the campus view (its name wraps to two
   lines) so nine buildings on one loop still get ~36px each at 1440px wide. */
const GEOMETRY = {
  normal: {
    row: 'h-[80px]',
    line: 'top-[45px]',
    trunk: 'top-[45px] bottom-[32px]',
    dot: 'top-[32px] size-7',
    inner: 'size-4',
    labelTop: 'top-[10px]',
    labelBottom: 'top-[60px]',
    label: 'max-w-[82px] text-[13px] leading-[18px]',
    segmentLabelWidth: 'max-w-[96px]',
    nodes: 'left-[118px] right-6',
  },
  focus: {
    row: 'h-[112px]',
    line: 'top-[62px]',
    trunk: 'top-[62px] bottom-[47px]',
    dot: 'top-[45px] size-9',
    inner: 'size-[22px]',
    labelTop: 'top-[16px]',
    labelBottom: 'top-[84px]',
    label: 'max-w-[150px] text-[15px] leading-[22px]',
    segmentLabelWidth: 'max-w-[124px]',
    nodes: 'left-[150px] right-7',
  },
} as const;

type Geometry = (typeof GEOMETRY)[keyof typeof GEOMETRY];

const LEGEND_STATUSES: Status[] = ['HEALTHY', 'WATCH', 'INSPECTION_DUE', 'FAILED'];

/**
 * Label width by how crowded the loop is: sparse loops can spell names out. Crowded loops
 * alternate labels above/below the line, so a label may span almost two slots (190% of its
 * own node) before it would touch the next label on the same side.
 */
function labelWidthClass(count: number): string {
  if (count <= 1) return 'max-w-[220px]';
  if (count === 2) return 'max-w-[180px]';
  if (count === 3) return 'max-w-[130px]';
  if (count === 4) return 'max-w-[100px]';
  return 'max-w-[196%]';
}

interface BuildingNodeProps {
  building: SchematicBuilding;
  geometry: Geometry;
  labelOnTop: boolean;
  /** Overrides the geometry's label max-width on sparse loops. */
  labelWidth: string;
  dark: boolean;
  onClick?: (buildingId: string) => void;
}

function BuildingNode({ building, geometry, labelOnTop, labelWidth, dark, onClick }: BuildingNodeProps) {
  const status: Status = dark ? 'FAILED' : building.worst_status;
  const due = !dark && building.worst_status === 'INSPECTION_DUE';
  const criticality = CRITICALITY_LABEL[building.criticality as Criticality] ?? building.criticality;
  const statusText = `${statusLabel(status)}${dark ? ' · cooling lost in this scenario' : ''}`;

  const dot = (
    <span
      className={cn(
        'relative block rounded-full bg-[var(--bib-status-color)] ring-2 ring-[var(--bib-surface)] shadow-[0_1px_3px_rgb(17_24_39_/_0.25)]',
        geometry.inner,
        status === 'HEALTHY' && 'opacity-75',
      )}
    >
      {due ? <span aria-hidden className="bib-pulse absolute inset-0 rounded-full" /> : null}
    </span>
  );

  const hitClasses = cn(
    'pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full outline-none',
    geometry.dot,
  );

  return (
    <div data-status={status} className="relative min-w-0 flex-1">
      <Tooltip>
        <TooltipTrigger asChild>
          {onClick ? (
            <button
              type="button"
              onClick={() => onClick(building.building_id)}
              aria-label={`${building.name}, ${statusText}. Open building dashboard`}
              className={cn(
                hitClasses,
                'hover:bg-[var(--c3-style-basic-bg-hover)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]',
              )}
            >
              {dot}
            </button>
          ) : (
            <span className={hitClasses}>{dot}</span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top">
          <TooltipText>
            <TooltipTitle>{building.name}</TooltipTitle>
            <TooltipSubtitle>
              {criticality} · {statusText}
            </TooltipSubtitle>
          </TooltipText>
        </TooltipContent>
      </Tooltip>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1/2 w-max -translate-x-1/2 truncate text-center',
          geometry.label,
          labelWidth,
          labelOnTop ? geometry.labelTop : geometry.labelBottom,
          dark ? 'text-[var(--bib-ink-muted)]' : 'text-[var(--bib-ink)]',
          due ? 'font-semibold' : 'font-normal',
        )}
      >
        {shortBuildingName(building.name)}
      </span>
    </div>
  );
}

interface SegmentRowProps {
  segment: SchematicSegment;
  buildings: SchematicBuilding[];
  geometry: Geometry;
  highlighted: boolean;
  darkened: Set<string>;
  onBuildingClick?: (buildingId: string) => void;
  onSegmentClick?: (segmentId: string) => void;
}

function SegmentRow({
  segment,
  buildings,
  geometry,
  highlighted,
  darkened,
  onBuildingClick,
  onSegmentClick,
}: SegmentRowProps) {
  const zigzag = buildings.length > 4;
  const labelWidth = labelWidthClass(buildings.length);
  const lineContent = (
    <>
      <span
        className={cn(
          'absolute left-0 right-0 h-[3px] rounded-r-full bg-[var(--bib-status-color)]',
          geometry.line,
          segment.worst_status === 'HEALTHY' && 'opacity-60',
        )}
      />
      <span className="absolute left-3 top-[8px] flex flex-col items-start">
        <span className="text-[15px] font-semibold leading-5 text-[var(--bib-ink)]">{segment.segment_id}</span>
        <span className={cn('line-clamp-2 whitespace-normal text-left text-[13px] leading-4 text-[var(--bib-ink-muted)]', geometry.segmentLabelWidth)}>
          {segment.name}
        </span>
      </span>
    </>
  );

  return (
    <div data-status={segment.worst_status} className={cn('relative', geometry.row)}>
      {onSegmentClick ? (
        <button
          type="button"
          onClick={() => onSegmentClick(segment.segment_id)}
          aria-label={`${segment.segment_id} · ${segment.name}, ${statusLabel(segment.worst_status)}. Open the outage plan for this loop`}
          className={cn(
            'absolute inset-0 z-0 rounded-md text-left outline-none hover:bg-[var(--c3-style-basic-bg-hover)] focus-visible:shadow-[0_0_0_2px_var(--c3-style-shadow-ring-accent)]',
            highlighted && 'bg-[var(--bib-canvas)]',
          )}
        >
          {lineContent}
        </button>
      ) : (
        <div className={cn('absolute inset-0 z-0 rounded-md', highlighted && 'bg-[var(--bib-canvas)]')}>{lineContent}</div>
      )}

      <div className={cn('pointer-events-none absolute inset-y-0 z-10 flex', geometry.nodes)}>
        {buildings.map((building, index) => (
          <BuildingNode
            key={building.building_id}
            building={building}
            geometry={geometry}
            labelOnTop={zigzag && index % 2 === 0}
            labelWidth={labelWidth}
            dark={darkened.has(building.building_id)}
            onClick={onBuildingClick}
          />
        ))}
        {buildings.length === 0 ? (
          <span className={cn('absolute left-0 text-[13px] italic text-[var(--bib-ink-muted)]', geometry.labelBottom)}>
            No buildings on this loop
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] leading-4 text-[var(--bib-ink-muted)]">
      {LEGEND_STATUSES.map((status) => (
        <span key={status} data-status={status} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[var(--bib-status-color)]" aria-hidden />
          {statusLabel(status)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[3px] w-6 rounded-full bg-[var(--bib-ink-muted)]" aria-hidden />
        line = loop status · dot = building status
      </span>
      <ProvenanceChip kind="SYNTHETIC" size="sm" title="The loop topology is synthetic; plants and buildings are real." />
    </div>
  );
}

export default function Schematic({
  plants,
  segments,
  buildings,
  highlightSegment = null,
  focusSegment = null,
  darkened,
  onBuildingClick,
  onSegmentClick,
  showLegend = true,
  className,
}: SchematicProps) {
  const geometry = focusSegment ? GEOMETRY.focus : GEOMETRY.normal;

  const groups = useMemo(() => {
    const visibleSegments = focusSegment ? segments.filter((s) => s.segment_id === focusSegment) : segments;
    const byPlant = new Map<string, SchematicSegment[]>();
    visibleSegments.forEach((segment) => {
      const list = byPlant.get(segment.plant_id) ?? [];
      list.push(segment);
      byPlant.set(segment.plant_id, list);
    });
    const knownPlants = plants.filter((p) => byPlant.has(p.plant_id));
    const unknownPlants = Array.from(byPlant.keys())
      .filter((id) => !plants.some((p) => p.plant_id === id))
      .map((id) => ({ plant_id: id, name: id }));
    return [...knownPlants, ...unknownPlants].map((plant) => ({
      plant,
      rows: (byPlant.get(plant.plant_id) ?? []).map((segment) => ({
        segment,
        buildings: buildings.filter((b) => b.segment_id === segment.segment_id),
      })),
    }));
  }, [plants, segments, buildings, focusSegment]);

  const darkenedSet = useMemo(() => new Set(darkened ?? []), [darkened]);

  if (groups.length === 0) {
    return (
      <p className={cn('text-[15px] text-[var(--bib-ink-muted)]', className)}>
        No network to draw{focusSegment ? ` for ${focusSegment}` : ''}.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid grid-cols-[150px_minmax(0,1fr)]">
        {groups.map((group) => (
          <React.Fragment key={group.plant.plant_id}>
            <div className="relative flex items-center" style={{ gridRow: `span ${group.rows.length}` }}>
              <div className="mr-[18px] flex w-full flex-col items-center gap-1.5 rounded-[6px] bg-[var(--bib-ink)] px-2 py-3 text-center text-white shadow-[0_2px_8px_rgb(17_24_39_/_0.25)]">
                <Factory className="size-5 text-white/80" aria-hidden />
                <span className="text-[13px] font-semibold leading-[17px]">{group.plant.name}</span>
              </div>
              <span aria-hidden className="absolute right-0 top-1/2 h-[3px] w-[18px] -translate-y-1/2 bg-[var(--bib-border-strong)]" />
              <span aria-hidden className={cn('absolute right-0 w-[3px] bg-[var(--bib-border-strong)]', geometry.trunk)} />
            </div>
            {group.rows.map((row) => (
              <SegmentRow
                key={row.segment.segment_id}
                segment={row.segment}
                buildings={row.buildings}
                geometry={geometry}
                highlighted={highlightSegment === row.segment.segment_id}
                darkened={darkenedSet}
                onBuildingClick={onBuildingClick}
                onSegmentClick={onSegmentClick}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      {showLegend ? <Legend /> : null}
    </div>
  );
}
