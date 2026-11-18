import { newId } from '../domain/ids';
import { yardsToMeters } from '../domain/units';
import type { Course, Tee, TeeGender } from '../domain/types';

const BASE_URL = 'https://api.golfcourseapi.com';

// Response shapes, per https://api.golfcourseapi.com/docs/api/openapi.yml (v1.3.0).
interface ApiLocation {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ApiCourseSummary {
  id: string;
  club_name: string;
  course_name: string;
  location?: ApiLocation;
  tees?: Record<string, number>;
}

interface ApiHole {
  par?: number;
  yardage?: number;
  meters?: number;
  handicap?: number;
}

interface ApiTeeBox {
  tee_name?: string;
  course_rating?: number;
  slope_rating?: number;
  number_of_holes?: number;
  holes?: ApiHole[];
}

export interface ApiCourseDetail {
  id: string;
  club_name: string;
  course_name: string;
  location?: ApiLocation;
  tees?: { male?: ApiTeeBox[]; female?: ApiTeeBox[] };
}

export class GolfCourseApiError extends Error {
  constructor(
    readonly kind: 'noKey' | 'unauthorized' | 'notFound' | 'rateLimited' | 'network' | 'server',
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

async function request<T>(path: string, apiKey: string, fetchFn: Fetch): Promise<T> {
  if (!apiKey.trim()) throw new GolfCourseApiError('noKey', 'No GolfCourseAPI key configured');
  let res: Response;
  try {
    res = await fetchFn(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
  } catch (e) {
    throw new GolfCourseApiError('network', String(e));
  }
  if (res.status === 401) throw new GolfCourseApiError('unauthorized', 'API key is invalid');
  if (res.status === 404) throw new GolfCourseApiError('notFound', 'Course not found');
  if (res.status === 429) throw new GolfCourseApiError('rateLimited', 'Daily request limit reached');
  if (!res.ok) throw new GolfCourseApiError('server', `HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function searchCourses(
  query: string,
  apiKey: string,
  fetchFn: Fetch = fetch,
): Promise<ApiCourseSummary[]> {
  const q = encodeURIComponent(query.trim());
  const body = await request<{ courses?: ApiCourseSummary[] }>(
    `/v1/search?search_query=${q}`,
    apiKey,
    fetchFn,
  );
  return body.courses ?? [];
}

export async function fetchCourse(
  id: string,
  apiKey: string,
  fetchFn: Fetch = fetch,
): Promise<ApiCourseDetail> {
  const body = await request<ApiCourseDetail | { course: ApiCourseDetail }>(
    `/v1/courses/${encodeURIComponent(id)}`,
    apiKey,
    fetchFn,
  );
  // The spec documents the bare course; tolerate a `{ course }` wrapper as well.
  return 'course' in body ? body.course : body;
}

function toTee(box: ApiTeeBox, gender: TeeGender): Tee {
  const holes = (box.holes ?? []).map((h, i) => ({
    number: i + 1,
    par: h.par ?? 0,
    lengthM: h.meters ?? (h.yardage != null ? yardsToMeters(h.yardage) : 0),
    strokeIndex: h.handicap ?? 0,
  }));
  return {
    id: newId(),
    name: box.tee_name ?? '',
    gender,
    courseRating: box.course_rating ?? 0,
    slope: box.slope_rating ?? 0,
    holes,
  };
}

/** Converts a GolfCourseAPI course into a Course; `existing` keeps the local id on a refresh. */
export function toCourse(api: ApiCourseDetail, existing?: Course): Course {
  const tees = [
    ...(api.tees?.male ?? []).map((b) => toTee(b, 'male')),
    ...(api.tees?.female ?? []).map((b) => toTee(b, 'female')),
  ].filter((t) => t.holes.length > 0);
  return {
    id: existing?.id ?? newId(),
    clubName: api.club_name ?? '',
    courseName: api.course_name ?? '',
    city: api.location?.city ?? '',
    country: api.location?.country ?? '',
    source: 'api',
    externalId: api.id,
    tees,
    updatedAt: Date.now(),
  };
}
