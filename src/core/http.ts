import { ApiError, rawRequest, type RequestOptions } from './request';
import { ensureAccessToken, refreshTokens } from './tokens';

export { ApiError } from './request';
export type { Query } from './request';

/**
 * Gọi API đã đăng nhập: tự gắn token, chi nhánh, mã thiết bị; gặp 401 thì
 * làm mới token 1 lần rồi thử lại.
 */
export async function api<T>(path: string, opts: Omit<RequestOptions, 'token'> = {}): Promise<T> {
  const token = await ensureAccessToken();
  try {
    return await rawRequest<T>(path, { ...opts, token });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const fresh = await refreshTokens();
    return rawRequest<T>(path, { ...opts, token: fresh });
  }
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query']) => api<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) =>
    api<T>(path, { method: 'POST', form, timeoutMs: 120_000 }),
};

/** Thông báo lỗi dễ hiểu cho người dùng. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Có lỗi xảy ra, vui lòng thử lại';
}
