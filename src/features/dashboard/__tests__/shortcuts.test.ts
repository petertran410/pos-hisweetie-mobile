import { describe, expect, it } from '@jest/globals';
import { allowedShortcuts } from '../shortcuts';

const keys = (user: Parameters<typeof allowedShortcuts>[0]) => allowedShortcuts(user).map((s) => s.key);

describe('shortcuts by permission', () => {
  it('Super Admin sees every shortcut', () => {
    expect(keys({ roles: ['Super Admin'], permissions: [] })).toHaveLength(10);
  });

  it('salesperson only sees what they can use', () => {
    expect(keys({ roles: ['Sale'], permissions: ['invoices:create', 'invoices:view', 'customers:view'] })).toEqual([
      'ban-hang',
      'hoa-don',
      'khach-hang',
    ]);
  });

  it('any report permission shows Báo cáo', () => {
    expect(keys({ roles: [], permissions: ['reports:sale_time'] })).toEqual(['bao-cao']);
  });

  it('no user → nothing', () => {
    expect(keys(null)).toEqual([]);
  });
});
