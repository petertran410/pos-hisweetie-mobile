import { describe, expect, it } from '@jest/globals';
import { dayBoundsIso, isRange, monthGrid, pickDay, presetRange, RANGE_PRESETS, rangeLabel, resolvePeriod, resolveRange } from '../period';

const NOW = new Date(2026, 10, 4, 9, 0); // 04/11/2026 giờ máy

describe('resolvePeriod', () => {
  it('kỳ có sẵn, toàn thời gian và khoảng tự chọn', () => {
    expect(resolvePeriod('all', NOW)).toBeNull();
    expect(resolvePeriod('today', NOW)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(resolvePeriod({ from: '2026-10-01', to: '2026-10-15' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(isRange('last7')).toBe(false);
    expect(isRange({ from: '2026-10-01', to: '2026-10-15' })).toBe(true);
  });

  it('đổi ngày sang đầu ngày / cuối ngày theo giờ máy', () => {
    const b = dayBoundsIso('2026-10-01', '2026-10-15');
    expect(b.fromIso).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(b.toIso).toBe(new Date(2026, 9, 15, 23, 59, 59, 999).toISOString());
  });
});

describe('rangeLabel', () => {
  it('gọn khi trong năm nay, đủ năm khi khác năm, 1 ngày ghi rõ ngày', () => {
    expect(rangeLabel({ from: '2026-10-05', to: '2026-10-12' }, NOW)).toBe('05/10 – 12/10');
    expect(rangeLabel({ from: '2025-12-28', to: '2026-01-03' }, NOW)).toBe('28/12/2025 – 03/01/2026');
    expect(rangeLabel({ from: '2026-10-05', to: '2026-10-05' }, NOW)).toBe('05/10/2026');
  });
});

describe('pickDay', () => {
  it('bấm ngày đầu rồi ngày cuối; bấm ngày trước ngày đầu thì đổi chỗ; đủ 2 đầu thì chọn lại từ đầu', () => {
    let d = pickDay({ from: null, to: null }, '2026-10-10');
    expect(d).toEqual({ from: '2026-10-10', to: null });
    d = pickDay(d, '2026-10-15');
    expect(d).toEqual({ from: '2026-10-10', to: '2026-10-15' });
    d = pickDay(d, '2026-10-20');
    expect(d).toEqual({ from: '2026-10-20', to: null });
    expect(pickDay(d, '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-20' });
  });
});

describe('monthGrid', () => {
  it('tuần bắt đầu thứ Hai, đủ ngày trong tháng', () => {
    // 01/11/2026 là Chủ nhật → ô thứ 7 của tuần đầu.
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  });
});

describe('presetRange (giống mốc thời gian của web)', () => {
  it('đủ 12 mốc như web, cùng nhóm', () => {
    expect(RANGE_PRESETS.map((p) => p.value)).toEqual([
      'today',
      'yesterday',
      'this_week',
      'last_week',
      'last_7_days',
      'this_month',
      'last_month',
      'last_30_days',
      'this_quarter',
      'last_quarter',
      'this_year',
      'last_year',
    ]);
    expect(new Set(RANGE_PRESETS.map((p) => p.group))).toEqual(new Set(['Theo ngày', 'Theo tuần', 'Theo tháng', 'Theo quý', 'Theo năm']));
  });

  it('tính khoảng ngày như web (thứ Tư 04/11/2026)', () => {
    const r = (p: Parameters<typeof presetRange>[0]) => presetRange(p, NOW);
    expect(r('today')).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(r('yesterday')).toEqual({ from: '2026-11-03', to: '2026-11-03' });
    // Tuần bắt đầu thứ Hai.
    expect(r('this_week')).toEqual({ from: '2026-11-02', to: '2026-11-04' });
    expect(r('last_week')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    // Web: từ 7 / 30 ngày trước đến hôm nay.
    expect(r('last_7_days')).toEqual({ from: '2026-10-28', to: '2026-11-04' });
    expect(r('last_30_days')).toEqual({ from: '2026-10-05', to: '2026-11-04' });
    expect(r('this_month')).toEqual({ from: '2026-11-01', to: '2026-11-04' });
    expect(r('last_month')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(r('this_quarter')).toEqual({ from: '2026-10-01', to: '2026-11-04' });
    expect(r('last_quarter')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(r('this_year')).toEqual({ from: '2026-01-01', to: '2026-11-04' });
    expect(r('last_year')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('chủ nhật vẫn thuộc tuần bắt đầu từ thứ Hai; quý 1 thì quý trước là quý 4 năm trước', () => {
    const sunday = new Date(2026, 10, 8, 20, 0);
    expect(presetRange('this_week', sunday)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(presetRange('last_week', sunday)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    const jan = new Date(2027, 0, 15);
    expect(presetRange('last_quarter', jan)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(presetRange('last_month', jan)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('toàn thời gian không lọc; khoảng tự chọn giữ nguyên', () => {
    expect(resolveRange('all', NOW)).toBeNull();
    expect(resolveRange({ from: '2026-10-01', to: '2026-10-15' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    expect(resolveRange('this_week', NOW)).toEqual({ from: '2026-11-02', to: '2026-11-04' });
  });
});
