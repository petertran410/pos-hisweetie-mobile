import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-print', () => ({
  printAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  selectPrinterAsync: jest.fn<() => Promise<{ name: string; url: string }>>(),
}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn<() => Promise<string | null>>(),
  setItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock('@/core/http', () => ({ http: {} }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// eslint-disable-next-line import/first
import { choosePrinter, loadPrinter, pageCssWidth, pageSizePt, printDocument, printToPrinter } from '../print';
// eslint-disable-next-line import/first
import * as Print from 'expo-print';
// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import { Platform } from 'react-native';

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});

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

describe('platform-specific printing', () => {
  const printer = { name: 'Office printer', url: 'ipp://printer.local' };
  const pdf = 'file:///cache/DH001.pdf';

  it('opens Android system printing without passing an AirPrint URL', async () => {
    Platform.OS = 'android';
    await printToPrinter(pdf, printer);
    expect(Print.printAsync).toHaveBeenCalledWith({ uri: pdf });
    expect(Print.selectPrinterAsync).not.toHaveBeenCalled();
  });

  it('does not read or select an iOS printer on Android', async () => {
    Platform.OS = 'android';
    expect(await loadPrinter()).toBeNull();
    expect(await choosePrinter()).toBeNull();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(Print.selectPrinterAsync).not.toHaveBeenCalled();
  });

  it('preserves direct AirPrint printing on iOS', async () => {
    await printToPrinter(pdf, printer);
    expect(Print.printAsync).toHaveBeenCalledWith({ uri: pdf, printerUrl: printer.url });
  });

  it('preserves selecting and saving the iOS printer', async () => {
    jest.mocked(Print.selectPrinterAsync).mockResolvedValueOnce(printer);
    expect(await choosePrinter()).toEqual(printer);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('hs_printer', JSON.stringify(printer));
  });

  it('keeps a rejected Android print request catchable', async () => {
    Platform.OS = 'android';
    jest.mocked(Print.printAsync).mockRejectedValueOnce(new Error('Print service unavailable'));
    await expect(printToPrinter(pdf)).rejects.toThrow('Print service unavailable');
  });
});
