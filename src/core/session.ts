import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { isLarkAppId, LarkSso, type LarkSsoCode } from '../../modules/lark-sso';
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

/** Tiền tố khóa lưu dữ liệu nháp (giỏ hàng) trên máy. */
export const DRAFT_PREFIX = 'hs_draft_';

interface AuthBody extends TokenBody {
  refreshToken: string;
  user: Profile;
}

function setBranch(branchId: number | null) {
  requestContext.branchId = branchId;
  useSession.setState({ branchId });
}

/** Lần tải quyền gần nhất (để tải lại khi quay lại app). */
let profileLoadedAt = 0;

async function loadProfile(branchId: number | null): Promise<Profile> {
  const profile = await http.get<Profile>('/auth/profile', { branchId: branchId ?? undefined });
  profileLoadedAt = Date.now();
  return profile;
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

const LARK_APP_ID = (process.env.EXPO_PUBLIC_LARK_APP_ID ?? '').trim();

/** Đăng nhập được bằng app Lark trên máy này (bản build có module + đã cài app Lark). */
export async function canUseLarkApp(): Promise<boolean> {
  if (!LarkSso || !isLarkAppId(LARK_APP_ID)) return false;
  try {
    return await LarkSso.isAvailable(LARK_APP_ID);
  } catch {
    return false;
  }
}

/**
 * Đăng nhập Lark: có app Lark thì mở app Lark để xác nhận, không thì mở trang
 * Lark trên web. App Lark lỗi trước khi trả mã thì chuyển sang web.
 */
export async function signInWithLark(): Promise<LarkResult> {
  if (await canUseLarkApp()) {
    const fromApp = await larkAppCode();
    if (fromApp === 'cancelled') return { kind: 'cancelled' };
    if (fromApp) return finishLarkLogin('/auth/mobile/lark/app', fromApp);
  }
  return signInWithLarkWeb();
}

/**
 * Mở app Lark (LarkSSOSDK). Trả mã Lark + code_verifier; `'cancelled'` khi
 * người dùng hủy hoặc quay lại mà không xác nhận; `null` khi SDK lỗi.
 */
async function larkAppCode(): Promise<LarkSsoCode | 'cancelled' | null> {
  const sso = LarkSso;
  if (!sso) return null;
  let left = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Vuốt quay lại app mà Lark không trả kết quả: kết thúc lượt đang chờ.
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background') left = true;
    if (state === 'active' && left) {
      clearTimeout(timer);
      timer = setTimeout(() => void sso.abandon().catch(() => {}), 1500);
    }
  });
  try {
    return await sso.authorize(LARK_APP_ID, []);
  } catch (e) {
    return (e as { code?: string } | null)?.code === 'ERR_LARK_CANCELLED' ? 'cancelled' : null;
  } finally {
    sub.remove();
    clearTimeout(timer);
  }
}

/**
 * Đăng nhập Lark trên web: mở trang Lark trong ASWebAuthenticationSession, Lark
 * xong backend trả về app kèm mã một lần, app đổi mã (kèm PKCE) lấy phiên.
 */
async function signInWithLarkWeb(): Promise<LarkResult> {
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
  return finishLarkLogin('/auth/mobile/lark/exchange', { code, codeVerifier: verifier });
}

/** Gửi mã cho backend: nhận phiên đăng nhập, hoặc setup token nếu lần đầu. */
async function finishLarkLogin(path: string, body: LarkSsoCode): Promise<LarkResult> {
  const res = await rawRequest<AuthBody | { setupToken: string }>(path, { method: 'POST', body });
  if ('setupToken' in res) return { kind: 'setup', setupToken: res.setupToken };
  await applyAuth(res);
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

/** Giỏ hàng nháp có tên, số điện thoại, địa chỉ khách: xóa khi đăng xuất. */
async function clearDrafts() {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const drafts = keys.filter((k) => k.startsWith(DRAFT_PREFIX));
  if (drafts.length) await AsyncStorage.multiRemove(drafts).catch(() => {});
}

export async function signOut() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    rawRequest('/auth/mobile/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
  }
  await clearDrafts();
  await resetLocal(null);
}

setSessionExpiredHandler((message) => {
  if (useSession.getState().status === 'signedIn') void resetLocal(message);
});

/** Đổi chi nhánh: quyền thay đổi theo chi nhánh nên tải lại profile. */
export async function switchBranch(branchId: number) {
  const { user } = useSession.getState();
  if (!user) return;
  // Tải quyền của chi nhánh mới trước: lỗi thì giữ nguyên chi nhánh cũ, không
  // dùng quyền của chi nhánh cũ cho chi nhánh mới.
  const fresh = await loadProfile(branchId);
  // Đổi chi nhánh và quyền cùng lúc (không có lúc chi nhánh mới đi với quyền cũ).
  requestContext.branchId = branchId;
  useSession.setState({ branchId, user: fresh });
  await AsyncStorage.setItem(branchKey(user.id), String(branchId));
  await queryClient.invalidateQueries();
}

export async function reloadProfile() {
  const { branchId, status } = useSession.getState();
  if (status !== 'signedIn' || !getAccessToken()) return;
  const fresh = await loadProfile(branchId);
  // Đăng xuất / đổi chi nhánh trong lúc chờ: bỏ kết quả cũ.
  const now = useSession.getState();
  if (now.status === 'signedIn' && now.branchId === branchId) useSession.setState({ user: fresh });
}

/** Quyền bị quản lý thu hồi / cấp thêm: tải lại khi mở lại app (tối đa 1 lần / 2 phút). */
const PROFILE_STALE_MS = 2 * 60_000;

export function reloadProfileIfStale() {
  if (Date.now() - profileLoadedAt < PROFILE_STALE_MS) return;
  reloadProfile().catch(() => {});
}

export function currentBranch(): Branch | undefined {
  const { branches, branchId } = useSession.getState();
  return branches.find((b) => b.id === branchId);
}
