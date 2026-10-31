import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { base64url } from './base64';

const DEVICE_KEY = 'hs_device_id';
const REFRESH_KEY = 'hs_refresh_token';

let deviceIdCache: string | null = null;

/**
 * Mã thiết bị cố định (16 byte = 22 ký tự base64url), lưu trong Keychain.
 * Backend dùng nó để 1 người + 1 iPhone = 1 phiên.
 */
export async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9_-]{22}$/.test(id)) {
    id = base64url(Crypto.getRandomBytes(16));
    await SecureStore.setItemAsync(DEVICE_KEY, id, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
  deviceIdCache = id;
  return id;
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export function saveRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_KEY);
}
