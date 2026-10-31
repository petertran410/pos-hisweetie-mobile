import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import { base64url, toBase64url } from './base64';
import { http } from './http';
import { queryClient } from './query';
import { ApiError, buildUrl, rawRequest, requestContext } from './request';
import { getDeviceId, getRefreshToken } from './secure';
import {
  applyTokens,
  clearTokens,
  getAccessToken,
  refreshTokens,
  setSessionExpiredHandler,
  type TokenBody,
} from './tokens';

export interface Profile {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  roles: string[];
  permissions: string[];
  branchId?: number | null;
  branchIds?: number[];
  canViewOtherStaffData?: boolean;
}

export interface Branch {
  id: number;
  name: string;
  address?: string | null;
}

type Status = 'booting' | 'signedOut' | 'signedIn' | 'offline';

interface SessionState {
  status: Status;
  user: Profile | null;
  branchId: number | null;
  branches: Branch[];
  /** Lý do vừa bị đăng xuất (hiện ở màn đăng nhập). */
  notice: string | null;
}

export const useSession = create<SessionState>(() => ({
  status: 'booting',
  user: null,
  branchId: null,
  branches: [],
  notice: null,
}));

const branchKey = (userId: number) => `hs_branch_${userId}`;

interface AuthBody extends TokenBody {
  refreshToken: string;
  user: Profile;
}

function setBranch(branchId: number | null) {
  requestContext.branchId = branchId;
  useSession.setState({ branchId });
}

async function loadProfile(branchId: number | null): Promise<Profile> {
  return http.get<Profile>('/auth/profile', { branchId: branchId ?? undefined });
}

/** Chọn chi nhánh: đã chọn lần trước (nếu còn quyền) → mặc định → chi nhánh đầu. */
async function pickBranch(user: Profile, branches: Branch[]): Promise<number | null> {
  const saved = Number(await AsyncStorage.getItem(branchKey(user.id)));
  const ids = branches.map((b) => b.id);
  if (saved && ids.includes(saved)) return saved;
  if (user.branchId && ids.includes(user.branchId)) return user.branchId;
  return ids[0] ?? user.branchId ?? null;
}

/** Sau khi có token: lấy chi nhánh + quyền theo chi nhánh rồi vào app. */
async function enterApp(userHint?: Profile) {
  const first = userHint ?? (await loadProfile(null));
  setBranch(first.branchId ?? null);
  const branches = await http.get<Branch[]>('/branches/my-branches').catch(() => []);
  const branchId = await pickBranch(first, branches);
  setBranch(branchId);
  const user = branchId === first.branchId && userHint ? first : await loadProfile(branchId);
  useSession.setState({ status: 'signedIn', user, branches, notice: null });
}

async function applyAuth(body: AuthBody) {
  await applyTokens(body);
  await enterApp(body.user);
}

/** Mở app: còn refresh token thì vào thẳng, không thì về màn đăng nhập. */
export async function bootstrap() {
  try {
    requestContext.deviceId = await getDeviceId();
  } catch {
    // Keychain không dùng được (vd. bản xem trước trên trình duyệt) → coi như chưa đăng nhập.
    useSession.setState({ status: 'signedOut' });
    return;
  }
  if (!(await getRefreshToken())) {
    useSession.setState({ status: 'signedOut' });
    return;
  }
  try {
    await refreshTokens();
    await enterApp();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      useSession.setState({ status: 'signedOut' });
    } else {
      useSession.setState({ status: 'offline' });
    }
  }
}

export async function signInWithPassword(email: string, password: string) {
  const body = await rawRequest<AuthBody>('/auth/mobile/login', {
    method: 'POST',
    body: { email: email.trim(), password },
  });
  await applyAuth(body);
}

export type LarkResult =
  | { kind: 'signedIn' }
  | { kind: 'setup'; setupToken: string }
  | { kind: 'cancelled' };

/**
 * Đăng nhập Lark: mở trang Lark trong ASWebAuthenticationSession, Lark xong
 * backend trả về app kèm mã một lần, app đổi mã (kèm PKCE) lấy phiên.
 */
export async function signInWithLark(): Promise<LarkResult> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const challenge = toBase64url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );
  const redirect = Linking.createURL('auth/lark');
  const url = buildUrl('/auth/mobile/lark', {
    redirect_uri: redirect,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type !== 'success') return { kind: 'cancelled' };

  const params = Linking.parse(result.url).queryParams ?? {};
  const error = typeof params.error === 'string' ? params.error : undefined;
  const code = typeof params.code === 'string' ? params.code : undefined;
  if (error || !code) throw new ApiError(error ?? 'Đăng nhập Lark thất bại', 401);

  const body = await rawRequest<AuthBody | { setupToken: string }>('/auth/mobile/lark/exchange', {
    method: 'POST',
    body: { code, codeVerifier: verifier },
  });
  if ('setupToken' in body) return { kind: 'setup', setupToken: body.setupToken };
  await applyAuth(body);
  return { kind: 'signedIn' };
}

/** Đặt mật khẩu lần đầu sau khi đăng nhập Lark. */
export async function setupPassword(setupToken: string, password: string, confirmPassword: string) {
  const body = await rawRequest<AuthBody>('/auth/mobile/lark/setup-password', {
    method: 'POST',
    body: { setupToken, password, confirmPassword },
  });
  await applyAuth(body);
}

async function resetLocal(notice: string | null) {
  await clearTokens();
  queryClient.clear();
  setBranch(null);
  useSession.setState({ status: 'signedOut', user: null, branches: [], notice });
}

export async function signOut() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    rawRequest('/auth/mobile/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
  }
  await resetLocal(null);
}

setSessionExpiredHandler((message) => {
  if (useSession.getState().status === 'signedIn') void resetLocal(message);
});

/** Đổi chi nhánh: quyền thay đổi theo chi nhánh nên tải lại profile. */
export async function switchBranch(branchId: number) {
  const { user } = useSession.getState();
  if (!user) return;
  setBranch(branchId);
  await AsyncStorage.setItem(branchKey(user.id), String(branchId));
  const fresh = await loadProfile(branchId);
  useSession.setState({ user: fresh });
  await queryClient.invalidateQueries();
}

export async function reloadProfile() {
  const { branchId } = useSession.getState();
  if (!getAccessToken()) return;
  const fresh = await loadProfile(branchId);
  useSession.setState({ user: fresh });
}

export function currentBranch(): Branch | undefined {
  const { branches, branchId } = useSession.getState();
  return branches.find((b) => b.id === branchId);
}
