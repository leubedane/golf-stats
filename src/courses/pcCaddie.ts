import { newId } from '../domain/ids';
import type { Course, Hole, Tee, TeeGender } from '../domain/types';

/**
 * Import from a club's PC CADDIE online scorecard (pccaddie.net/clubs/<club id>/app.php?cat=scorecard).
 * The page embeds every Course of the club as JSON (`rawCourseData`), one entry per Tee and gender.
 * pccaddie.net answers with `Access-Control-Allow-Origin: *`, so the browser fetches it directly.
 */

/** One entry of `rawCourseData`; numbers arrive as strings, some as numbers. */
export type PcCaddieTee = Record<string, string | number | null>;

export class PcCaddieError extends Error {
  constructor(
    readonly kind: 'invalidId' | 'notFound' | 'network' | 'server',
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

/** The 7-digit club id (e.g. 0497743), also taken from a pasted pccaddie.net link. */
export function parseClubId(input: string): string | null {
  const text = input.trim();
  const id = /\/clubs\/(\d{7})(?:\/|$)/.exec(text)?.[1] ?? text;
  return /^\d{7}$/.test(id) ? id : null;
}

export const scorecardUrl = (clubId: string): string =>
  `https://www.pccaddie.net/clubs/${clubId}/app.php?cat=scorecard`;

/** Club name and raw Tee entries from the scorecard page; null when the page carries no course data. */
export function parseScorecardPage(html: string): { clubName: string; tees: PcCaddieTee[] } | null {
  const literal = /rawCourseData:\s*\$\.parseJSON\('((?:[^'\\]|\\.)*)'\)/.exec(html)?.[1];
  if (literal === undefined) return null;
  const tees = JSON.parse(literal.replace(/\\'/g, "'")) as PcCaddieTee[];
  if (!Array.isArray(tees) || tees.length === 0) return null;
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '';
  const clubName = decodeEntities(title.split('|')[0].trim());
  return { clubName, tees };
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return named[e.toLowerCase()] ?? m;
  });
}

const TEE_NAMES: Record<string, string> = {
  weiss: 'Weiß',
  gelb: 'Gelb',
  blau: 'Blau',
  rot: 'Rot',
  orange: 'Orange',
  schwarz: 'Schwarz',
  gruen: 'Grün',
  silber: 'Silber',
  gold: 'Gold',
};

const str = (v: PcCaddieTee[string]): string => (v == null ? '' : String(v).trim());
const num = (v: PcCaddieTee[string]): number => Number(str(v).replace(',', '.')) || 0;

function teeName(color: string): string {
  const key = color.toLowerCase();
  return TEE_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** `numholes` is 18, 9, or 9A / 9B for the front and back nine of an 18-hole layout. */
function holeLayout(numholes: string): { count: number; firstNumber: number } {
  const count = parseInt(numholes, 10) || 18;
  return { count, firstNumber: /B$/i.test(numholes) ? 10 : 1 };
}

function toTee(entry: PcCaddieTee): Tee {
  const { count, firstNumber } = holeLayout(str(entry.numholes));
  const holes: Hole[] = Array.from({ length: count }, (_, i) => ({
    number: firstNumber + i,
    par: num(entry[`pl${i + 1}`]),
    strokeIndex: num(entry[`vl${i + 1}`]),
    lengthM: num(entry[`ll${i + 1}`]),
  }));
  const gender: TeeGender = str(entry.gender).toUpperCase() === 'M' ? 'male' : 'female';
  return {
    id: newId(),
    name: teeName(str(entry.color)) || str(entry.name),
    gender,
    courseRating: num(entry.cr),
    slope: Math.round(num(entry.slope)),
    holes,
  };
}

/** "Tuniberg, GC - Tuniberg, GC - 10-18" → "10-18"; names without a club prefix stay whole. */
const courseName = (name: string): string => name.split(' - ').pop()!.trim();

/**
 * One Course per PC CADDIE course id (e.g. 7743.1.1). A Course in `existing` with the same
 * externalId keeps its local id, so importing a club again updates it instead of duplicating it.
 */
export function toCourses(
  clubName: string,
  entries: PcCaddieTee[],
  existing: Course[] = [],
  now = Date.now(),
): Course[] {
  const groups = new Map<string, PcCaddieTee[]>();
  for (const entry of entries) {
    const key = str(entry.pcc_course_id) || str(entry.name);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups].map(([externalId, group]) => {
    const previous = existing.find((c) => c.source === 'pccaddie' && c.externalId === externalId);
    return {
      id: previous?.id ?? newId(),
      clubName,
      courseName: courseName(str(group[0].name)),
      city: previous?.city ?? '',
      country: previous?.country ?? '',
      source: 'pccaddie',
      externalId,
      tees: group.map(toTee).filter((t) => t.holes.length > 0),
      updatedAt: now,
    };
  });
}

/** Fetches a club's scorecard page and returns its Courses, matched against `existing`. */
export async function fetchPcCaddieCourses(
  clubId: string,
  existing: Course[] = [],
  fetchFn: Fetch = fetch,
): Promise<Course[]> {
  const id = parseClubId(clubId);
  if (!id) throw new PcCaddieError('invalidId', 'A PC CADDIE club id has 7 digits');
  let res: Response;
  try {
    res = await fetchFn(scorecardUrl(id));
  } catch (e) {
    throw new PcCaddieError('network', String(e));
  }
  if (res.status === 404) throw new PcCaddieError('notFound', `No PC CADDIE club ${id}`);
  if (!res.ok) throw new PcCaddieError('server', `HTTP ${res.status}`);
  const page = parseScorecardPage(await res.text());
  if (!page) throw new PcCaddieError('notFound', `No scorecard data for PC CADDIE club ${id}`);
  return toCourses(page.clubName, page.tees, existing);
}
