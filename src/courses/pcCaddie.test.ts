import { describe, expect, it, vi } from 'vitest';
import { validateCourse } from '../domain/course';
import type { Course } from '../domain/types';
import { PcCaddieError, fetchPcCaddieCourses, parseClubId, parseScorecardPage, toCourses, type PcCaddieTee } from './pcCaddie';

function entry(fields: Record<string, string>, holes: number, par: number[], si: number[], len: number[]): PcCaddieTee {
  const e: PcCaddieTee = { ...fields };
  for (let i = 1; i <= 18; i++) {
    e[`pl${i}`] = i <= holes ? String(par[i - 1]) : '0';
    e[`vl${i}`] = i <= holes ? si[i - 1] : i - holes; // PC CADDIE fills unused holes with numbers too
    e[`ll${i}`] = i <= holes ? String(len[i - 1]) : '0';
  }
  return e;
}

const PAR18 = [4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 5, 4, 4, 3, 5, 4, 3, 4];
const SI18 = [14, 4, 6, 8, 12, 16, 10, 18, 2, 15, 11, 3, 7, 9, 13, 1, 17, 5];
const LEN18 = [284, 357, 483, 188, 450, 323, 354, 146, 410, 310, 492, 352, 346, 176, 469, 384, 136, 359];

const ENTRIES: PcCaddieTee[] = [
  entry({ name: 'GC Tuniberg 1-18', color: 'weiss', gender: 'M', numholes: '18', cr: '72.7', slope: '128', pcc_course_id: '7743.1.1' }, 18, PAR18, SI18, LEN18),
  entry({ name: 'GC Tuniberg 1-18', color: 'gelb', gender: 'W', numholes: '18', cr: '77.1', slope: '132', pcc_course_id: '7743.1.1' }, 18, PAR18, SI18, LEN18),
  entry(
    { name: 'Tuniberg, GC - Tuniberg, GC - 10-18', color: 'rot', gender: 'M', numholes: '9B', cr: '33.9', slope: '120', pcc_course_id: '7743.1.5' },
    9,
    [4, 5, 4, 4, 3, 5, 4, 3, 4],
    [8, 6, 2, 4, 5, 7, 1, 9, 3],
    [310, 492, 352, 346, 176, 469, 384, 136, 359],
  ),
];

/** The shape of pccaddie.net/clubs/<id>/app.php?cat=scorecard, trimmed to what the import reads. */
function page(entries: PcCaddieTee[], title = 'Golfclub Tuniberg e.V.'): string {
  const json = JSON.stringify(entries).replace(/'/g, "\\'");
  return `<html><head><title>${title}\n |\n PC CADDIE://online</title></head><body><script>
let data = {
rawCourseData: $.parseJSON('${json}'),
};
</script></body></html>`;
}

describe('PC CADDIE import', () => {
  it('reads a club id typed or pasted as a link', () => {
    expect(parseClubId(' 0497743 ')).toBe('0497743');
    expect(parseClubId('https://www.pccaddie.net/clubs/0497743/app.php?cat=scorecard')).toBe('0497743');
    expect(parseClubId('7743')).toBeNull();
    expect(parseClubId('04977430')).toBeNull();
  });

  it('reads club name and tees from the scorecard page', () => {
    const parsed = parseScorecardPage(page([{ ...ENTRIES[0], name: "Kurs 'A'" }], 'GC Gut &amp; Schön'));
    expect(parsed?.clubName).toBe('GC Gut & Schön');
    expect(parsed?.tees[0].name).toBe("Kurs 'A'");
    expect(parseScorecardPage('<html><title>Login</title></html>')).toBeNull();
  });

  it('builds one valid Course per PC CADDIE course', () => {
    const courses = toCourses('Golfclub Tuniberg e.V.', ENTRIES);
    expect(courses.map((c) => [c.externalId, c.courseName, c.tees.length])).toEqual([
      ['7743.1.1', 'GC Tuniberg 1-18', 2],
      ['7743.1.5', '10-18', 1],
    ]);
    for (const c of courses) expect(validateCourse(c)).toEqual([]);

    const [white, yellow] = courses[0].tees;
    expect([white.name, white.gender, white.courseRating, white.slope]).toEqual(['Weiß', 'male', 72.7, 128]);
    expect([yellow.name, yellow.gender]).toEqual(['Gelb', 'female']);
    expect(white.holes[15]).toEqual({ number: 16, par: 4, strokeIndex: 1, lengthM: 384 });
  });

  it('numbers the holes of a back-nine course 10 to 18', () => {
    const [, backNine] = toCourses('Club', ENTRIES);
    expect(backNine.tees[0].holes.map((h) => h.number)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('keeps the local id of a course imported before', () => {
    const [first] = toCourses('Club', ENTRIES);
    const edited: Course = { ...first, city: 'Freiburg-Munzingen' };
    const [again, other] = toCourses('Club', ENTRIES, [edited]);
    expect([again.id, again.city]).toEqual([first.id, 'Freiburg-Munzingen']);
    expect(other.id).not.toBe(first.id);
  });

  it('fetches the scorecard page of the club', async () => {
    const fetchFn = vi.fn(async () => new Response(page(ENTRIES)));
    const courses = await fetchPcCaddieCourses('0497743', [], fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('https://www.pccaddie.net/clubs/0497743/app.php?cat=scorecard');
    expect(courses).toHaveLength(2);
  });

  it('reports why an import failed', async () => {
    const kind = (p: Promise<unknown>) => p.then(() => 'ok', (e: PcCaddieError) => e.kind);
    expect(await kind(fetchPcCaddieCourses('123', [], vi.fn()))).toBe('invalidId');
    expect(await kind(fetchPcCaddieCourses('0000000', [], async () => new Response('<title>x</title>')))).toBe('notFound');
    expect(await kind(fetchPcCaddieCourses('0000000', [], async () => new Response('', { status: 500 })))).toBe('server');
    expect(await kind(fetchPcCaddieCourses('0000000', [], async () => Promise.reject(new TypeError('offline'))))).toBe('network');
  });
});
