import { describe, expect, it, jest } from '@jest/globals';

const mockPause = jest.fn();
const mockResume = jest.fn(async () => {});
jest.mock('../../sales/persist', () => ({
  pauseCartPersistence: () => mockPause(),
  resumeCartPersistence: () => mockResume(),
}));

// eslint-disable-next-line import/first
import { useOrderEditCart, useOrderEditMeta } from '../../orders/editScope';
// eslint-disable-next-line import/first
import { EMPTY_CART } from '../../sales/cart';
// eslint-disable-next-line import/first
import { enterPreviewSandbox } from '../sandbox';

describe('enterPreviewSandbox', () => {
  it('ngừng lưu giỏ khi mở xem trước; rời trang thì trả đơn đang xử lý và đọc lại đơn nháp', () => {
    const real = { ...EMPTY_CART, note: 'Đơn thật đang sửa dở' };
    const meta = { id: 7, code: 'DH007' } as never;
    useOrderEditCart.getState().load(real);
    useOrderEditMeta.setState({ meta });

    const leave = enterPreviewSandbox();
    expect(mockPause).toHaveBeenCalledTimes(1);

    // Trang xem trước nạp đơn mẫu vào đơn đang xử lý.
    useOrderEditCart.getState().load({ ...EMPTY_CART, note: 'Đơn mẫu' });
    useOrderEditMeta.setState({ meta: { id: 1, code: 'MAU' } as never });

    leave();
    expect(useOrderEditCart.getState().note).toBe('Đơn thật đang sửa dở');
    expect(useOrderEditMeta.getState().meta).toBe(meta);
    expect(mockResume).toHaveBeenCalledTimes(1);
  });
});
