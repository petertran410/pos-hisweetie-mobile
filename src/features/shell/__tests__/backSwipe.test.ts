import { describe, expect, it } from '@jest/globals';
import { BACK_SHARE, BACK_VELOCITY, prevTabName, settleDuration, SETTLE_MAX_MS, SETTLE_MIN_MS, shouldGoBack } from '../backSwipe';

const W = 390;

describe('shouldGoBack', () => {
  it('quay lại khi kéo quá nửa đường', () => {
    expect(shouldGoBack(W * BACK_SHARE + 1, 0, W)).toBe(true);
  });

  it('quay lại khi vuốt nhanh dù kéo chưa xa', () => {
    expect(shouldGoBack(20, BACK_VELOCITY + 1, W)).toBe(true);
  });

  it('không quay lại khi kéo ít và chậm', () => {
    expect(shouldGoBack(W * BACK_SHARE - 1, 100, W)).toBe(false);
  });

  it('không quay lại khi đã kéo xa nhưng hất ngược lại', () => {
    expect(shouldGoBack(W * 0.8, -BACK_VELOCITY - 1, W)).toBe(false);
  });

  it('không quay lại khi kéo sang trái', () => {
    expect(shouldGoBack(-10, BACK_VELOCITY + 100, W)).toBe(false);
  });
});

describe('settleDuration', () => {
  it('còn xa thì trượt lâu hơn, gần đích thì nhanh', () => {
    expect(settleDuration(0, W, true)).toBe(SETTLE_MAX_MS);
    expect(settleDuration(W, W, true)).toBe(SETTLE_MIN_MS);
    expect(settleDuration(W * 0.8, W, true)).toBeLessThan(settleDuration(W * 0.2, W, true));
  });

  it('trượt về chỗ cũ tính theo quãng đã kéo', () => {
    expect(settleDuration(0, W, false)).toBe(SETTLE_MIN_MS);
    expect(settleDuration(W * 0.3, W, false)).toBeGreaterThan(SETTLE_MIN_MS);
  });
});

describe('prevTabName', () => {
  const routes = [
    { key: 'k-ban', name: 'ban-hang' },
    { key: 'k-don', name: 'don-hang' },
    { key: 'k-them', name: 'them' },
  ];

  it('trả về tab vừa mở trước tab đang xem', () => {
    const history = [
      { type: 'route', key: 'k-ban' },
      { type: 'route', key: 'k-don' },
    ];
    expect(prevTabName({ history, routes })).toBe('ban-hang');
  });

  it('không có tab trước khi mới mở 1 tab hoặc chưa có lịch sử', () => {
    expect(prevTabName({ history: [{ type: 'route', key: 'k-ban' }], routes })).toBeNull();
    expect(prevTabName({ routes })).toBeNull();
    expect(prevTabName(undefined)).toBeNull();
  });

  it('bỏ qua mục lịch sử không phải tab', () => {
    const history = [
      { type: 'route', key: 'k-them' },
      { type: 'drawer' },
      { type: 'route', key: 'k-don' },
    ];
    expect(prevTabName({ history, routes })).toBe('them');
  });
});
