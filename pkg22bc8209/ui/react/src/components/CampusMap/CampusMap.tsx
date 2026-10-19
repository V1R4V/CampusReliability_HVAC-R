/*
 * CampusMap: the real campus on OpenStreetMap tiles (muted by a CSS filter so the status
 * dots carry the only colour), one dot per building coloured by its worst system status
 * (the same four status colours used everywhere), plants as ink squares, and a thin line
 * from each plant to the buildings on its loops. Click a dot to open the building
 * dashboard. Colour means status only (FRONTEND §2). Tiles need the browser to reach
 * tile.openstreetmap.org; dots and tooltips still render without them. (CARTO's raster
 * basemaps were tried first — they now watermark "API key required" without a key.)
 */

import 'leaflet/dist/leaflet.css';

import React, { useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, Rectangle, TileLayer, Tooltip } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';

import { STATUS_LABEL, type Status } from '@/shared/api';

/** Same hex values as the --bib-status-* tokens; Leaflet paths can't read CSS variables. */
const STATUS_HEX: Record<Status, string> = {
  HEALTHY: '#2E7D32',
  WATCH: '#F59E0B',
  INSPECTION_DUE: '#DC2626',
  FAILED: '#111827',
};
const INK_HEX = '#111827';
const INK_MUTED_HEX = '#6B7280';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface MapBuilding {
  building_id: string;
  name: string;
  lat: number;
  lon: number;
  status: Status;
  subtitle?: string;
  plant_id?: string | null;
}

export interface MapPlant {
  plant_id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface CampusMapProps {
  buildings: MapBuilding[];
  plants: MapPlant[];
  onSelect?: (buildingId: string) => void;
  className?: string;
}

const PLANT_HALF_DEG = 0.00045;

export default function CampusMap({ buildings, plants, onSelect, className }: CampusMapProps) {
  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const pts = [...buildings.map((b) => [b.lat, b.lon]), ...plants.map((p) => [p.lat, p.lon])] as [number, number][];
    if (pts.length === 0) return null;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    return [
      [Math.min(...lats) - 0.002, Math.min(...lons) - 0.003],
      [Math.max(...lats) + 0.002, Math.max(...lons) + 0.003],
    ];
  }, [buildings, plants]);

  const feeds = useMemo(() => {
    const byPlant = new Map(plants.map((p) => [p.plant_id, p] as const));
    return buildings
      .map((b) => {
        const plant = b.plant_id ? byPlant.get(b.plant_id) : undefined;
        return plant ? ([[plant.lat, plant.lon], [b.lat, b.lon]] as LatLngExpression[]) : null;
      })
      .filter((line): line is LatLngExpression[] => line !== null);
  }, [buildings, plants]);

  // Draw healthy dots first so the ones that need attention sit on top.
  const ordered = useMemo(
    () => [...buildings].sort((a, b) => (a.status === 'HEALTHY' ? -1 : 0) - (b.status === 'HEALTHY' ? -1 : 0)),
    [buildings],
  );

  if (!bounds) {
    return <div className={className}>No building coordinates available.</div>;
  }

  return (
    <div className={className}>
      <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} maxZoom={19} />
        {feeds.map((line, i) => (
          <Polyline key={i} positions={line} pathOptions={{ color: INK_MUTED_HEX, weight: 1.2, opacity: 0.35, dashArray: '4 4' }} />
        ))}
        {plants.map((plant) => (
          <Rectangle
            key={plant.plant_id}
            bounds={[
              [plant.lat - PLANT_HALF_DEG, plant.lon - PLANT_HALF_DEG * 1.3],
              [plant.lat + PLANT_HALF_DEG, plant.lon + PLANT_HALF_DEG * 1.3],
            ]}
            pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: INK_HEX, fillOpacity: 0.92 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-[13px] font-semibold">{plant.name}</span>
              <span className="block text-[12px] text-[var(--bib-ink-muted)]">Plant</span>
            </Tooltip>
          </Rectangle>
        ))}
        {ordered.map((b) => {
          const attention = b.status !== 'HEALTHY';
          return (
            <CircleMarker
              key={b.building_id}
              center={[b.lat, b.lon]}
              radius={attention ? 11 : 8}
              pathOptions={{
                color: '#FFFFFF',
                weight: 2.5,
                fillColor: STATUS_HEX[b.status] ?? STATUS_HEX.HEALTHY,
                fillOpacity: attention ? 1 : 0.85,
              }}
              eventHandlers={onSelect ? { click: () => onSelect(b.building_id) } : undefined}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-[13px] leading-4">
                  <div className="font-semibold">{b.name}</div>
                  <div>{STATUS_LABEL[b.status] ?? b.status}</div>
                  {b.subtitle ? <div className="text-[var(--bib-ink-muted)]">{b.subtitle}</div> : null}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
