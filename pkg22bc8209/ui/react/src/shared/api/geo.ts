/*
 * Geo data for the campus map (owner: Vibhrav). Built-in `Building.fetch` / `Plant.fetch`
 * for the real lat/lon that `campusSnapshot` does not carry; status still comes from the
 * snapshot so the map and the cards never disagree.
 */

import { c3Action } from '@/c3Action';

export interface BuildingGeo {
  building_id: string;
  name: string;
  lat: number;
  lon: number;
  segment_id: string | null;
}

export interface PlantGeo {
  plant_id: string;
  name: string;
  lat: number;
  lon: number;
}

interface RawBuildingRow {
  id: string;
  name?: string;
  lat?: number | null;
  lon?: number | null;
  segment?: { id?: string } | null;
}

interface RawPlantRow {
  id: string;
  name?: string;
  lat?: number | null;
  lon?: number | null;
}

/** Buildings with coordinates (rows without lat/lon are dropped; they cannot be placed). */
export async function fetchBuildingGeo(): Promise<BuildingGeo[]> {
  const response = await c3Action('Building', 'fetch', [{ include: 'id, name, lat, lon, segment.id', limit: -1 }]);
  const rows: RawBuildingRow[] = response?.objs ?? [];
  return rows
    .filter((row) => typeof row.lat === 'number' && typeof row.lon === 'number')
    .map((row) => ({
      building_id: row.id,
      name: row.name ?? row.id,
      lat: row.lat as number,
      lon: row.lon as number,
      segment_id: row.segment?.id ?? null,
    }));
}

export async function fetchPlantGeo(): Promise<PlantGeo[]> {
  const response = await c3Action('Plant', 'fetch', [{ include: 'id, name, lat, lon', limit: -1 }]);
  const rows: RawPlantRow[] = response?.objs ?? [];
  return rows
    .filter((row) => typeof row.lat === 'number' && typeof row.lon === 'number')
    .map((row) => ({ plant_id: row.id, name: row.name ?? row.id, lat: row.lat as number, lon: row.lon as number }));
}
