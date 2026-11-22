import { parseOverpass, type OverpassElement } from '../domain/courseMap';
import type { HoleLine, MapFeature, OsmReference } from '../domain/types';

type Fetch = typeof fetch;

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** Public Overpass servers, tried in order; the main one is often overloaded. */
export const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export class OsmError extends Error {
  constructor(
    readonly kind: 'network' | 'server' | 'notFound',
    message: string,
  ) {
    super(message);
  }
}

export interface OsmGolfCourse {
  osm: OsmReference;
  name: string;
  /** Where it is, for telling search results apart. */
  place: string;
}

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  name?: string;
  display_name?: string;
}

/** Reads "https://www.openstreetmap.org/way/143875366", "relation/9351595", "w143875366" or a bare way id. */
export function parseOsmReference(text: string): OsmReference | null {
  const typed = /\b(way|relation|w|r)\s*[/=:]?\s*(\d+)\b/i.exec(text);
  if (typed) {
    const t = typed[1].toLowerCase();
    return { type: t.startsWith('r') ? 'relation' : 'way', id: Number(typed[2]) };
  }
  const bare = /^\s*(\d+)\s*$/.exec(text);
  return bare ? { type: 'way', id: Number(bare[1]) } : null;
}

export const osmUrl = (ref: OsmReference) => `https://www.openstreetmap.org/${ref.type}/${ref.id}`;
export const osmEditUrl = (ref: OsmReference) => `https://www.openstreetmap.org/edit?${ref.type}=${ref.id}`;

async function get(url: string, init: RequestInit | undefined, fetchFn: Fetch): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (e) {
    throw new OsmError('network', String(e));
  }
}

/** Golf courses in OpenStreetMap matching a name, via Nominatim. */
export async function searchGolfCourses(query: string, fetchFn: Fetch = fetch): Promise<OsmGolfCourse[]> {
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '10' });
  const res = await get(`${NOMINATIM_URL}?${params}`, undefined, fetchFn);
  if (!res.ok) throw new OsmError('server', `HTTP ${res.status}`);
  const results = (await res.json()) as NominatimResult[];
  return results
    .filter((r) => r.category === 'leisure' && r.type === 'golf_course' && (r.osm_type === 'way' || r.osm_type === 'relation'))
    .map((r) => ({
      osm: { type: r.osm_type as OsmReference['type'], id: Number(r.osm_id) },
      name: r.name || r.display_name?.split(',')[0] || '',
      place: (r.display_name ?? '').split(',').slice(1, 4).join(',').trim(),
    }));
}

/** Searches by club name and city first, then by club name alone. */
export async function findGolfCourses(clubName: string, city: string, fetchFn: Fetch = fetch): Promise<OsmGolfCourse[]> {
  if (city.trim()) {
    const found = await searchGolfCourses(`${clubName} ${city}`, fetchFn);
    if (found.length > 0) return found;
  }
  return searchGolfCourses(clubName, fetchFn);
}

export function courseMapQuery(ref: OsmReference): string {
  return [
    '[out:json][timeout:60];',
    `${ref.type}(${ref.id})->.course;`,
    '.course out tags;',
    '.course map_to_area->.area;',
    '(',
    '  way(area.area)[golf~"^(hole|tee|green|fairway|bunker|water_hazard|lateral_water_hazard)$"];',
    '  way(area.area)[natural=water];',
    '  node(area.area)[golf=pin];',
    ');',
    'out geom;',
  ].join('\n');
}

export interface FetchedCourseMap {
  osmName: string;
  holeLines: HoleLine[];
  features: MapFeature[];
}

/** Fetches the golf features inside an OSM golf course, trying each Overpass server in turn. */
export async function fetchCourseMap(
  ref: OsmReference,
  fetchFn: Fetch = fetch,
  servers: string[] = OVERPASS_SERVERS,
): Promise<FetchedCourseMap> {
  const body = new URLSearchParams({ data: courseMapQuery(ref) });
  let lastError: OsmError = new OsmError('network', 'No Overpass server');
  for (const server of servers) {
    let res: Response;
    try {
      res = await get(server, { method: 'POST', body }, fetchFn);
    } catch (e) {
      lastError = e as OsmError;
      continue;
    }
    if (!res.ok) {
      lastError = new OsmError('server', `HTTP ${res.status} from ${server}`);
      continue;
    }
    const { elements = [] } = (await res.json()) as { elements?: OverpassElement[] };
    const course = elements.find((e) => e.type === ref.type && e.id === ref.id);
    if (!course) throw new OsmError('notFound', `No ${ref.type} ${ref.id}`);
    return { osmName: course.tags?.name ?? '', ...parseOverpass(elements.filter((e) => e !== course)) };
  }
  throw lastError;
}
