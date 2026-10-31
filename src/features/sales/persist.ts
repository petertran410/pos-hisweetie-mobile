import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { DRAFT_PREFIX, useSession } from '@/core/session';
import { cartSnapshot, EMPTY_CART, useCart, type CartState, type SaleMode } from './cart';

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
 * Giỏ hàng nháp theo từng nhân viên + chi nhánh: tắt app mở lại vẫn còn,
 * đổi chi nhánh thì mở giỏ của chi nhánh đó. Xóa khi đăng xuất.
 */
export function useCartPersistence(defaultMode: SaleMode) {
  const userId = useSession((s) => s.user?.id);
  const branchId = useSession((s) => s.branchId);

  useEffect(() => {
    if (!userId || !branchId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    const key = cartKey(userId, branchId);

    void (async () => {
      const [rawCart, rawBook] = await Promise.all([
        AsyncStorage.getItem(key).catch(() => null),
        AsyncStorage.getItem(bookKey(userId)).catch(() => null),
      ]);
      if (!alive) return;
      const saved = parse<CartState>(rawCart);
      const book = parse<{ id: number | null; name: string | null }>(rawBook);
      if (saved && Array.isArray(saved.lines)) {
        useCart.getState().load(saved);
      } else {
        useCart.getState().load({
          ...EMPTY_CART,
          mode: defaultMode,
          priceBookId: book?.id ?? null,
          priceBookName: book?.name ?? null,
        });
      }
      unsubscribe = useCart.subscribe((state) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void AsyncStorage.setItem(key, JSON.stringify(cartSnapshot(state))).catch(() => {});
        }, 400);
      });
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [userId, branchId, defaultMode]);
}
