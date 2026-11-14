import { beforeEach, describe, expect, it } from '@jest/globals';
import { EMPTY_CART, useCart, type CartState, type SaleCustomer, type SaleProduct } from '../cart';
import {
  addDraft,
  closeDraft,
  currentBook,
  draftOptions,
  draftSummary,
  MAX_DRAFTS,
  newDraft,
  nextDraftNo,
  openBook,
  readBook,
  removeDraft,
  serializeBook,
  setDraftsReady,
  switchDraft,
  useDrafts,
  whenDraftsReady,
  type DraftBook,
} from '../drafts';

const tea: SaleProduct = { id: 1, code: 'TRA1', name: 'Trà đen', basePrice: 50_000 };
const lan: SaleCustomer = { id: 7, code: 'KH7', name: 'Chị Lan' };
const blank: CartState = { ...EMPTY_CART, mode: 'invoice', priceBookId: 3, priceBookName: 'Đại lý' };

const cartWith = (patch: Partial<CartState>): CartState => ({ ...EMPTY_CART, ...patch });
const line = (quantity: number, price = 50_000) => ({ rowId: `r${quantity}`, product: tea, quantity, price, discount: 0, note: '' });

const book = (...carts: CartState[]): DraftBook => ({
  activeId: 'd1',
  drafts: carts.map((cart, i) => ({ id: `d${i + 1}`, no: i + 1, cart })),
});

