import { create } from 'zustand';
import { money } from '@/core/format';
import { cartSnapshot, cartTotals, EMPTY_CART, useCart, type CartState } from './cart';

/** Số đơn nháp tối đa ở tab Bán hàng. */
export const MAX_DRAFTS = 3;

export const DRAFTS_FULL_MESSAGE = `Đã có ${MAX_DRAFTS} đơn nháp. Tạo xong hoặc xóa bớt một đơn trước.`;

export interface Draft {
  id: string;
  /** Hiện là "Đơn {no}". */
  no: number;
  cart: CartState;
}

/**
 * Các đơn nháp của 1 nhân viên ở 1 chi nhánh. `cart` của đơn đang mở có thể
 * đã cũ: bản mới nhất luôn nằm ở `useCart`.
 */
export interface DraftBook {
  activeId: string;
  drafts: Draft[];
}

let seq = 0;
const newDraftId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export const draftLabel = (d: Pick<Draft, 'no'>) => `Đơn ${d.no}`;

/** Chưa có hàng, chưa có khách. */
export const isBlankCart = (c: Pick<CartState, 'lines' | 'customer'>) => c.lines.length === 0 && !c.customer;

/** "Chị Lan · 3 món · 120.000 ₫" / "Trống". */
export function draftSummary(c: Pick<CartState, 'lines' | 'customer' | 'orderDiscount' | 'shippingFee'>): string {
  if (isBlankCart(c)) return 'Trống';
  if (!c.lines.length) return `${c.customer?.name} · Chưa có hàng`;
  const t = cartTotals(c);
  return [c.customer?.name, `${money(t.itemCount)} món`, `${money(t.total)} ₫`].filter(Boolean).join(' · ');
}

/** Dòng chọn đơn nháp; đơn đang mở lấy theo giỏ `active` (mới nhất). */
export function draftOptions(
  book: DraftBook,
  active: Pick<CartState, 'lines' | 'customer' | 'orderDiscount' | 'shippingFee'>,
): { value: string; label: string; sub: string }[] {
  return book.drafts.map((d) => ({
    value: d.id,
    label: draftLabel(d),
    sub: draftSummary(d.id === book.activeId ? active : d.cart),
  }));
}

/** Số nhỏ nhất chưa dùng: xóa Đơn 2 thì đơn mới lại là Đơn 2. */
export function nextDraftNo(drafts: Pick<Draft, 'no'>[]): number {
  const used = new Set(drafts.map((d) => d.no));
  let no = 1;
  while (used.has(no)) no++;
  return no;
}

function singleBook(cart: CartState): DraftBook {
  const id = newDraftId();
  return { activeId: id, drafts: [{ id, no: 1, cart }] };
}

const isCart = (x: unknown): x is CartState =>
  !!x && typeof x === 'object' && Array.isArray((x as { lines?: unknown }).lines);

/**
 * Đọc đơn nháp đã lưu. Bản cũ của app chỉ lưu 1 giỏ (cùng key) → thành Đơn 1,
 * cập nhật app không mất giỏ. Không có / hỏng → 1 đơn trống `blank`.
 */
export function readBook(raw: string | null, blank: CartState): DraftBook {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (isCart(data)) return singleBook({ ...EMPTY_CART, ...data });

  const saved = data as { activeId?: unknown; drafts?: unknown } | null;
  if (saved && Array.isArray(saved.drafts)) {
    const drafts: Draft[] = [];
    for (const d of saved.drafts as Partial<Draft>[]) {
      if (!d || typeof d.id !== 'string' || !isCart(d.cart) || drafts.some((x) => x.id === d.id)) continue;
      const no = Number.isInteger(d.no) && (d.no as number) > 0 && !drafts.some((x) => x.no === d.no) ? (d.no as number) : 0;
      drafts.push({ id: d.id, no, cart: { ...EMPTY_CART, ...d.cart } });
    }
    for (const d of drafts) if (!d.no) d.no = nextDraftNo(drafts);
    if (drafts.length) {
      const activeId = drafts.some((d) => d.id === saved.activeId) ? (saved.activeId as string) : drafts[0].id;
      return { activeId, drafts };
    }
  }
  return singleBook(blank);
}

