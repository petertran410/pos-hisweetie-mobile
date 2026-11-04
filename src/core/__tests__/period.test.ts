import { describe, expect, it } from '@jest/globals';
import { dayBoundsIso, isRange, monthGrid, pickDay, rangeLabel, resolvePeriod } from '../period';

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
