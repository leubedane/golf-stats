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

export interface OsmRequestOptions {
  fetchFn?: Fetch;
  /** Whether the device has a network connection; a failed request while online means the server is at fault. */
  isOnline?: () => boolean;
  /** Gives up on a server that has not answered completely after this long. */
  timeoutMs?: number;
}

const browserIsOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Fetches and parses JSON. A request that fails while the device is online is a server error:
 * busy Overpass servers reject requests without CORS headers, which the browser reports like a lost connection.
 */
async function getJson<T>(url: string, init: RequestInit | undefined, options: OsmRequestOptions, defaultTimeoutMs: number): Promise<T> {
  const { fetchFn = fetch, isOnline = browserIsOnline, timeoutMs = defaultTimeoutMs } = options;
  if (!isOnline()) throw new OsmError('network', 'Offline');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchFn(url, { ...init, signal: controller.signal });
    } catch (e) {
      if (controller.signal.aborted) throw new OsmError('server', `No answer from ${url} after ${timeoutMs} ms`);
      throw new OsmError(isOnline() ? 'server' : 'network', String(e));
    }
    if (!res.ok) throw new OsmError('server', `HTTP ${res.status} from ${url}`);
    try {
      return (await res.json()) as T;
    } catch (e) {
      throw new OsmError(controller.signal.aborted ? 'server' : isOnline() ? 'server' : 'network', `Unreadable answer from ${url}: ${String(e)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Golf courses in OpenStreetMap matching a name, via Nominatim. */
export async function searchGolfCourses(query: string, options: OsmRequestOptions = {}): Promise<OsmGolfCourse[]> {
  const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '10' });
  const results = await getJson<NominatimResult[]>(`${NOMINATIM_URL}?${params}`, undefined, options, 20_000);
  return results
    .filter((r) => r.category === 'leisure' && r.type === 'golf_course' && (r.osm_type === 'way' || r.osm_type === 'relation'))
    .map((r) => ({
      osm: { type: r.osm_type as OsmReference['type'], id: Number(r.osm_id) },
      name: r.name || r.display_name?.split(',')[0] || '',
      place: (r.display_name ?? '').split(',').slice(1, 4).join(',').trim(),
    }));
}

/** Searches by club name and city first, then by club name alone. */
export async function findGolfCourses(clubName: string, city: string, options: OsmRequestOptions = {}): Promise<OsmGolfCourse[]> {
  if (city.trim()) {
    const found = await searchGolfCourses(`${clubName} ${city}`, options);
    if (found.length > 0) return found;
  }
  return searchGolfCourses(clubName, options);
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

export interface CourseMapFetchOptions extends OsmRequestOptions {
  servers?: string[];
  /** How many times the whole server list is tried before giving up. */
  rounds?: number;
  /** Pause before each further round, so a full request queue can drain. */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetches the golf features inside an OSM golf course. Tries each Overpass server in turn, for several rounds
 * with a pause between them; stops at once when the device goes offline.
 */
export async function fetchCourseMap(ref: OsmReference, options: CourseMapFetchOptions = {}): Promise<FetchedCourseMap> {
  const { servers = OVERPASS_SERVERS, rounds = 2, pauseMs = 5_000, sleep = wait, ...request } = options;
  const body = new URLSearchParams({ data: courseMapQuery(ref) });
  let lastError: OsmError = new OsmError('server', 'No Overpass server');
  for (let round = 0; round < rounds; round++) {
    if (round > 0) await sleep(pauseMs);
    for (const server of servers) {
      let elements: OverpassElement[];
      try {
        // The query allows Overpass 60 s; a good answer for an 18-hole course took about 45 s.
        ({ elements = [] } = await getJson<{ elements?: OverpassElement[] }>(server, { method: 'POST', body }, request, 75_000));
      } catch (e) {
        if (!(e instanceof OsmError)) throw e;
        if (e.kind === 'network') throw e;
        lastError = e;
        continue;
      }
      const course = elements.find((e) => e.type === ref.type && e.id === ref.id);
      if (!course) throw new OsmError('notFound', `No ${ref.type} ${ref.id}`);
      return { osmName: course.tags?.name ?? '', ...parseOverpass(elements.filter((e) => e !== course)) };
    }
  }
  throw lastError;
}
