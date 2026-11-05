/**
 * Vuốt từ mép trái ở trang đầu của tab để quay lại tab vừa mở trước đó, giống
 * Facebook: trang đang xem đi theo ngón tay, tab trước hiện sẵn bên dưới và
 * trượt vào. Thanh tab của iOS không có sẵn cử chỉ này; trang con trong tab vẫn
 * dùng cử chỉ vuốt của iOS.
 */

/** Chỉ bắt đầu vuốt trong dải này ở mép trái (pt). */
export const EDGE_WIDTH = 24;
/** Kéo quá phần này của bề ngang màn hình thì quay lại. */
export const BACK_SHARE = 0.4;
/** Hoặc vuốt nhanh hơn mức này (pt/giây). */
export const BACK_VELOCITY = 500;
/** Tab bên dưới bắt đầu lệch trái bằng phần này của bề ngang, trượt dần về 0 (như iOS). */
export const PARALLAX = 0.3;
/** Độ tối của tab bên dưới lúc mới kéo, sáng dần khi kéo ra. */
export const DIM = 0.18;
/** Thời gian trượt nốt khi thả tay (ms), theo quãng đường còn lại. */
export const SETTLE_MAX_MS = 320;
export const SETTLE_MIN_MS = 120;

/** Thả tay thì quay lại không: vuốt đủ nhanh, hoặc kéo đủ xa mà không hất ngược lại. */
export function shouldGoBack(translationX: number, velocityX: number, width: number): boolean {
  'worklet';
  if (translationX <= 0) return false;
  if (velocityX > BACK_VELOCITY) return true;
  return translationX > width * BACK_SHARE && velocityX > -BACK_VELOCITY;
}

/** Thời gian trượt nốt từ `x` tới mép phải (`toEnd`) hoặc về 0. */
export function settleDuration(x: number, width: number, toEnd: boolean): number {
  'worklet';
  if (width <= 0) return SETTLE_MIN_MS;
  const left = Math.min(1, Math.max(0, (toEnd ? width - x : x) / width));
  return Math.round(SETTLE_MIN_MS + (SETTLE_MAX_MS - SETTLE_MIN_MS) * left);
}

interface TabsStateLike {
  history?: readonly unknown[];
  routes?: readonly { key: string; name: string }[];
}

/** Tên tab vừa mở trước tab đang xem (theo lịch sử của thanh tab); null nếu không có. */
export function prevTabName(state: TabsStateLike | undefined): string | null {
  const keys = (state?.history ?? []).flatMap((h) => {
    const e = h as { type?: string; key?: string } | null;
    return e?.type === 'route' && e.key ? [e.key] : [];
  });
  if (keys.length < 2) return null;
  const key = keys[keys.length - 2];
  return state?.routes?.find((r) => r.key === key)?.name ?? null;
}
