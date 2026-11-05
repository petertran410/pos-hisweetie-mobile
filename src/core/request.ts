import { API_URL, USER_AGENT } from './config';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | QueryValue[]>;

/** Lỗi gọi API đã chuẩn hoá: `status` 0 = không kết nối được. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thông tin gắn vào mọi request (do session cập nhật). */
export const requestContext: {
  deviceId: string | null;
  branchId: number | null;
} = { deviceId: null, branchId: null };

export function buildUrl(path: string, query?: Query): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === undefined || v === null || v === '') continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return `${API_URL}${path}${parts.length ? `?${parts.join('&')}` : ''}`;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Gửi multipart (upload ảnh). */
  form?: FormData;
  token?: string | null;
  /**
   * Chi nhánh gửi trong X-Branch-Id (mặc định: chi nhánh đang chọn). Backend
   * kiểm quyền theo chi nhánh này, nên thao tác trên chi nhánh khác phải gửi đúng.
   */
  branchId?: number | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Lấy câu thông báo lỗi tiếng Việt từ body lỗi của backend. */
function errorFromBody(status: number, data: unknown): ApiError {
  const body = data as { message?: unknown } | null;
  const msg = body?.message;
  if (typeof msg === 'string' && msg) return new ApiError(msg, status);
  if (Array.isArray(msg) && msg.length) return new ApiError(String(msg[0]), status);
  if (msg && typeof msg === 'object') {
    const inner = msg as { message?: unknown; code?: unknown };
    const text = Array.isArray(inner.message) ? inner.message[0] : inner.message;
    return new ApiError(
      typeof text === 'string' && text ? text : 'Có lỗi xảy ra',
      status,
      typeof inner.code === 'string' ? inner.code : undefined,
    );
  }
  if (status === 403) return new ApiError('Bạn không có quyền thực hiện thao tác này', status);
  if (status === 404) return new ApiError('Không tìm thấy dữ liệu', status);
  if (status >= 500) return new ApiError('Máy chủ đang gặp lỗi, vui lòng thử lại', status);
  return new ApiError('Có lỗi xảy ra', status);
}

const NETWORK_ERROR = 'Không thể kết nối tới máy chủ. Kiểm tra mạng và thử lại';
const TIMEOUT_ERROR = 'Kết nối tới máy chủ quá thời gian, vui lòng thử lại';

/**
 * Gửi multipart (ảnh, tệp) bằng XMLHttpRequest của React Native. `fetch` của
 * Expo không nhận phần tệp dạng `{ uri, name, type }`; XHR đọc tệp thẳng từ
 * máy (không nạp cả tệp vào bộ nhớ JS) nên cũng nhẹ hơn.
 */
export function sendMultipart(
  url: string,
  method: string,
  headers: Record<string, string>,
  form: FormData,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.timeout = timeoutMs;
    xhr.withCredentials = false;
    xhr.onload = () => resolve({ status: xhr.status, text: typeof xhr.responseText === 'string' ? xhr.responseText : '' });
    xhr.onerror = () => reject(new ApiError(NETWORK_ERROR, 0));
    xhr.ontimeout = () => reject(new ApiError(TIMEOUT_ERROR, 0));
    xhr.onabort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

/** Gọi API không tự làm mới token (dùng cho đăng nhập / làm mới token). */
export async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': USER_AGENT,
  };
  if (!opts.form) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (requestContext.deviceId) headers['X-Device-Id'] = requestContext.deviceId;
  const branchId = opts.branchId ?? requestContext.branchId;
  if (branchId) headers['X-Branch-Id'] = String(branchId);

  const url = buildUrl(path, opts.query);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let status: number;
  let text: string;
  if (opts.form) {
    const res = await sendMultipart(url, opts.method ?? 'POST', headers, opts.form, timeoutMs, opts.signal);
    status = res.status;
    text = res.text;
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    opts.signal?.addEventListener('abort', () => controller.abort());
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        // App không dùng cookie: refresh token nằm trong Keychain.
        credentials: 'omit',
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = (e as { name?: string })?.name === 'AbortError';
      if (aborted && opts.signal?.aborted) throw e;
      throw new ApiError(aborted ? TIMEOUT_ERROR : NETWORK_ERROR, 0);
    } finally {
      clearTimeout(timer);
    }
    status = res.status;
    text = await res.text();
  }

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (status < 200 || status >= 300) throw errorFromBody(status, data);
  return data as T;
}
