import { describe, expect, it } from '@jest/globals';
import {
  allowedKhoTypes,
  buildKhoPayload,
  createBranches,
  defaultBranch,
  fuelLiters,
  isKhoDirty,
  khoAmount,
  lineTotal,
  newKhoForm,
  nextKhoForm,
  ownVehicle,
  toFinanceAccess,
  toKhoCreated,
  toVehicle,
  validateKhoForm,
  vnDayIso,
  vnToday,
  type KhoFile,
  type KhoForm,
} from '../model';

const NOW = new Date('2026-11-05T20:30:00+07:00');
const form = (type: KhoForm['type'], patch: Partial<KhoForm> = {}): KhoForm => ({ ...newKhoForm(type, 6, { id: 9, name: 'Lái xe A' }, NOW), ...patch });
const file = (kind: string, patch: Partial<KhoFile> = {}): KhoFile => ({
  key: `${kind}-1`,
  kind,
  uri: 'file:///a.jpg',
  url: '/uploads/bao-don/chi-phi/a.jpg',
  state: 'done',
  name: 'a.jpg',
  type: 'image/jpeg',
  size: 1234.4,
  ...patch,
});

describe('quyền theo kho', () => {
  const access = toFinanceAccess({
    superAdmin: false,
    branches: [
      { branchId: 6, permissions: ['vehicles:create', 'warehouse_expense:create'] },
      { branchId: 4, permissions: ['warehouse_expense:create'] },
      { branchId: 1, permissions: ['warehouse_cash:view'] },
    ],
  });

  it('chỉ hiện loại phiếu được tạo ở ít nhất 1 kho, theo thứ tự web', () => {
    expect(allowedKhoTypes(access)).toEqual(['chi-khac', 'xang-dau', 'cham-soc-xe']);
    expect(createBranches(access, 'chi-khac')).toEqual([6, 4]);
    expect(createBranches(access, 'tien-mat')).toEqual([]);
    expect(allowedKhoTypes(toFinanceAccess({ superAdmin: true, branches: [] }))).toEqual(['chi-khac', 'tien-mat', 'xang-dau', 'cham-soc-xe']);
    expect(allowedKhoTypes(toFinanceAccess(null))).toEqual([]);
  });

  it('chi nhánh mặc định: chi nhánh đang chọn nếu được phép, không thì kho đầu tiên', () => {
    expect(defaultBranch([6, 4], 4)).toBe(4);
    expect(defaultBranch([6, 4], 2)).toBe(6);
    expect(defaultBranch([], 6)).toBeNull();
  });
});

describe('xe', () => {
  it('chọn sẵn xe của chính lái xe khi chỉ có 1 xe', () => {
    const list = [toVehicle({ id: 1, label: 'Xe tải 29C', driverId: 9 }), toVehicle({ id: 2, plate: '51D', driver: { id: 3, name: 'B' } })];
    expect(list[1]).toMatchObject({ label: '51D', driverId: 3, driverName: 'B' });
    expect(ownVehicle(list, 9)).toBe(1);
    expect(ownVehicle(list, 5)).toBeNull();
    expect(ownVehicle([...list, toVehicle({ id: 4, label: 'X', driverId: 9 })], 9)).toBeNull();
  });
});

describe('kiểm tra trước khi lưu (giống web)', () => {
  it('tiền mặt: số tiền > 0, thu khách phải có khách', () => {
    expect(validateKhoForm(form('tien-mat'))).toBe('Số tiền phải lớn hơn 0');
    expect(validateKhoForm(form('tien-mat', { amount: 500000 }))).toBe('Cần chọn khách hàng');
    expect(validateKhoForm(form('tien-mat', { amount: 500000, receiptKind: 'WAREHOUSE_SALE' }))).toBeNull();
  });

  it('chi khác: số lượng và đơn giá đi cùng nhau; cần số tiền và nội dung', () => {
    expect(validateKhoForm(form('chi-khac', { quantity: 2 }))).toBe('Cần nhập cả số lượng và đơn giá, hoặc bỏ trống cả hai');
    expect(validateKhoForm(form('chi-khac', { amount: 100000 }))).toBe('Cần nhập số tiền và nội dung khoản chi');
    expect(validateKhoForm(form('chi-khac', { quantity: 2, unitPrice: 15000, description: 'Băng keo' }))).toBeNull();
    expect(khoAmount(form('chi-khac', { quantity: 2.5, unitPrice: 15000, amount: 1 }))).toBe(37500);
    expect(lineTotal({ quantity: null, unitPrice: 5 })).toBeNull();
  });

  it('xe: cần xe, số tiền; chăm sóc xe cần loại dịch vụ', () => {
    expect(validateKhoForm(form('xang-dau', { amount: 500000 }))).toBe('Cần chọn xe');
    expect(validateKhoForm(form('xang-dau', { vehicleId: 1 }))).toBe('Cần nhập số tiền hợp lệ');
    expect(validateKhoForm(form('cham-soc-xe', { vehicleId: 1, amount: 200000 }))).toBe('Cần chọn ít nhất một loại dịch vụ');
    expect(validateKhoForm(form('xang-dau', { vehicleId: 1, amount: 500000 }))).toBe('Cần nhập đơn giá xăng dầu');
    expect(validateKhoForm(form('xang-dau', { vehicleId: 1, amount: 500000, unitPrice: 20000 }))).toBeNull();
    expect(validateKhoForm(form('cham-soc-xe', { vehicleId: 1, amount: 200000, serviceTypes: ['Rửa xe'] }))).toBeNull();
    expect(validateKhoForm(form('xang-dau', { branchId: null, vehicleId: 1, amount: 1 }))).toBe('Vui lòng chọn chi nhánh');
  });

  it('số lít = số tiền / đơn giá', () => {
    expect(fuelLiters({ amount: 500000, unitPrice: 20000 })).toBe(25);
    expect(fuelLiters({ amount: 500000, unitPrice: null })).toBeNull();
  });
});

