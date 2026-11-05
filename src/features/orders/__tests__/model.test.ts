import { describe, expect, it } from '@jest/globals';
import { canPrintDoc } from '../../print/perms';
import { isAdminRole } from '@/core/can';
import { ownsDoc } from '../model';

describe('chứng từ của nhân viên khác (cờ "chỉ xem dữ liệu của mình")', () => {
  const own = { id: 7, canViewOtherStaffData: false };
  const all = { id: 7, canViewOtherStaffData: true };

  it('tắt cờ: chỉ mở được chứng từ mình tạo', () => {
    expect(ownsDoc(own, 7)).toBe(true);
    expect(ownsDoc(own, 8)).toBe(false);
    expect(ownsDoc(own, null)).toBe(false);
  });

  it('bật cờ: mở được mọi chứng từ; chưa đăng nhập thì không', () => {
    expect(ownsDoc(all, 8)).toBe(true);
    expect(ownsDoc(null, 7)).toBe(false);
  });
});

describe('quyền in phiếu', () => {
  it('cần quyền in đúng loại + quyền xem mẫu in', () => {
    const user = { roles: [], permissions: ['invoices:print', 'print_templates:view'] };
    expect(canPrintDoc(user, 'invoice')).toBe(true);
    expect(canPrintDoc(user, 'order')).toBe(false);
    expect(canPrintDoc({ roles: [], permissions: ['invoices:print'] }, 'invoice')).toBe(false);
    expect(canPrintDoc({ roles: ['Super Admin'], permissions: [] }, 'order')).toBe(true);
  });
});

describe('Admin (lợi nhuận trên Tổng quan)', () => {
  it('chỉ Admin, Super Admin', () => {
    expect(isAdminRole({ roles: ['Admin'] })).toBe(true);
    expect(isAdminRole({ roles: ['Super Admin'] })).toBe(true);
    expect(isAdminRole({ roles: ['Sale'], permissions: ['dashboard:view'] })).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});
