import type { MissSide } from '../domain/types';

/** Stacked bar of Left / On target / Right shares. */
export function SideBar({ side, label }: { side: Record<MissSide, number>; label: string }) {
  // Percentages are shown as text by the caller; the bar shows the proportions.
  const total = side.left + side.onTarget + side.right;
  if (total === 0) return <span className="muted">–</span>;
  const pct = (n: number) => Math.round((n / total) * 100);
  const parts: [MissSide, number][] = [
    ['left', side.left],
    ['onTarget', side.onTarget],
    ['right', side.right],
  ];
  return (
    <span className="side-bar" role="img" aria-label={`${label}: ${parts.map(([k, n]) => `${k} ${pct(n)}%`).join(', ')}`}>
      {parts
        .filter(([, n]) => n > 0)
        .map(([k, n]) => (
          <span key={k} className={`side-seg ${k}`} style={{ flexGrow: n }} title={`${pct(n)}%`} />
        ))}
    </span>
  );
}
