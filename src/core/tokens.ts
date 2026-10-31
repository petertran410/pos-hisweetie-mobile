import { ApiError, rawRequest } from './request';
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from './secure';

/**
 * Access token chỉ nằm trong bộ nhớ (15 phút); refresh token nằm trong
 * Keychain. Mọi lần làm mới đi qua 1 luồng duy nhất.
 */
let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<string> | null = null;
let onExpired: ((message: string) => void) | null = null;

export interface TokenBody {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

/** Session đăng ký: gọi khi phiên hết hiệu lực hẳn (phải đăng nhập lại). */
export function setSessionExpiredHandler(handler: (message: string) => void) {
  onExpired = handler;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function applyTokens(body: TokenBody) {
  accessToken = body.accessToken;
  accessExpiresAt = Date.now() + body.expiresIn * 1000;
  if (body.refreshToken) await saveRefreshToken(body.refreshToken);
  scheduleRefresh();
}

export async function clearTokens() {
  accessToken = null;
  accessExpiresAt = 0;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  await clearRefreshToken();
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(5_000, accessExpiresAt - Date.now() - 60_000);
  refreshTimer = setTimeout(() => {
    refreshTokens().catch(() => {});
  }, delay);
}

/** Đổi refresh token lấy token mới. Lỗi 401 = phiên hết hiệu lực. */
export function refreshTokens(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new ApiError('Bạn chưa đăng nhập', 401);
    try {
      const body = await rawRequest<TokenBody>('/auth/mobile/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await applyTokens(body);
      return body.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearTokens();
        onExpired?.(e.message || 'Phiên đăng nhập đã hết hạn');
      }
      throw e;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Token còn dùng được ít nhất 30s nữa thì trả luôn, không thì làm mới. */
export async function ensureAccessToken(): Promise<string> {
  if (accessToken && accessExpiresAt - Date.now() > 30_000) return accessToken;
  return refreshTokens();
}

/** Mở lại app sau khi để nền: token sắp hết hạn thì làm mới ngay. */
export function refreshIfStale() {
  if (!accessToken) return;
  if (accessExpiresAt - Date.now() < 60_000) refreshTokens().catch(() => {});
  else scheduleRefresh();
}
