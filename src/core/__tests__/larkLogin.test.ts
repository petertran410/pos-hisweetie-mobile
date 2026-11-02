import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;
const mockAuthorize = jest.fn<AsyncFn>();
const mockIsAvailable = jest.fn<AsyncFn>();
const mockAbandon = jest.fn<AsyncFn>().mockResolvedValue(undefined);
const mockRawRequest = jest.fn<AsyncFn>();
const mockOpenAuthSession = jest.fn<AsyncFn>();

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../../modules/lark-sso', () => ({
  ...jest.requireActual<object>('../../../modules/lark-sso'),
  LarkSso: { authorize: mockAuthorize, isAvailable: mockIsAvailable, abandon: mockAbandon },
}));
jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (path: string) => `hisweetiepos://${path}`,
}));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: mockOpenAuthSession }));
jest.mock('../request', () => ({
  ...jest.requireActual<object>('../request'),
  rawRequest: (...args: unknown[]) => mockRawRequest(...args),
}));

process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
process.env.EXPO_PUBLIC_LARK_APP_ID = 'cli_test123';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signInWithLark } = require('../session') as typeof import('../session');

describe('Lark login on the phone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the Lark app when installed and sends its code + verifier to the backend', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockAuthorize.mockResolvedValue({ code: 'lark-code', codeVerifier: 'v'.repeat(43) });
    mockRawRequest.mockResolvedValue({ setupToken: 'setup-jwt' });

    await expect(signInWithLark()).resolves.toEqual({ kind: 'setup', setupToken: 'setup-jwt' });
    expect(mockAuthorize).toHaveBeenCalledWith('cli_test123', []);
    expect(mockRawRequest).toHaveBeenCalledWith('/auth/mobile/lark/app', {
      method: 'POST',
      body: { code: 'lark-code', codeVerifier: 'v'.repeat(43) },
    });
    expect(mockOpenAuthSession).not.toHaveBeenCalled();
  });

  it('cancelling in the Lark app does not fall back to the web page', async () => {
    mockIsAvailable.mockResolvedValue(true);
    mockAuthorize.mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_LARK_CANCELLED' }));

    await expect(signInWithLark()).resolves.toEqual({ kind: 'cancelled' });
    expect(mockRawRequest).not.toHaveBeenCalled();
    expect(mockOpenAuthSession).not.toHaveBeenCalled();
  });

  it('Lark app missing or SDK failing → login on the Lark web page as before', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'cancel' });

    mockIsAvailable.mockResolvedValue(false);
    await expect(signInWithLark()).resolves.toEqual({ kind: 'cancelled' });
    expect(mockAuthorize).not.toHaveBeenCalled();
    expect(mockOpenAuthSession).toHaveBeenCalledTimes(1);

    mockIsAvailable.mockResolvedValue(true);
    mockAuthorize.mockRejectedValue(Object.assign(new Error('jump failed'), { code: 'ERR_LARK_FAILED' }));
    await expect(signInWithLark()).resolves.toEqual({ kind: 'cancelled' });
    expect(mockOpenAuthSession).toHaveBeenCalledTimes(2);
  });
});
