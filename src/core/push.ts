import { rawRequest } from './request';
import { getAccessToken } from './tokens';

/** Mã nhận thông báo (Expo push token) đã đăng ký với backend cho tài khoản đang đăng nhập. */
let registered: string | null = null;

export function setRegisteredPushToken(token: string | null) {
  registered = token;
}

/**
 * Đăng xuất: báo backend ngừng gửi thông báo tới máy này. Gọi trước khi xóa
 * token đăng nhập; không chờ, lỗi mạng thì bỏ qua (đăng nhập tài khoản khác
 * trên máy này thì backend cũng tự chuyển mã sang tài khoản mới).
 */
export function unregisterPushToken() {
  const token = registered;
  const access = getAccessToken();
  registered = null;
  if (!token || !access) return;
  rawRequest('/push-devices/unregister', { method: 'POST', body: { token }, token: access }).catch(() => {});
}
