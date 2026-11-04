import { hasProvince, type RawAddress, type RawCustomer } from './model';

/** 1 địa chỉ đang sửa; `key` để phân biệt khi chưa có id. */
export interface AddressForm extends RawAddress {
  key: string;
}

export interface Named {
  id: number;
  name: string;
}

export interface CustomerForm {
  /** 0 = cá nhân, 1 = tổ chức / hộ kinh doanh; null = chưa chọn (bắt buộc chọn khi tạo). */
  type: 0 | 1 | null;
  name: string;
  code: string;
  contactNumber: string;
  phone: string;
  email: string;
  parent: { id: number; code: string; name: string } | null;
  salePic: Named | null;
  groups: Named[];
  addresses: AddressForm[];
  comments: string;
  // Thông tin xuất hóa đơn
  taxCode: string;
  organization: string;
  invoiceBuyerName: string;
  invoiceAddress: string;
  invoiceEmail: string;
  invoicePhone: string;
  invoiceCccdCmnd: string;
  /** Cá nhân: số hộ chiếu (web lưu chung cột này). */
  invoiceBankAccount: string;
  /** Tổ chức: mã đơn vị quan hệ ngân sách. */
  invoiceDvqhnsCode: string;
}

let seq = 0;
export const newKey = (p = 'a') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newCustomerForm(): CustomerForm {
  return {
    type: null,
    name: '',
    code: '',
    contactNumber: '',
    phone: '',
    email: '',
    parent: null,
    salePic: null,
    groups: [],
    addresses: [],
    comments: '',
    taxCode: '',
    organization: '',
    invoiceBuyerName: '',
    invoiceAddress: '',
    invoiceEmail: '',
    invoicePhone: '',
    invoiceCccdCmnd: '',
    invoiceBankAccount: '',
    invoiceDvqhnsCode: '',
  };
}

export const emptyAddress = (isDefault: boolean, receiver = '', contactNumber = ''): AddressForm => ({
  key: newKey(),
  id: null,
  label: '',
  receiver,
  contactNumber,
  address: '',
  newCityCode: null,
  newCityName: null,
  newWardCode: null,
  newWardName: null,
  isDefault,
});

export const toAddressForm = (a: RawAddress): AddressForm => ({ ...a, key: a.id ? `id${a.id}` : newKey() });

export function toCustomerForm(r: RawCustomer, salePic: Named | null = null): CustomerForm {
  const s = (v: string | null | undefined) => v ?? '';
  return {
    type: r.type === 1 ? 1 : 0,
    name: s(r.name),
    code: s(r.code),
    contactNumber: s(r.contactNumber),
    phone: s(r.phone),
    email: s(r.email),
    parent: r.parent ? { id: r.parent.id, code: s(r.parent.code), name: s(r.parent.name) } : null,
    salePic,
    groups: (r.customerGroupDetails ?? [])
      .map((g) => (g.customerGroup ? { id: g.customerGroup.id, name: s(g.customerGroup.name) } : null))
      .filter((g): g is Named => !!g),
    addresses: [...(r.addresses ?? [])]
      .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
      .map(toAddressForm),
    comments: s(r.comments),
    taxCode: s(r.taxCode),
    organization: s(r.organization),
    invoiceBuyerName: s(r.invoiceBuyerName),
    invoiceAddress: s(r.invoiceAddress),
    invoiceEmail: s(r.invoiceEmail),
    invoicePhone: s(r.invoicePhone),
    invoiceCccdCmnd: s(r.invoiceCccdCmnd),
    invoiceBankAccount: s(r.invoiceBankAccount),
    invoiceDvqhnsCode: s(r.invoiceDvqhnsCode),
  };
}

// ---------- Địa chỉ ----------

/** Thêm hoặc thay 1 địa chỉ; luôn chỉ có đúng 1 địa chỉ mặc định. */
export function upsertAddress(list: AddressForm[], a: AddressForm): AddressForm[] {
  const exists = list.some((x) => x.key === a.key);
  let next = exists ? list.map((x) => (x.key === a.key ? a : x)) : [...list, a];
  if (a.isDefault) next = next.map((x) => ({ ...x, isDefault: x.key === a.key }));
  return ensureDefault(next);
}

export function removeAddress(list: AddressForm[], key: string): AddressForm[] {
  return ensureDefault(list.filter((x) => x.key !== key));
}

export function setDefaultAddress(list: AddressForm[], key: string): AddressForm[] {
  return list.map((x) => ({ ...x, isDefault: x.key === key }));
}

function ensureDefault(list: AddressForm[]): AddressForm[] {
  if (!list.length) return list;
  const idx = list.findIndex((x) => x.isDefault);
  return list.map((x, i) => ({ ...x, isDefault: i === (idx === -1 ? 0 : idx) }));
}

