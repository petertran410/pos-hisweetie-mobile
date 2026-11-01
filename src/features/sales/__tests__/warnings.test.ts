import { describe, expect, it } from '@jest/globals';
import { parseStockWarning } from '../warnings';

describe('parseStockWarning', () => {
  it('tách tên hàng, số tồn và số cần', () => {
    expect(parseStockWarning('Sản phẩm Gấu Lermao - Mứt Xoài Xanh 1kg (12 Túi/Thùng) không đủ tồn kho (Có: 0, Cần: 1)')).toEqual({
      name: 'Gấu Lermao - Mứt Xoài Xanh 1kg (12 Túi/Thùng)',
      have: '0',
      need: '1',
    });
  });

  it('câu dạng khác thì giữ nguyên', () => {
    expect(parseStockWarning('Kho đang kiểm kê')).toEqual({ name: 'Kho đang kiểm kê' });
  });
});
