/*
 * CampusMap: the real campus on OpenStreetMap tiles, one dot per building coloured by its
 * worst system status (the same four status colours used everywhere), plants as grey
 * squares, and a thin line from each plant to the buildings on its loops. Click a dot to
 * open the building dashboard. Colour means status only (FRONTEND §2).
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

  if (!bounds) {
    return <div className={className}>No building coordinates available.</div>;
  }

  return (
    <div className={className}>
      <MapContainer bounds={bounds} scrollWheelZoom className="h-full w-full rounded-[var(--c3-style-border-radius-6)]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {feeds.map((line, i) => (
          <Polyline key={i} positions={line} pathOptions={{ color: '#6B7280', weight: 1, opacity: 0.35 }} />
        ))}
        {plants.map((plant) => (
          <Rectangle
            key={plant.plant_id}
            bounds={[
              [plant.lat - PLANT_HALF_DEG, plant.lon - PLANT_HALF_DEG * 1.3],
              [plant.lat + PLANT_HALF_DEG, plant.lon + PLANT_HALF_DEG * 1.3],
            ]}
            pathOptions={{ color: '#374151', weight: 1.5, fillColor: '#6B7280', fillOpacity: 0.6 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-[13px] font-semibold">{plant.name}</span>
            </Tooltip>
          </Rectangle>
        ))}
        {buildings.map((b) => (
          <CircleMarker
            key={b.building_id}
            center={[b.lat, b.lon]}
            radius={b.status === 'HEALTHY' ? 8 : 10}
            pathOptions={{
              color: '#FFFFFF',
              weight: 2,
              fillColor: STATUS_HEX[b.status] ?? STATUS_HEX.HEALTHY,
              fillOpacity: 0.95,
            }}
            eventHandlers={onSelect ? { click: () => onSelect(b.building_id) } : undefined}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="text-[13px] leading-4">
                <div className="font-semibold">{b.name}</div>
                <div>{STATUS_LABEL[b.status] ?? b.status}</div>
                {b.subtitle ? <div className="text-[#6B7280]">{b.subtitle}</div> : null}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
