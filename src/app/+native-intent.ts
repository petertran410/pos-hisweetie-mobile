import { isLarkAppId, larkScheme } from '../../modules/lark-sso';

const LARK_APP_ID = (process.env.EXPO_PUBLIC_LARK_APP_ID ?? '').trim();

/**
 * Link app Lark trả kết quả đăng nhập về app (scheme `cli…`) đã được module
 * native xử lý: không điều hướng theo link này. Link khác giữ nguyên.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (isLarkAppId(LARK_APP_ID) && path.toLowerCase().startsWith(`${larkScheme(LARK_APP_ID)}:`)) {
      return initial ? '/' : null;
    }
  } catch {
    // Lỗi ở đây có thể làm app dừng: luôn trả lại link gốc.
  }
  return path;
}
