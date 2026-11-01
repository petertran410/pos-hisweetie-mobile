import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-print', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('@/core/http', () => ({ http: {} }));

// eslint-disable-next-line import/first
import { pageCssWidth, pageSizePt, printDocument } from '../print';

describe('pageSizePt', () => {
  it('đổi khổ giấy (mm) sang point, có xoay ngang', () => {
    expect(pageSizePt('A5', false)).toEqual({ width: 420, height: 595 });
    expect(pageSizePt('A4', true)).toEqual({ width: 842, height: 595 });
  });

  it('khổ lạ thì dùng A5', () => {
    expect(pageSizePt('K80', false)).toEqual(pageSizePt('A5', false));
  });
});

describe('printDocument', () => {
  it('đặt đúng khổ giấy và giữ nguyên nội dung mẫu in', () => {
    const html = printDocument({ content: '<p>PHIẾU ĐẶT HÀNG</p>', paperSize: 'A5', landscape: false });
    expect(html).toContain('@page { size: A5 portrait; margin: 8mm; }');
    expect(html).toContain('<div class="print-content"><p>PHIẾU ĐẶT HÀNG</p></div>');
    expect(html).toContain('STT');
  });
});

describe('bản xem trên màn hình (để chụp ảnh)', () => {
  it('rộng đúng bằng tờ giấy, có lề và báo chiều cao về app', () => {
    expect(pageCssWidth('A5', false)).toBe(559);
    const html = printDocument({ content: '<p>x</p>', paperSize: 'A5', landscape: false }, { screen: true });
    expect(html).toContain('content="width=559"');
    expect(html).toContain('body { padding: 8mm; background: #fff; }');
    expect(html).toContain('ReactNativeWebView.postMessage');
    // Đo lại khi nội dung đổi (ảnh tải muộn) và thu vừa khung trước khi chụp.
    expect(html).toContain('ResizeObserver');
    expect(html).toContain('window.__hsFit');
  });

  it('bản in (PDF) không kèm phần báo chiều cao', () => {
    const html = printDocument({ content: '<p>x</p>', paperSize: 'A5', landscape: false });
    expect(html).not.toContain('ReactNativeWebView');
  });
});