describe('readBook', () => {
  it('giỏ lưu theo bản cũ (1 giỏ) thành Đơn 1, không mất dữ liệu', () => {
    const old = cartWith({ customer: lan, lines: [line(2)], note: 'Giao sáng' });
    const b = readBook(JSON.stringify(old), blank);
    expect(b.drafts).toHaveLength(1);
    expect(b.drafts[0].no).toBe(1);
    expect(b.activeId).toBe(b.drafts[0].id);
    expect(b.drafts[0].cart).toEqual(old);
  });

  it('giỏ bản cũ thiếu trường mới thì lấy giá trị mặc định', () => {
    const { payKind: _p, cashAmount: _c, ...older } = cartWith({ lines: [line(1)] });
    const b = readBook(JSON.stringify(older), blank);
    expect(b.drafts[0].cart.payKind).toBeNull();
    expect(b.drafts[0].cart.cashAmount).toBe(0);
  });

  it('đọc lại đúng danh sách đã lưu, giữ đơn đang mở', () => {
    const saved = { ...book(cartWith({ lines: [line(1)] }), cartWith({ customer: lan })), activeId: 'd2' };
    expect(readBook(serializeBook(saved), blank)).toEqual(saved);
  });

  it('chưa lưu gì / dữ liệu hỏng → 1 đơn trống theo mặc định', () => {
    for (const raw of [null, '', '{oops', 'null', '42', JSON.stringify({ drafts: [] })]) {
      const b = readBook(raw, blank);
      expect(b.drafts).toHaveLength(1);
      expect(b.drafts[0]).toMatchObject({ no: 1, cart: blank });
    }
  });

  it('bỏ đơn hỏng/trùng, sửa số đơn trùng và đơn đang mở không còn', () => {
    const raw = JSON.stringify({
      v: 2,
      activeId: 'gone',
      drafts: [
        { id: 'a', no: 2, cart: cartWith({ lines: [line(1)] }) },
        { id: 'a', no: 3, cart: EMPTY_CART },
        { id: 'b', no: 2, cart: EMPTY_CART },
        { id: 'c', no: 1, cart: { lines: 'x' } },
        null,
      ],
    });
    const b = readBook(raw, blank);
    expect(b.drafts.map((d) => [d.id, d.no])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
    expect(b.activeId).toBe('a');
  });
});

describe('thao tác trên danh sách', () => {
  it('đơn mới lấy số nhỏ nhất còn trống', () => {
    expect(nextDraftNo([])).toBe(1);
    expect(nextDraftNo([{ no: 1 }, { no: 3 }])).toBe(2);
    const b = addDraft(book(EMPTY_CART, EMPTY_CART), EMPTY_CART);
    expect(b.drafts.map((d) => d.no)).toEqual([1, 2, 3]);
    expect(b.activeId).toBe(b.drafts[2].id);
  });

  it('xóa đơn đang mở thì mở đơn liền trước (như đóng tab trên web)', () => {
    const b = { ...book(EMPTY_CART, EMPTY_CART, EMPTY_CART), activeId: 'd2' };
    expect(removeDraft(b, 'd2', blank)).toMatchObject({ activeId: 'd1', drafts: [{ id: 'd1' }, { id: 'd3' }] });
    expect(removeDraft({ ...b, activeId: 'd1' }, 'd1', blank).activeId).toBe('d2');
    expect(removeDraft(b, 'd3', blank).activeId).toBe('d2');
    expect(removeDraft(b, 'nope', blank)).toBe(b);
  });

  it('xóa đơn cuối cùng thì còn lại 1 đơn trống', () => {
    const b = removeDraft(book(cartWith({ lines: [line(1)] })), 'd1', blank);
    expect(b.drafts).toHaveLength(1);
    expect(b.drafts[0]).toMatchObject({ no: 1, cart: blank });
  });

  it('tóm tắt đơn trong ô chọn', () => {
    expect(draftSummary(EMPTY_CART)).toBe('Trống');
    expect(draftSummary(cartWith({ customer: lan }))).toBe('Chị Lan · Chưa có hàng');
    expect(draftSummary(cartWith({ customer: lan, lines: [line(3, 40_000)], shippingFee: 10_000 }))).toBe(
      'Chị Lan · 3 món · 130.000 ₫',
    );
    expect(draftSummary(cartWith({ lines: [line(1)] }))).toBe('1 món · 50.000 ₫');
  });

  it('ô chọn lấy giỏ đang mở mới nhất thay cho bản đã lưu', () => {
    const opts = draftOptions(book(EMPTY_CART, cartWith({ customer: lan })), cartWith({ lines: [line(2)] }));
    expect(opts).toEqual([
      { value: 'd1', label: 'Đơn 1', sub: '2 món · 100.000 ₫' },
      { value: 'd2', label: 'Đơn 2', sub: 'Chị Lan · Chưa có hàng' },
    ]);
  });
});

describe('đơn nháp của tab Bán hàng', () => {
  beforeEach(() => openBook(readBook(null, blank)));

  const add = (n: number) => useCart.getState().add(tea, 50_000, n);

  it('đổi đơn giữ nguyên giỏ của từng đơn', () => {
    add(2);
    expect(newDraft()).toBe('opened');
    expect(useCart.getState().lines).toEqual([]);
    // Đơn mới giữ loại đơn và bảng giá của đơn đang mở.
    expect(useCart.getState()).toMatchObject({ mode: 'invoice', priceBookId: 3 });
    add(5);
    const [first, second] = useDrafts.getState().drafts;
    switchDraft(first.id);
    expect(useCart.getState().lines[0].quantity).toBe(2);
    switchDraft(second.id);
    expect(useCart.getState().lines[0].quantity).toBe(5);
  });

  it('nút "+" mở lại đơn trống có sẵn, tối đa MAX_DRAFTS đơn', () => {
    expect(newDraft()).toBe('already');
    add(1);
    newDraft();
    const emptyId = useDrafts.getState().activeId;
    switchDraft(useDrafts.getState().drafts[0].id);
    expect(newDraft()).toBe('opened');
    expect(useDrafts.getState().activeId).toBe(emptyId);
    expect(useDrafts.getState().drafts).toHaveLength(2);

    while (useDrafts.getState().drafts.length < MAX_DRAFTS) {
      add(1);
      newDraft();
    }
    add(1);
    expect(newDraft()).toBe('full');
    expect(useDrafts.getState().drafts).toHaveLength(MAX_DRAFTS);
  });

  it('tạo đơn xong thì đóng đúng đơn đó, kể cả khi đã chuyển sang đơn khác', () => {
    add(2);
    const sold = useDrafts.getState().activeId;
    newDraft();
    add(7);
    closeDraft(sold, { mode: 'invoice' });
    const b = useDrafts.getState();
    expect(b.drafts).toHaveLength(1);
    expect(b.drafts[0].no).toBe(2);
    expect(useCart.getState().lines[0].quantity).toBe(7);
  });

  it('đóng đơn duy nhất thì còn 1 đơn trống giữ bảng giá', () => {
    add(2);
    closeDraft(useDrafts.getState().activeId, { mode: 'invoice', priceBookId: 3, priceBookName: 'Đại lý' });
    expect(useDrafts.getState().drafts).toHaveLength(1);
    expect(useCart.getState()).toMatchObject({ lines: [], priceBookId: 3 });
  });

  it('dữ liệu lưu xuống chứa giỏ đang mở mới nhất', () => {
    add(4);
    const saved = readBook(serializeBook(currentBook()), blank);
    expect(saved.drafts[0].cart.lines[0].quantity).toBe(4);
  });
});

describe('chờ đọc xong đơn nháp', () => {
  it('chưa đọc xong thì chờ, đọc xong thì chạy (đơn mới không bị bản lưu đè)', () => {
    setDraftsReady(false);
    const calls: string[] = [];
    whenDraftsReady(() => calls.push('a'));
    expect(calls).toEqual([]);
    setDraftsReady(true);
    expect(calls).toEqual(['a']);
    whenDraftsReady(() => calls.push('b'));
    expect(calls).toEqual(['a', 'b']);
  });

  it('đổi chi nhánh / đăng xuất giữa chừng thì bỏ việc đang chờ', () => {
    setDraftsReady(false);
    const calls: string[] = [];
    whenDraftsReady(() => calls.push('a'));
    setDraftsReady(false);
    setDraftsReady(true);
    expect(calls).toEqual([]);
  });
});
