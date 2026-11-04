import { describe, expect, it } from '@jest/globals';
import {
  buildCustomerCreate,
  buildCustomerUpdate,
  emptyAddress,
  isFormDirty,
  newCustomerForm,
  removeAddress,
  toAddressPayload,
  toCustomerForm,
  upsertAddress,
  validateAddress,
  validateCustomerForm,
  type CustomerForm,
} from '../form';

const addr = (over: object = {}) => ({
  ...emptyAddress(true, 'Anh A', '0900000000'),
  address: '1 Lê Lợi',
  newCityCode: '79',
  newCityName: 'TP Hồ Chí Minh',
  newWardCode: '26734',
  newWardName: 'Phường Bến Thành',
  ...over,
});

const filled = (over: Partial<CustomerForm> = {}): CustomerForm => ({
  ...newCustomerForm(),
  type: 0,
  name: 'Quán A',
  contactNumber: '0900000000',
  addresses: [addr()],
  ...over,
});

describe('validateCustomerForm', () => {
  const opts = { editing: false, requireSalePic: false };
  it('bắt buộc loại khách, tên, SĐT, ít nhất 1 địa chỉ có tỉnh', () => {
    expect(validateCustomerForm(filled({ type: null }), opts)).toMatch(/loại khách/);
    expect(validateCustomerForm(filled({ name: ' ' }), opts)).toMatch(/tên/);
    expect(validateCustomerForm(filled({ contactNumber: '' }), opts)).toMatch(/điện thoại/);
    expect(validateCustomerForm(filled({ contactNumber: 'abc' }), opts)).toMatch(/không hợp lệ/);
    expect(validateCustomerForm(filled({ addresses: [] }), opts)).toMatch(/địa chỉ/);
    expect(validateCustomerForm(filled({ addresses: [addr({ newCityCode: null })] }), opts)).toMatch(/tỉnh/);
    expect(validateCustomerForm(filled(), opts)).toBeNull();
  });

  it('có quyền Sale PIC thì tạo mới phải chọn', () => {
    expect(validateCustomerForm(filled(), { editing: false, requireSalePic: true })).toMatch(/Sale PIC/);
    expect(validateCustomerForm(filled({ code: 'KH01' }), { editing: true, requireSalePic: true })).toBeNull();
  });

  it('xuất hóa đơn: điền 1 ô chính thì phải đủ (cá nhân cần cả email)', () => {
    expect(validateCustomerForm(filled({ taxCode: '0101234567' }), opts)).toMatch(/Tên người mua.*Địa chỉ.*Email/);
    expect(validateCustomerForm(filled({ type: 1, invoiceEmail: 'a@b.vn' }), opts)).toMatch(/Mã số thuế, Địa chỉ/);
    expect(
      validateCustomerForm(filled({ type: 1, taxCode: '0101234567', invoiceAddress: 'HN', invoiceEmail: 'x' }), opts),
    ).toMatch(/Email nhận hóa đơn không hợp lệ/);
  });
});

describe('buildCustomerCreate', () => {
  it('gửi đủ trường cần, bỏ ô trống; trường chỉ của tổ chức không gửi cho cá nhân', () => {
    const body = buildCustomerCreate(filled({ organization: 'X', invoiceDvqhnsCode: '1', invoiceBankAccount: 'P123' }), {
      branchId: 2,
      assignSalePic: false,
    });
    expect(body).toMatchObject({ name: 'Quán A', contactNumber: '0900000000', type: 0, branchId: 2, invoiceBankAccount: 'P123' });
    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('organization');
    expect(body).not.toHaveProperty('invoiceDvqhnsCode');
    expect(body).not.toHaveProperty('salePicId');
    expect((body.addresses as object[])[0]).toMatchObject({ newCityCode: '79', isDefault: true, receiver: 'Anh A' });
  });

  it('Sale PIC, khách cha, nhóm', () => {
    const body = buildCustomerCreate(
      filled({ salePic: { id: 7, name: 'Lan' }, parent: { id: 3, code: 'KH3', name: 'Cha' }, groups: [{ id: 1, name: 'Sỉ' }] }),
      { branchId: 2, assignSalePic: true },
    );
    expect(body).toMatchObject({ salePicId: 7, parentId: 3, groupIds: [1] });
  });
});

