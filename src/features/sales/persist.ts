import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { DRAFT_PREFIX, useSession } from '@/core/session';
import { EMPTY_CART, useCart, type SaleMode } from './cart';
import { currentBook, openBook, readBook, serializeBook, setDraftsReady, useDrafts } from './drafts';

/** Key cũ của 1 giỏ, nay chứa cả danh sách đơn nháp (`readBook` đọc được cả 2 dạng). */
const cartKey = (userId: number, branchId: number) => `${DRAFT_PREFIX}cart_${userId}_${branchId}`;
const bookKey = (userId: number) => `${DRAFT_PREFIX}pricebook_${userId}`;

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Nhớ bảng giá vừa chọn để lần sau mở giỏ trống dùng lại (giống web). */
export function rememberPriceBook(userId: number, id: number | null, name: string | null) {
  void AsyncStorage.setItem(bookKey(userId), JSON.stringify({ id, name })).catch(() => {});
}

/**
 * Đơn nháp theo từng nhân viên + chi nhánh: tắt app mở lại vẫn còn, đổi chi
 * nhánh thì mở bộ đơn nháp của chi nhánh đó. Xóa khi đăng xuất. Gọi ở cấp tab
 * (không đợi mở tab Bán hàng) vì tab Đơn hàng cũng mở đơn nháp mới.
 */
export function useCartPersistence(defaultMode: SaleMode) {
  const userId = useSession((s) => s.user?.id);
  const branchId = useSession((s) => s.branchId);

  useEffect(() => {
    if (!userId || !branchId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe: (() => void)[] = [];
    const key = cartKey(userId, branchId);

    void (async () => {
      const [rawCart, rawBook] = await Promise.all([
        AsyncStorage.getItem(key).catch(() => null),
        AsyncStorage.getItem(bookKey(userId)).catch(() => null),
      ]);
      if (!alive) return;
      const book = parse<{ id: number | null; name: string | null }>(rawBook);
      openBook(
        readBook(rawCart, {
          ...EMPTY_CART,
          mode: defaultMode,
          priceBookId: book?.id ?? null,
          priceBookName: book?.name ?? null,
        }),
      );
      const save = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void AsyncStorage.setItem(key, serializeBook(currentBook())).catch(() => {});
        }, 400);
      };
      unsubscribe.push(useCart.subscribe(save), useDrafts.subscribe(save));
      setDraftsReady(true);
    })();

    return () => {
      alive = false;
      setDraftsReady(false);
      clearTimeout(timer);
      unsubscribe.forEach((u) => u());
    };
  }, [userId, branchId, defaultMode]);
}