/** Dạng lưu vào máy. */
export function serializeBook(book: DraftBook): string {
  return JSON.stringify({ v: 2, activeId: book.activeId, drafts: book.drafts });
}

/** Ghi giỏ đang mở vào đơn đang mở. */
export function withActiveCart(book: DraftBook, cart: CartState): DraftBook {
  return { ...book, drafts: book.drafts.map((d) => (d.id === book.activeId ? { ...d, cart: cartSnapshot(cart) } : d)) };
}

/** Thêm 1 đơn và mở đơn đó (không tự chặn số lượng). */
export function addDraft(book: DraftBook, cart: CartState): DraftBook {
  const id = newDraftId();
  return { activeId: id, drafts: [...book.drafts, { id, no: nextDraftNo(book.drafts), cart }] };
}

/** Bỏ 1 đơn (giống đóng tab trên web): đang mở thì mở đơn liền trước; hết đơn thì còn 1 đơn trống `blank`. */
export function removeDraft(book: DraftBook, id: string, blank: CartState): DraftBook {
  const index = book.drafts.findIndex((d) => d.id === id);
  if (index < 0) return book;
  const drafts = book.drafts.filter((d) => d.id !== id);
  if (!drafts.length) return singleBook(blank);
  const activeId = id === book.activeId ? drafts[Math.max(0, index - 1)].id : book.activeId;
  return { activeId, drafts };
}

/** Đơn nháp của tab Bán hàng (đơn đang mở nằm ở `useCart`). */
export const useDrafts = create<DraftBook>(() => ({ activeId: '', drafts: [] }));

/** Đã đọc xong đơn nháp của nhân viên + chi nhánh hiện tại (persist.ts). */
let ready = false;
let waiting: (() => void)[] = [];

/** Bắt đầu đọc lại (đổi chi nhánh, đăng xuất) thì `false`: bỏ các việc đang chờ. Đọc xong thì `true`: chạy chúng. */
export function setDraftsReady(value: boolean) {
  ready = value;
  const run = waiting;
  waiting = [];
  if (value) run.forEach((fn) => fn());
}

/** Chạy `fn` khi đã đọc xong đơn nháp (ngay lập tức nếu đã xong), để đơn mới không bị bản đọc từ máy đè lên. */
export function whenDraftsReady(fn: () => void) {
  if (ready) fn();
  else waiting.push(fn);
}

/** Danh sách đơn kèm giỏ đang mở mới nhất. */
export function currentBook(): DraftBook {
  return withActiveCart(useDrafts.getState(), useCart.getState());
}

/** Đưa danh sách vào bộ nhớ và mở giỏ của đơn đang chọn. */
export function openBook(book: DraftBook) {
  const active = book.drafts.find((d) => d.id === book.activeId);
  if (!active) return;
  useDrafts.setState(book, true);
  useCart.getState().load(active.cart);
}

export function switchDraft(id: string) {
  const book = useDrafts.getState();
  if (id === book.activeId || !book.drafts.some((d) => d.id === id)) return;
  openBook({ ...currentBook(), activeId: id });
}

/**
 * Nút "+": mở 1 đơn trống. Có sẵn đơn trống thì mở lại đơn đó, chưa có thì
 * tạo mới (giữ loại đơn và bảng giá của đơn đang mở).
 */
export function newDraft(): 'opened' | 'already' | 'full' {
  const book = currentBook();
  const blank = book.drafts.find((d) => isBlankCart(d.cart));
  if (blank) {
    if (blank.id === book.activeId) return 'already';
    openBook({ ...book, activeId: blank.id });
    return 'opened';
  }
  if (book.drafts.length >= MAX_DRAFTS) return 'full';
  const { mode, priceBookId, priceBookName } = useCart.getState();
  openBook(addDraft(book, { ...EMPTY_CART, mode, priceBookId, priceBookName }));
  return 'opened';
}

/** Bỏ 1 đơn (đã tạo đơn xong / bấm xóa); còn mỗi đơn đó thì thành đơn trống giữ `keep`. */
export function closeDraft(id: string, keep?: Partial<CartState>) {
  openBook(removeDraft(currentBook(), id, { ...EMPTY_CART, ...keep }));
}
