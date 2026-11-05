import { describe, expect, it } from '@jest/globals';

process.env.EXPO_PUBLIC_API_URL = 'http://mac-dev.local:3060/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isPrivateHost, mediaUri, resolveFileUrl } = require('../config') as typeof import('../config');

describe('đường dẫn ảnh', () => {
  it('ảnh /uploads ở máy nội bộ (localhost, IP cũ) lấy qua đúng máy chủ app đang gọi', () => {
    expect(mediaUri('http://192.168.1.3:3060/uploads/dong-hang/a.jpg')).toBe('http://mac-dev.local:3060/uploads/dong-hang/a.jpg');
    expect(mediaUri('http://localhost:3060/uploads/bao-don/b.jpg')).toBe('http://mac-dev.local:3060/uploads/bao-don/b.jpg');
    expect(resolveFileUrl('/uploads/products/c.jpg')).toBe('http://mac-dev.local:3060/uploads/products/c.jpg');
  });

  it('máy chủ thật, đường dẫn khác /uploads và ảnh trên máy giữ nguyên', () => {
    expect(mediaUri('https://backend.example.com/uploads/a.jpg')).toBe('https://backend.example.com/uploads/a.jpg');
    expect(mediaUri('http://192.168.1.3:3060/api/khac')).toBe('http://192.168.1.3:3060/api/khac');
    expect(mediaUri('file:///var/mobile/a.jpg')).toBe('file:///var/mobile/a.jpg');
    expect(mediaUri('ph://ABC-123')).toBe('ph://ABC-123');
    // Máy chủ thật phía sau HTTPS: chỉ đổi khi là máy nội bộ.
    expect(resolveFileUrl('https://cdn.example.com/uploads/x.jpg', 'https://backend.example.com')).toBe('https://cdn.example.com/uploads/x.jpg');
  });

  it('nhận ra máy nội bộ', () => {
    expect(['localhost', 'TranNgocNhan-2.local', '10.0.0.4', '172.20.1.1', '192.168.0.9', '127.0.0.1'].every(isPrivateHost)).toBe(true);
    expect(['backend.example.com', '172.32.0.1', '8.8.8.8'].some(isPrivateHost)).toBe(false);
  });
});