describe('buildCustomerUpdate', () => {
  const raw = {
    id: 5,
    code: 'KH05',
    name: 'Quán A',
    type: 0,
    contactNumber: '0900000000',
    email: 'a@b.vn',
    comments: 'Giao sáng',
    addresses: [{ id: 11, address: '1 Lê Lợi', newCityCode: '79', newCityName: 'HCM', isDefault: true, formattedAddress: 'x' }],
    customerGroupDetails: [{ customerGroup: { id: 1, name: 'Sỉ' } }],
  };
  const base = toCustomerForm(raw as never, { id: 7, name: 'Lan' });

  it('không đổi gì thì không gửi gì', () => {
    expect(buildCustomerUpdate(base, base, { assignSalePic: true })).toEqual({});
    expect(isFormDirty(base, base)).toBe(false);
  });

  it('chỉ gửi trường đã đổi; xóa email gửi null, xóa ghi chú gửi ""', () => {
    const f = { ...base, name: 'Quán A2', email: '', comments: '' };
    expect(buildCustomerUpdate(f, base, { assignSalePic: false })).toEqual({ name: 'Quán A2', email: null, comments: '' });
  });

  it('đổi nhóm gửi đủ danh sách (rỗng = bỏ hết nhóm)', () => {
    expect(buildCustomerUpdate({ ...base, groups: [] }, base, { assignSalePic: false })).toEqual({ groupIds: [] });
  });

  it('đổi địa chỉ gửi đủ danh sách, giữ id, không gửi trường lạ', () => {
    const added = upsertAddress(base.addresses, addr({ isDefault: false, address: '2 Hai Bà Trưng' }));
    const body = buildCustomerUpdate({ ...base, addresses: added }, base, { assignSalePic: false });
    const list = body.addresses as Record<string, unknown>[];
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: 11, isDefault: true });
    expect(list[0]).not.toHaveProperty('formattedAddress');
    expect(list[1]).not.toHaveProperty('id');
  });

  it('Sale PIC chỉ gửi khi có quyền và đã đổi', () => {
    const f = { ...base, salePic: { id: 8, name: 'Hoa' } };
    expect(buildCustomerUpdate(f, base, { assignSalePic: true })).toEqual({ salePicId: 8 });
    expect(buildCustomerUpdate(f, base, { assignSalePic: false })).toEqual({});
  });
});

describe('địa chỉ', () => {
  it('luôn đúng 1 địa chỉ mặc định khi thêm / xóa', () => {
    const a = addr();
    const b = addr({ isDefault: true });
    const list = upsertAddress([a], b);
    expect(list.map((x) => x.isDefault)).toEqual([false, true]);
    expect(removeAddress(list, b.key).map((x) => x.isDefault)).toEqual([true]);
  });

  it('payload địa chỉ mới: giữ chuỗi rỗng cho nhãn / người nhận, bỏ ô mã trống', () => {
    const p = toAddressPayload({ label: '', receiver: '', cityCode: '', newCityCode: '79', isDefault: true });
    expect(p).toEqual({ label: '', receiver: '', contactNumber: '', address: '', newCityCode: '79', isDefault: true });
  });

  it('payload địa chỉ đã lưu: ô mã trống gửi null để xóa địa chỉ cũ', () => {
    const p = toAddressPayload({ id: 1, address: 'A', newCityCode: '79', newWardCode: '1', cityCode: '', isDefault: true });
    expect(p).toMatchObject({ id: 1, newCityCode: '79', cityCode: null, districtCode: null, wardName: null, locationName: null });
  });

  it('kiểm tra: địa chỉ mới cần phường / xã; chỉ có địa chỉ cũ thì cần đủ 3 cấp', () => {
    expect(validateAddress({ address: 'A' })).toMatch(/tỉnh/);
    expect(validateAddress({ address: 'A', newCityCode: '79' })).toMatch(/địa chỉ mới/);
    expect(validateAddress({ address: 'A', cityCode: '79', districtCode: '760' })).toMatch(/địa chỉ cũ/);
    expect(validateAddress({ address: 'A', cityCode: '79', districtCode: '760', wardCode: '26734' })).toBeNull();
    expect(validateAddress({ address: 'A', newCityCode: '79', newWardCode: '1', cityCode: '79' })).toBeNull();
    expect(validateAddress({ address: ' ', newCityCode: '79', newWardCode: '1' })).toMatch(/số nhà/);
  });
});
