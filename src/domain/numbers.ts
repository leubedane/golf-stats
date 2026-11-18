/** Parses user input with either a decimal point or a decimal comma; NaN when not a number. */
export function parseDecimal(text: string): number {
  const normalized = text.trim().replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}
