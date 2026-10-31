import { describe, expect, it } from '@jest/globals';
import {
  deltaTone,
  formatDelta,
  greetingFor,
  isValidTaskType,
  shortName,
  sparseLabels,
  taskStatusLabel,
} from '../model';

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

describe('dashboard helpers', () => {
  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 9, 31, 8))).toBe('Chào buổi sáng!');
    expect(greetingFor(new Date(2026, 9, 31, 12))).toBe('Chào buổi trưa!');
    expect(greetingFor(new Date(2026, 9, 31, 16))).toBe('Chào buổi chiều!');
    expect(greetingFor(new Date(2026, 9, 31, 21))).toBe('Chào buổi tối!');
  });

  it('uses the given name and thins chart labels', () => {
    expect(shortName('Nguyễn Thị Lan')).toBe('Lan');
    expect(shortName('')).toBe('');
    const labels = sparseLabels(Array.from({ length: 24 }, (_, i) => String(i)), 6);
    expect(labels.filter(Boolean).length).toBeLessThanOrEqual(6);
    expect(labels[0]).toBe('0');
    expect(deltaTone(5)).toBe('success');
    expect(deltaTone(-1)).toBe('danger');
    expect(deltaTone(0)).toBe('neutral');
  });
});
