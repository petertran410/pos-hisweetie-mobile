import data from './locations.json';

/**
 * Tỉnh / thành và phường / xã sau sáp nhập (2 cấp), lấy từ dữ liệu web đang
 * dùng (`public/data/new-*-location.json`), rút gọn còn [mã, tên, mã tỉnh].
 */
export interface Place {
  code: string;
  name: string;
}

const raw = data as { provinces: [string, string][]; communes: [string, string, string][] };

export const PROVINCES: Place[] = raw.provinces.map(([code, name]) => ({ code, name }));

let byProvince: Map<string, Place[]> | null = null;

export function wardsOf(provinceCode: string | null | undefined): Place[] {
  if (!provinceCode) return [];
  if (!byProvince) {
    byProvince = new Map();
    for (const [code, name, p] of raw.communes) {
      const list = byProvince.get(p) ?? [];
      list.push({ code, name });
      byProvince.set(p, list);
    }
  }
  return byProvince.get(provinceCode) ?? [];
}

/** Bỏ dấu, chữ thường để tìm "ba dinh" ra "Phường Ba Đình". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

export function searchPlaces(list: Place[], q: string): Place[] {
  const key = fold(q);
  if (!key) return list;
  return list.filter((p) => fold(p.name).includes(key));
}

// ---------- Địa chỉ cũ (3 cấp, trước sáp nhập) ----------

/** [mã tỉnh, tên, [[mã huyện, tên, [[mã xã, tên]]]]] — lấy từ `old-location.json` của web. */
type OldRaw = [string, string, [string, string, [string, string][]][]][];

let oldData: OldRaw | null = null;

/** Dữ liệu cũ khá lớn: chỉ nạp khi mở phần địa chỉ cũ. */
function old(): OldRaw {
  if (!oldData) oldData = require('./old-locations.json') as OldRaw;
  return oldData;
}

export function oldProvinces(): Place[] {
  return old().map(([code, name]) => ({ code, name }));
}

export function oldDistrictsOf(cityCode: string | null | undefined): Place[] {
  if (!cityCode) return [];
  const c = old().find(([code]) => code === String(cityCode));
  return (c?.[2] ?? []).map(([code, name]) => ({ code, name }));
}

export function oldWardsOf(cityCode: string | null | undefined, districtCode: string | null | undefined): Place[] {
  if (!cityCode || !districtCode) return [];
  const c = old().find(([code]) => code === String(cityCode));
  const d = c?.[2].find(([code]) => code === String(districtCode));
  return (d?.[2] ?? []).map(([code, name]) => ({ code, name }));
}