describe('nội dung gửi backend', () => {
  it('ngày theo giờ Việt Nam', () => {
    expect(vnToday(NOW)).toBe('2026-11-05');
    expect(vnDayIso('2026-11-05')).toBe('2026-11-05T00:00:00+07:00');
  });

  it('tiền mặt kho: thu khách gửi danh sách khách, bán đồ kho gửi rỗng; chỉ gửi chứng từ đã tải xong', () => {
    const f = form('tien-mat', {
      amount: 850000,
      customers: [{ id: 5, name: 'Quán A', code: 'KH5' }],
      description: '  Thu tiền HD1 ',
      files: [file('EVIDENCE'), file('EVIDENCE', { key: 'x', state: 'error', url: null })],
    });
    expect(buildKhoPayload(f)).toEqual({
      path: '/internal-finance/warehouse-receipts',
      body: {
        branchId: 6,
        amount: 850000,
        occurredAt: '2026-11-05T00:00:00+07:00',
        description: 'Thu tiền HD1',
        note: undefined,
        receiptKind: 'CUSTOMER',
        customers: [{ customerId: 5 }],
        attachments: [{ fileUrl: '/uploads/bao-don/chi-phi/a.jpg', fileName: 'a.jpg', fileType: 'image/jpeg', fileSize: 1234, kind: 'EVIDENCE' }],
      },
    });
    const sale = buildKhoPayload({ ...f, receiptKind: 'WAREHOUSE_SALE', files: [] }).body;
    expect(sale.customers).toEqual([]);
    expect('attachments' in sale).toBe(false);
  });

  it('chi khác: có số lượng × đơn giá thì không gửi số tiền (backend tự tính)', () => {
    const body = buildKhoPayload(form('chi-khac', { quantity: 2, unitPrice: 15000, amount: 999, description: 'Băng keo', expenseItem: 'Khác' })).body;
    expect(body).toMatchObject({ branchId: 6, amount: undefined, quantity: 2, unitPrice: 15000, description: 'Băng keo', expenseItem: 'Khác', payerId: 9 });
    expect(buildKhoPayload(form('chi-khac', { amount: 120000, description: 'Ship' })).body).toMatchObject({ amount: 120000, quantity: undefined, unitPrice: undefined });
  });

  it('xăng dầu và chăm sóc xe đúng đường dẫn, nhóm ảnh giữ nguyên', () => {
    const fuel = buildKhoPayload(form('xang-dau', { vehicleId: 3, amount: 500000, unitPrice: 20000, odo: 120000, files: [file('PUMP_METER')] }));
    expect(fuel.path).toBe('/internal-finance/vehicle/fuel');
    expect(fuel.body).toMatchObject({ vehicleId: 3, amount: 500000, unitPrice: 20000, odo: 120000, payerId: 9, occurredAt: NOW.toISOString() });
    expect((fuel.body.attachments as { kind: string }[])[0].kind).toBe('PUMP_METER');
    const care = buildKhoPayload(form('cham-soc-xe', { vehicleId: 3, amount: 200000, serviceTypes: ['Rửa xe'], dueAt: '2027-01-31' }));
    expect(care.path).toBe('/internal-finance/vehicle-care');
    expect(care.body).toMatchObject({ serviceTypes: ['Rửa xe'], dueAt: '2027-01-31' });
    expect('unitPrice' in care.body).toBe(false);
  });
});

describe('sau khi tạo', () => {
  it('nhập tiếp: giữ chi nhánh, ngày, xe, người chi; xóa số tiền và ảnh', () => {
    const f = form('xang-dau', { vehicleId: 3, amount: 500000, files: [file('INVOICE')], date: '2026-11-01' });
    const next = nextKhoForm(f, NOW);
    expect(next).toMatchObject({ branchId: 6, vehicleId: 3, payer: { id: 9 }, date: '2026-11-01', amount: 0, files: [] });
  });

  it('phiếu vừa tạo lấy mã và số tiền backend trả về', () => {
    expect(toKhoCreated({ id: 7, code: 'PCK00007', amount: '850000.00' }, form('tien-mat', { amount: 1 }), 'Kho Hà Nội', NOW)).toEqual({
      id: 7,
      code: 'PCK00007',
      type: 'tien-mat',
      amount: 850000,
      branchName: 'Kho Hà Nội',
      createdAt: NOW.toISOString(),
    });
  });

  it('đã nhập gì thì hỏi trước khi bỏ', () => {
    const base = form('chi-khac');
    expect(isKhoDirty(base, base)).toBe(false);
    expect(isKhoDirty({ ...base, at: new Date().toISOString() }, base)).toBe(false);
    expect(isKhoDirty({ ...base, amount: 1 }, base)).toBe(true);
    expect(isKhoDirty({ ...base, files: [file('EVIDENCE')] }, base)).toBe(true);
  });
});
