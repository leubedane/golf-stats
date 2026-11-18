import { describe, expect, it } from 'vitest';
import { parseDecimal } from './numbers';

describe('parseDecimal', () => {
  it('accepts point and comma', () => {
    expect(parseDecimal('6.8')).toBe(6.8);
    expect(parseDecimal(' 6,8 ')).toBe(6.8);
    expect(parseDecimal('+2')).toBe(2);
  });
  it('rejects garbage', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('6.8.1')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
  });
});
