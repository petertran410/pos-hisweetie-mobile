import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/core/http', () => ({ http: {} }));
jest.mock('@/core/session', () => ({ useSession: () => null }));

// eslint-disable-next-line import/first
import { rangeParams } from '../api';

describe('rangeParams', () => {
  it('kỳ có sẵn gửi range; khoảng tự chọn gửi range=custom kèm from/to (đầu ngày → cuối ngày)', () => {
    expect(rangeParams('week')).toEqual({ range: 'week' });
    expect(rangeParams({ from: '2026-10-01', to: '2026-10-15' })).toEqual({
      range: 'custom',
      from: new Date(2026, 9, 1, 0, 0, 0, 0).toISOString(),
      to: new Date(2026, 9, 15, 23, 59, 59, 999).toISOString(),
    });
  });
});
