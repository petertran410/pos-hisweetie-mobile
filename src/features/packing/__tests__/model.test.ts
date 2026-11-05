import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/core/http', () => ({ http: {}, errorMessage: (e: unknown) => String(e) }));

// eslint-disable-next-line import/first
import { nextQueued } from '../draft';
// eslint-disable-next-line import/first
import { fitSize, needsCompress } from '../media';
// eslint-disable-next-line import/first
import {
  addDocs,
  applyDocPay,
  buildPackPayload,
  DEFAULT_PACK_FILTERS,
  newPackForm,
  packFilterCount,
  packListQuery,
  packPerms,
  pendingUploads,
  toPackDetail,
  toPackForm,
  toPackRow,
  toCandidate,
  validatePackForm,
  waitingStatus,
  type Attachment,
  type DocItem,
  type PackForm,
} from '../model';

const NOW = new Date(2026, 10, 4, 9, 0);
const doc = (id: number, branchId: number | null = 1, kind: DocItem['kind'] = 'invoice'): DocItem => ({
  kind,
  id,
  code: `HD${id}`,
  customerName: `Khách ${id}`,
  total: 100,
  date: null,
  branchId,
  coldCount: 0,
});
const att = (key: string, state: Attachment['state'], url: string | null = null): Attachment => ({
  key,
  uri: `file://${key}`,
  url,
  state,
  name: key,
  type: 'image/jpeg',
  size: null,
});

describe('quyền', () => {
  it('chỉ tạo được loại có quyền, theo thứ tự đóng → loading → giao', () => {
    const p = packPerms({ permissions: ['packing_slips:create', 'packing_hangs:create', 'packing_slips:view'] });
    expect(p.creatable).toEqual(['dong-hang', 'giao-hang']);
    expect(p.list).toBe(true);
    expect(p.update('loading')).toBe(false);
  });
});

describe('danh sách', () => {
  it('lọc theo loại, thanh toán, thời gian; phân trang bằng pageSize + currentItem', () => {
    const q = packListQuery({ ...DEFAULT_PACK_FILTERS, type: 'giao-hang', pay: 'cash', period: 'today', search: ' BD01 ' }, 2, 3, NOW);
    expect(q).toMatchObject({ type: 'giao-hang', paymentMethod: 'cash', branchId: 2, search: 'BD01', pageSize: 20, currentItem: 40 });
    expect(q.fromCreatedDate).toBe(new Date(2026, 10, 4, 0, 0, 0, 0).toISOString());
    // Mặc định như web: mọi thời gian, chi nhánh đang chọn.
    const all = packListQuery(DEFAULT_PACK_FILTERS, 5, 1, NOW);
    expect(all.type).toBeUndefined();
    expect(all.fromCreatedDate).toBeUndefined();
    expect(all.branchId).toBe(5);
    const many = packListQuery({ ...DEFAULT_PACK_FILTERS, branchIds: [1, 6] }, 5, 1, NOW);
    expect(many.branchIds).toEqual([1, 6]);
    expect(many.branchId).toBeUndefined();
    expect(packFilterCount({ ...DEFAULT_PACK_FILTERS, invoiceSearch: 'HD', pay: 'transfer', branchIds: [2] })).toBe(3);
  });

  it('thẻ phiếu: khách đầu + số khách khác, tiền mặt của phiếu giao', () => {
    const row = toPackRow({
      id: 5,
      type: 'giao-hang',
      code: 'BD000005',
      paymentMethod: 'cash',
      cashAmount: '250000',
      numberOfPackages: 3,
      imageCount: 2,
      invoices: [
        { invoice: { id: 1, code: 'HD1', customer: { name: 'A' } } },
        { invoice: { id: 2, code: 'HD2', customer: { name: 'B' } } },
        { invoice: { id: 3, code: 'HD3', customer: { name: 'A' } } },
      ],
    });
    expect(row).toMatchObject({ who: 'A +1 khách', cash: 250000, transfer: false, packages: 3, imageCount: 2, docCodes: ['HD1', 'HD2', 'HD3'] });
    expect(toPackRow({ id: 1, type: 'khac' })).toBeNull();
  });
});

