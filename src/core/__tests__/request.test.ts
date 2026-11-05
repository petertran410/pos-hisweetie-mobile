import { afterEach, describe, expect, it, jest } from '@jest/globals';

process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApiError, rawRequest, requestContext } = require('../request') as typeof import('../request');

/** XHR giả: ghi lại request, trả kết quả do test quyết định. */
class FakeXhr {
  static last: FakeXhr | null = null;
  static reply: { status: number; text: string } | 'error' = { status: 200, text: '{}' };
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  timeout = 0;
  withCredentials = true;
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  abort() {
    this.onabort?.();
  }
  send(body: unknown) {
    this.body = body;
    const r = FakeXhr.reply;
    if (r === 'error') this.onerror?.();
    else {
      this.status = r.status;
      this.responseText = r.text;
      this.onload?.();
    }
  }
}

const realXhr = globalThis.XMLHttpRequest;
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.XMLHttpRequest = realXhr;
  globalThis.fetch = realFetch;
  requestContext.branchId = null;
});

describe('chi nhánh kiểm quyền (X-Branch-Id)', () => {
  it('mặc định gửi chi nhánh đang chọn; thao tác trên chi nhánh khác gửi chi nhánh đó', async () => {
    const calls: Record<string, string>[] = [];
    globalThis.fetch = jest.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      calls.push(init?.headers ?? {});
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    requestContext.branchId = 6;
    await rawRequest('/invoices/for-packing');
    await rawRequest('/invoices/for-packing', { branchId: 1 });
    expect(calls[0]['X-Branch-Id']).toBe('6');
    expect(calls[1]['X-Branch-Id']).toBe('1');
  });
});

describe('gửi ảnh / tệp (multipart)', () => {
  it('gửi bằng XMLHttpRequest, kèm token và chi nhánh, không tự đặt Content-Type, không dùng fetch', async () => {
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    FakeXhr.reply = { status: 201, text: '{"url":"https://api.example.test/uploads/dong-hang/a.jpg"}' };
    requestContext.branchId = 6;
    const form = new FormData();
    form.append('file', { uri: 'file:///tmp/a.jpg', name: 'a.jpg', type: 'image/jpeg' } as unknown as Blob);

    const res = await rawRequest<{ url: string }>('/upload/image?subfolder=dong-hang', { method: 'POST', form, token: 'tok', timeoutMs: 120_000 });

    expect(res.url).toBe('https://api.example.test/uploads/dong-hang/a.jpg');
    const x = FakeXhr.last as FakeXhr;
    expect(x.method).toBe('POST');
    expect(x.url).toBe('https://api.example.test/api/upload/image?subfolder=dong-hang');
    expect(x.headers.Authorization).toBe('Bearer tok');
    expect(x.headers['X-Branch-Id']).toBe('6');
    expect(x.headers['Content-Type']).toBeUndefined();
    expect(x.body).toBe(form);
    expect(x.timeout).toBe(120_000);
    expect(x.withCredentials).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lỗi từ máy chủ trả câu báo của backend; mất mạng báo không kết nối được', async () => {
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
    FakeXhr.reply = { status: 400, text: '{"message":"Mime type không được hỗ trợ: text/x"}' };
    const form = new FormData();
    await expect(rawRequest('/upload/image', { method: 'POST', form })).rejects.toMatchObject({ message: 'Mime type không được hỗ trợ: text/x', status: 400 });
    FakeXhr.reply = 'error';
    await expect(rawRequest('/upload/image', { method: 'POST', form })).rejects.toBeInstanceOf(ApiError);
  });
});