const ADDRESS_KEYS = [
  'label',
  'receiver',
  'contactNumber',
  'address',
  'cityCode',
  'cityName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName',
  'newCityCode',
  'newCityName',
  'newWardCode',
  'newWardName',
  'locationName',
] as const;

/** Các ô cho phép gửi rỗng để xóa nội dung cũ (giống web). */
const KEEP_EMPTY = new Set<string>(['label', 'receiver', 'contactNumber', 'address']);

/**
 * Chỉ gửi trường backend nhận (trường lạ bị lỗi 400).
 * Địa chỉ đã lưu (có id): ô mã / tên tỉnh, huyện, xã bị bỏ trống gửi null để
 * xóa hẳn giá trị cũ (backend chỉ sửa trường có gửi lên).
 */
export function toAddressPayload(a: RawAddress): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (a.id) out.id = a.id;
  for (const k of ADDRESS_KEYS) {
    const v = String(a[k] ?? '').trim();
    if (v || KEEP_EMPTY.has(k)) out[k] = v;
    else if (a.id) out[k] = null;
  }
  out.isDefault = !!a.isDefault;
  return out;
}

export function validateAddress(a: RawAddress): string | null {
  if (!hasProvince(a)) return 'Chọn tỉnh / thành phố (địa chỉ mới hoặc địa chỉ cũ).';
  if (a.newCityCode && !a.newWardCode) return 'Chọn phường / xã cho địa chỉ mới.';
  // Chỉ có địa chỉ cũ thì cần đủ 3 cấp để giao hàng.
  if (!a.newCityCode && a.cityCode && (!a.districtCode || !a.wardCode)) return 'Chọn đủ quận / huyện và phường / xã cho địa chỉ cũ.';
  if (!(a.address ?? '').trim()) return 'Nhập số nhà, tên đường.';
  return null;
}

/** Bỏ địa chỉ cũ (3 cấp) khỏi 1 địa chỉ. */
export const OLD_ADDRESS_CLEARED: Partial<RawAddress> = {
  cityCode: null,
  cityName: null,
  districtCode: null,
  districtName: null,
  wardCode: null,
  wardName: null,
  locationName: null,
};

// ---------- Kiểm tra trước khi lưu ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Số điện thoại: chỉ số và dấu + . - ( ) khoảng trắng, ít nhất 8 chữ số. */
export const isPhoneLike = (s: string) => /^[\d\s+().-]+$/.test(s) && s.replace(/\D/g, '').length >= 8;
/** Mã số thuế: 10 số, hoặc 13 số (chi nhánh, có thể có dấu "-"). */
export const isTaxCode = (s: string) => /^\d{10}(-?\d{3})?$/.test(s.trim());

export function validateCustomerForm(f: CustomerForm, opts: { editing: boolean; requireSalePic: boolean }): string | null {
  const t = (s: string) => s.trim();
  if (f.type === null) return 'Chọn loại khách hàng (Cá nhân hoặc Tổ chức).';
  if (!t(f.name)) return 'Nhập tên khách hàng.';
  if (opts.editing && !t(f.code)) return 'Mã khách hàng không được để trống.';
  if (!t(f.contactNumber)) return 'Nhập số điện thoại.';
  if (!isPhoneLike(t(f.contactNumber))) return 'Số điện thoại 1 không hợp lệ.';
  if (t(f.phone) && !isPhoneLike(t(f.phone))) return 'Số điện thoại 2 không hợp lệ.';
  if (t(f.email) && !EMAIL_RE.test(t(f.email))) return 'Email không hợp lệ.';
  if (!opts.editing && opts.requireSalePic && !f.salePic) return 'Chọn Sale PIC phụ trách khách này.';
  if (!f.addresses.length) return 'Thêm ít nhất 1 địa chỉ giao hàng.';
  for (const [i, a] of f.addresses.entries()) {
    if (!hasProvince(a)) return `Địa chỉ ${i + 1} chưa có tỉnh / thành phố.`;
  }
  // Thông tin xuất hóa đơn: đã điền 1 ô chính thì phải đủ các ô bắt buộc (giống web).
  const company = f.type === 1;
  const keys = company
    ? ([
        ['taxCode', 'Mã số thuế'],
        ['invoiceAddress', 'Địa chỉ xuất hóa đơn'],
        ['invoiceEmail', 'Email nhận hóa đơn'],
      ] as const)
    : ([
        ['invoiceBuyerName', 'Tên người mua'],
        ['taxCode', 'Mã số thuế'],
        ['invoiceAddress', 'Địa chỉ xuất hóa đơn'],
      ] as const);
  const started = keys.some(([k]) => t(f[k]));
  if (started) {
    const required = company ? keys : ([...keys, ['invoiceEmail', 'Email nhận hóa đơn']] as const);
    const missing = required.filter(([k]) => !t(f[k])).map(([, label]) => label);
    if (missing.length) return `Thông tin xuất hóa đơn còn thiếu: ${missing.join(', ')}.`;
  }
  if (t(f.invoiceEmail) && !EMAIL_RE.test(t(f.invoiceEmail))) return 'Email nhận hóa đơn không hợp lệ.';
  return null;
}