describe('chọn chứng từ', () => {
  it('đóng hàng: chưa có chi nhánh thì lấy theo chứng từ đầu, chứng từ khác chi nhánh bị từ chối', () => {
    const f = newPackForm('dong-hang', null);
    const a = addDocs(f, [doc(1, 3), doc(2, 4), doc(1, 3)]);
    expect(a.form.docs.map((d) => d.id)).toEqual([1]);
    expect(a.form.branchId).toBe(3);
    expect(a.error).toBe('Chỉ được chọn chứng từ cùng chi nhánh');
    expect(addDocs(newPackForm('loading', 1), [doc(5, 2)]).error).toBe('Chứng từ không thuộc chi nhánh đang chọn');
  });

  it('giao hàng: chứng từ phải đúng chi nhánh đang chọn và đúng loại chứng từ', () => {
    const f = newPackForm('giao-hang', 1);
    expect(addDocs(f, [doc(1, 2)]).error).toBe('Chứng từ không thuộc chi nhánh đang chọn');
    expect(addDocs(f, [doc(1, 1, 'consignment')]).error).toBe('QR này là phiếu ký gửi');
    expect(addDocs(f, [doc(1, 1)]).added).toBe(1);
  });
});

describe('kiểm tra và nội dung gửi', () => {
  const ready = (over: Partial<PackForm> = {}): PackForm => ({ ...newPackForm('giao-hang', 1, [doc(1)]), packages: 1, ...over });

  it('báo lỗi đầu tiên cần sửa', () => {
    expect(validatePackForm(newPackForm('dong-hang', 1))).toBe('Vui lòng chọn ít nhất 1 hóa đơn');
    // Số kiện để trống như web: phải tự nhập.
    expect(validatePackForm({ ...newPackForm('giao-hang', 1, [doc(1)]) })).toBe('Số kiện phải lớn hơn 0');
    expect(validatePackForm({ ...ready(), type: 'loading' })).toBe('Vui lòng chọn người loading');
    expect(validatePackForm(ready({ payMethod: 'cash', cashAmount: 0 }))).toBe('Vui lòng nhập số tiền thanh toán');
    expect(validatePackForm(ready({ fees: { ...ready().fees, grab: { on: true, amount: 50000 } } }))).toBe('Vui lòng chọn người chi khi có chi phí');
    expect(validatePackForm(ready())).toBeNull();
  });

  it('giao hàng gửi đủ phí (phí tắt = 0), chỉ gửi hóa đơn hoặc ký gửi, ảnh đã tải xong', () => {
    const f = ready({
      payMethod: 'transfer',
      cashAmount: 999,
      fees: { ...ready().fees, grab: { on: true, amount: 50000 }, guiBen: { on: false, amount: 7000 } },
      payer: { id: 9, name: 'Lan' },
      images: [att('a', 'done', 'https://x/u/a.jpg'), att('b', 'uploading')],
      files: [{ ...att('f', 'done', 'https://x/u/f.pdf'), name: 'bill.pdf', type: 'application/pdf', size: 12 }],
    });
    const body = buildPackPayload(f);
    expect(body).toMatchObject({
      branchId: 1,
      invoiceIds: [1],
      paymentMethod: 'transfer',
      cashAmount: 0,
      hasFeeGrab: true,
      feeGrab: 50000,
      hasFeeGuiBen: false,
      feeGuiBen: 0,
      expensePayerId: 9,
      imageUrls: ['https://x/u/a.jpg'],
      expenseFiles: [{ fileUrl: 'https://x/u/f.pdf', fileName: 'bill.pdf', fileType: 'application/pdf', fileSize: 12 }],
    });
    expect(body).not.toHaveProperty('consignmentIds');
    expect(pendingUploads(f).map((a) => a.key)).toEqual(['b']);
  });

  it('loading gửi người loading; ký gửi gửi consignmentIds', () => {
    const f: PackForm = { ...newPackForm('loading', 1, [doc(4, 1, 'consignment')]), docMode: 'consignment', packages: 1, loadingBy: { id: 3, name: 'Nam' } };
    expect(buildPackPayload(f)).toEqual({ branchId: 1, consignmentIds: [4], numberOfPackages: 1, note: '', imageUrls: [], loadingById: 3 });
  });

  it('sửa phiếu: đưa chi tiết về form, ảnh cũ coi như đã tải', () => {
    const d = toPackDetail('giao-hang', {
      id: 7,
      code: 'BD7',
      branchId: 1,
      numberOfPackages: 2,
      paymentMethod: 'cash',
      cashAmount: '100000',
      hasFeeGrab: true,
      feeGrab: '20000',
      expensePayer: { id: 9, name: 'Lan' },
      invoices: [{ invoice: { id: 1, code: 'HD1' } }],
      images: [{ id: 1, imageUrl: 'https://x/u/1.jpg' }],
      expenseFiles: [{ id: 1, fileUrl: 'https://x/u/a%20b.pdf' }],
      hasColdItems: true,
      coldItemCount: 1,
      coldItems: [{ invoiceCode: 'HD1', productCode: 'SP9', productName: 'Kem dâu' }],
    });
    expect(d.coldItems).toEqual([{ code: 'SP9', name: 'Kem dâu', doc: 'HD1' }]);
    const f = toPackForm(d);
    expect(f.images[0]).toMatchObject({ url: 'https://x/u/1.jpg', state: 'done' });
    expect(f.files[0].name).toBe('a b.pdf');
    expect(f.fees.grab).toEqual({ on: true, amount: 20000 });
    expect(buildPackPayload(f)).toMatchObject({ cashAmount: 100000, feeGrab: 20000, expensePayerId: 9 });
  });
});

