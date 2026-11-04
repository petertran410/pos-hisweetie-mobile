import { describe, expect, it } from '@jest/globals';
import { oldDistrictsOf, oldProvinces, oldWardsOf, PROVINCES, searchPlaces, wardsOf } from '../locations';

describe('địa giới hành chính', () => {
  it('địa chỉ mới: 34 tỉnh, xã theo tỉnh, tìm không cần dấu', () => {
    expect(PROVINCES).toHaveLength(34);
    const hn = PROVINCES.find((p) => p.name.includes('Hà Nội'));
    expect(hn).toBeDefined();
    expect(searchPlaces(wardsOf(hn?.code), 'ba dinh').map((w) => w.name)).toContain('Phường Ba Đình');
  });

  it('địa chỉ cũ: 63 tỉnh → quận / huyện → phường / xã, mã dạng chuỗi', () => {
    const list = oldProvinces();
    expect(list).toHaveLength(63);
    const hn = list.find((p) => p.name === 'Thành phố Hà Nội');
    expect(hn?.code).toBe('1');
    const bd = oldDistrictsOf('1').find((d) => d.name === 'Quận Ba Đình');
    expect(bd?.code).toBe('1');
    expect(oldWardsOf('1', '1').map((w) => w.name)).toContain('Phường Phúc Xá');
    expect(oldWardsOf('1', null)).toEqual([]);
  });
});
