import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** API backend, ví dụ `https://sandbox-api.hisweetievietnam.com/api`. */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://sandbox-api.hisweetievietnam.com/api'
).replace(/\/$/, '');

/** Gốc của API (ảnh upload nằm ở `/uploads`, không có `/api`). */
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Backend nhận diện app qua chuỗi này (danh sách "Thiết bị đăng nhập"). */
export const USER_AGENT = `HiSweetiePOS/${APP_VERSION} (iPhone; iOS ${String(Platform.Version)})`;

/** Ảnh có thể là URL tuyệt đối hoặc đường dẫn `/uploads/...`. */
export function resolveFileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
