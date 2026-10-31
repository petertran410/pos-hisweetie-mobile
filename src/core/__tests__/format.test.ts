import { describe, expect, it } from '@jest/globals';
import {
  dayLabel,
  initials,
  money,
  parseMoney,
  parseQty,
  periodRange,
  qty,
  vnd,
} from '../format';

describe('format', () => {
  it('formats VND with dot thousand separators', () => {
    expect(money(1250000)).toBe('1.250.000');
    expect(money(-30000)).toBe('-30.000');
    expect(money(null)).toBe('0');
    expect(vnd('650000')).toBe('650.000 ₫');
  });

  it('formats quantities with a decimal comma', () => {
    expect(qty(2)).toBe('2');
    expect(qty(0.1666)).toBe('0,17');
    expect(qty(1250.5)).toBe('1.250,5');
  });

  it('parses typed money and quantities', () => {
    expect(parseMoney('1.250.000 ₫')).toBe(1250000);
    expect(parseMoney('')).toBe(0);
    expect(parseQty('2,5')).toBe(2.5);
    expect(parseQty('1.200')).toBe(1200);
  });

  it('labels days relative to today', () => {
    const now = new Date(2026, 9, 31, 15, 0);
    expect(dayLabel(new Date(2026, 9, 31, 8, 0), now)).toBe('Hôm nay, 31/10');
    expect(dayLabel(new Date(2026, 9, 30, 23, 0), now)).toBe('Hôm qua, 30/10');
    expect(dayLabel(new Date(2026, 9, 26), now)).toBe('Thứ Hai, 26/10');
    expect(dayLabel(new Date(2025, 0, 2), now)).toBe('02/01/2025');
  });

  it('builds date ranges for common periods', () => {
    const now = new Date(2026, 9, 31);
    expect(periodRange('today', now)).toEqual({ from: '2026-10-31', to: '2026-10-31' });
    expect(periodRange('last7', now)).toEqual({ from: '2026-10-25', to: '2026-10-31' });
    expect(periodRange('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('takes initials from the last two words', () => {
    expect(initials('Quán Trà Mây')).toBe('TM');
    expect(initials('Lan')).toBe('L');
    expect(initials('')).toBe('?');
  });
});
