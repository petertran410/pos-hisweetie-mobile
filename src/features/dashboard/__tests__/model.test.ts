import { describe, expect, it } from '@jest/globals';
import { formatDelta, isValidTaskType, taskStatusLabel } from '../model';

describe('dashboard model', () => {
  it('formats percent changes', () => {
    expect(formatDelta(12.345)).toBe('+12,3%');
    expect(formatDelta(-3)).toBe('-3%');
    expect(formatDelta(0)).toBe('0%');
    expect(formatDelta(null)).toBeNull();
    expect(formatDelta(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('labels task statuses in Vietnamese', () => {
    expect(taskStatusLabel('orders', 'partially_invoiced')).toBe('Đã ra 1 phần hóa đơn');
    expect(taskStatusLabel('debt', 'overdue')).toBe('Quá hạn trên 30 ngày');
    expect(taskStatusLabel('stock', 'out')).toBe('Hết hàng');
    expect(taskStatusLabel('cod', '3')).toBe('');
  });

  it('validates task types from the URL', () => {
    expect(isValidTaskType('debt')).toBe(true);
    expect(isValidTaskType('hack')).toBe(false);
  });
});