// ---------- Dữ liệu gửi lên ----------

type Body = Record<string, unknown>;

/** Các ô chữ gửi lên; ô nào chỉ có ở 1 loại khách thì chỉ gửi khi đúng loại. */
const TEXT_FIELDS: { key: keyof CustomerForm; only?: 0 | 1 }[] = [
  { key: 'phone' },
  { key: 'comments' },
  { key: 'taxCode' },
  { key: 'organization', only: 1 },
  { key: 'invoiceBuyerName' },
  { key: 'invoiceAddress' },
  { key: 'invoiceEmail' },
  { key: 'invoicePhone' },
  { key: 'invoiceCccdCmnd' },
  { key: 'invoiceBankAccount', only: 0 },
  { key: 'invoiceDvqhnsCode', only: 1 },
];

export function buildCustomerCreate(f: CustomerForm, ctx: { branchId: number | null; assignSalePic: boolean }): Body {
  const t = (s: string) => s.trim();
  const body: Body = {
    name: t(f.name),
    contactNumber: t(f.contactNumber),
    type: f.type ?? 0,
    addresses: f.addresses.map(toAddressPayload),
  };
  if (ctx.branchId) body.branchId = ctx.branchId;
  if (t(f.code)) body.code = t(f.code);
  if (t(f.email)) body.email = t(f.email);
  if (f.parent) body.parentId = f.parent.id;
  if (f.groups.length) body.groupIds = f.groups.map((g) => g.id);
  if (ctx.assignSalePic && f.salePic) body.salePicId = f.salePic.id;
  for (const { key, only } of TEXT_FIELDS) {
    if (only !== undefined && only !== f.type) continue;
    const v = t(String(f[key] ?? ''));
    if (v) body[key] = v;
  }
  return body;
}

const sameIds = (a: Named[], b: Named[]) =>
  a.length === b.length && a.map((x) => x.id).sort().join(',') === b.map((x) => x.id).sort().join(',');

const addressSig = (list: AddressForm[]) => JSON.stringify(list.map(toAddressPayload));

/**
 * Sửa khách: chỉ gửi những gì đã đổi (backend giữ nguyên trường không gửi).
 * Ô chữ bị xóa trắng thì gửi "" (email chính gửi null vì "" không phải email).
 * Đổi địa chỉ thì gửi đủ danh sách (địa chỉ không có trong danh sách bị xóa).
 */
export function buildCustomerUpdate(f: CustomerForm, base: CustomerForm, ctx: { assignSalePic: boolean }): Body {
  const t = (s: string) => s.trim();
  const body: Body = {};
  if (f.type !== base.type && f.type !== null) body.type = f.type;
  if (t(f.name) !== t(base.name)) body.name = t(f.name);
  if (t(f.code) !== t(base.code) && t(f.code)) body.code = t(f.code);
  if (t(f.contactNumber) !== t(base.contactNumber)) body.contactNumber = t(f.contactNumber);
  if (t(f.email) !== t(base.email)) body.email = t(f.email) || null;
  if (f.parent && f.parent.id !== base.parent?.id) body.parentId = f.parent.id;
  if (!sameIds(f.groups, base.groups)) body.groupIds = f.groups.map((g) => g.id);
  if (ctx.assignSalePic && f.salePic && f.salePic.id !== base.salePic?.id) body.salePicId = f.salePic.id;
  for (const { key, only } of TEXT_FIELDS) {
    if (only !== undefined && only !== f.type) continue;
    const v = t(String(f[key] ?? ''));
    if (v !== t(String(base[key] ?? ''))) body[key] = v;
  }
  if (addressSig(f.addresses) !== addressSig(base.addresses)) body.addresses = f.addresses.map(toAddressPayload);
  return body;
}

/** Form đã khác lúc mở chưa (để hỏi "Bỏ thay đổi?"). */
export function isFormDirty(f: CustomerForm, base: CustomerForm): boolean {
  return JSON.stringify({ ...f, addresses: f.addresses.map(toAddressPayload) }) !==
    JSON.stringify({ ...base, addresses: base.addresses.map(toAddressPayload) });
}
