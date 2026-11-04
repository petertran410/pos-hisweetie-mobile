import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { C } from '@/ui';

/**
 * Bản cập nhật qua mạng (EAS Update): app tự kiểm tra lúc mở; quay lại app
 * thì kiểm tra thêm (tối đa 15 phút 1 lần), tải ngầm. Tải xong thì hỏi người
 * dùng cập nhật ngay. Chọn "Để sau" thì lần mở app tới tự dùng bản mới.
 */
const CHECK_EVERY_MS = 15 * 60_000;

/** Chỉ chạy trên app thật (dev và bản web xem trước không có cập nhật qua mạng). */
const ENABLED = Updates.isEnabled && !__DEV__ && Platform.OS !== 'web';

let lastCheck = Date.now();

export type CheckResult = 'ready' | 'latest' | 'off' | 'error';

/** Kiểm tra ngay; có bản mới thì tải về. */
export async function checkForAppUpdate(): Promise<CheckResult> {
  if (!ENABLED) return 'off';
  lastCheck = Date.now();
  try {
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) return 'latest';
    await Updates.fetchUpdateAsync();
    return 'ready';
  } catch {
    return 'error';
  }
}

/** Mở lại app bằng bản mới đã tải. */
export function applyAppUpdate() {
  return Updates.reloadAsync({
    reloadScreenOptions: { backgroundColor: C.bg, fade: true, spinner: { enabled: true, color: C.brand, size: 'large' } },
  }).catch(() => {
    Alert.alert('Chưa cập nhật được', 'Hãy tắt hẳn app rồi mở lại để dùng bản mới.');
  });
}

export function askToUpdate() {
  Alert.alert(
    'Có bản cập nhật mới',
    'App đã tải xong phiên bản mới. Bấm “Cập nhật ngay” để dùng, app sẽ tự mở lại trong vài giây.\n\nĐang nhập dở thì chọn “Để sau”, lưu xong rồi cập nhật ở mục Thêm › Ứng dụng (hoặc tắt hẳn app rồi mở lại).',
    [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Cập nhật ngay', onPress: () => void applyAppUpdate() },
    ],
  );
}

/** Thông tin cập nhật cho màn Thêm. */
export function useAppUpdate() {
  const u = Updates.useUpdates();
  const running = u.currentlyRunning;
  return {
    enabled: ENABLED,
    pending: ENABLED && u.isUpdatePending,
    busy: u.isChecking || u.isDownloading,
    /** Thời điểm tạo bản đang chạy; null = bản cài đặt gốc. */
    runningSince: running.isEmbeddedLaunch ? null : (running.createdAt ?? null),
  };
}

/** Gắn 1 lần ở gốc app (không vẽ gì). */
export function UpdateWatcher() {
  const { isUpdatePending, downloadedUpdate } = Updates.useUpdates();
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!ENABLED) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheck >= CHECK_EVERY_MS) void checkForAppUpdate();
    });
    return () => sub.remove();
  }, []);

  // Mỗi bản mới chỉ hỏi 1 lần.
  const key = isUpdatePending ? (downloadedUpdate?.updateId ?? 'pending') : null;
  useEffect(() => {
    if (!ENABLED || !key || asked.current === key) return;
    asked.current = key;
    askToUpdate();
  }, [key]);

  return null;
}