describe('thanh toán theo hóa đơn (phiếu giao hàng)', () => {
  const cashDoc = (id: number, amount: number): DocItem => ({ ...doc(id), payNote: { cash: true, amount } });
  const transferDoc = (id: number): DocItem => ({ ...doc(id), payNote: { cash: false, amount: 0 } });

  it('đọc ghi chú thanh toán từ backend', () => {
    expect(toCandidate({ id: 1, paymentNote: { paymentType: 'cash', amount: '1250000' } }, 'invoice').payNote).toEqual({ cash: true, amount: 1250000 });
    expect(toCandidate({ id: 2, paymentNote: { paymentType: 'transfer', amount: null } }, 'invoice').payNote).toEqual({ cash: false, amount: 0 });
    expect(toCandidate({ id: 3 }, 'invoice').payNote).toBeNull();
  });

  it('chọn hóa đơn tiền mặt thì tự chọn Tiền mặt và cộng số tiền cần thu', () => {
    let f = newPackForm('giao-hang', 1, [cashDoc(1, 500000)]);
    expect(f).toMatchObject({ payMethod: 'cash', cashAmount: 500000 });
    f = addDocs(f, [cashDoc(2, 250000), transferDoc(3)]).form;
    expect(f).toMatchObject({ payMethod: 'cash', cashAmount: 750000 });
    // Bỏ hết hóa đơn tiền mặt: về chuyển khoản.
    f = addDocs({ ...f, docs: [] }, [transferDoc(3)]).form;
    expect(f).toMatchObject({ payMethod: 'transfer', cashAmount: 0 });
  });

  it('đã sửa tay thì không ghi đè; sửa phiếu cũ giữ số đã lưu; loại phiếu khác không đụng', () => {
    const manual = { ...newPackForm('giao-hang', 1), payAuto: false, payMethod: 'transfer' as const };
    expect(addDocs(manual, [cashDoc(1, 500000)]).form).toMatchObject({ payMethod: 'transfer', cashAmount: 0 });
    expect(applyDocPay({ ...manual, payAuto: true, docs: [cashDoc(1, 500000)] })).toMatchObject({ payMethod: 'cash', cashAmount: 500000 });
    expect(newPackForm('dong-hang', 1, [cashDoc(1, 500000)])).toMatchObject({ payMethod: 'transfer', cashAmount: 0 });
  });
});

describe('đơn chờ giao', () => {
  it('nhãn trạng thái giống web, lạ thì dùng nhãn backend', () => {
    expect(waitingStatus({ status: 6, statusLabel: 'x' }).label).toBe('Loading');
    expect(waitingStatus({ status: 4, statusLabel: null }).label).toBe('Không giao được');
    expect(waitingStatus({ status: 9, statusLabel: 'Khác' }).label).toBe('Khác');
  });
});

describe('tải ảnh', () => {
  it('ảnh thu về cạnh dài 1920px, ảnh nhỏ giữ nguyên', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1920 });
    expect(fitSize(3024, 4032)).toEqual({ height: 1920 });
    expect(fitSize(1200, 900)).toBeNull();
  });

  it('ảnh đã nhỏ (dưới 400 KB, không quá 1920px) gửi thẳng, còn lại nén trước', () => {
    expect(needsCompress(300_000, 1200, 900)).toBe(false);
    expect(needsCompress(300_000, 4032, 3024)).toBe(true);
    expect(needsCompress(3_000_000, 1200, 900)).toBe(true);
    expect(needsCompress(null, 1200, 900)).toBe(true);
  });

  it('tải tối đa 3 tệp cùng lúc, ảnh trước tệp sau', () => {
    const f: PackForm = { ...newPackForm('giao-hang', 1), images: [att('a', 'done'), att('b', 'queued')], files: [att('c', 'queued')] };
    expect(nextQueued(f, new Set())?.item.key).toBe('b');
    expect(nextQueued(f, new Set(['b']))?.item.key).toBe('c');
    expect(nextQueued(f, new Set(['x', 'y', 'z']))).toBeNull();
  });
});
