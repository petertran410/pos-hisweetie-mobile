import Constants from 'expo-constants';
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  useLastNotificationResponse,
} from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { http } from '@/core/http';
import { setRegisteredPushToken } from '@/core/push';
import { KIND_SLUG } from '@/features/orders/model';

const native = Platform.OS !== 'web';

// Đang mở app mà có thông báo tới: vẫn hiện banner (mặc định iOS sẽ ẩn).
if (native) {
  setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Thông báo đẩy cho tài khoản đang đăng nhập (vd "Đã giao hàng thành công"
 * gửi tới người bán của hóa đơn):
 *  - xin quyền thông báo (chỉ hỏi một lần, đã chọn thì không hỏi lại);
 *  - đăng ký mã nhận thông báo của máy này với backend, theo tài khoản;
 *  - bấm vào thông báo thì mở đúng hóa đơn.
 */
export function usePushNotifications(userId: number | undefined) {
  useEffect(() => {
    if (!native || !userId) return;
    let cancelled = false;
    register()
      .then((token) => {
        if (!cancelled && token) setRegisteredPushToken(token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useOpenFromNotification();
}

async function register(): Promise<string | null> {
  // Kênh thông báo Android: backend gửi vào kênh "default". Android 13+ cũng
  // chỉ hiện hộp hỏi quyền khi đã có ít nhất một kênh.
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync('default', { name: 'Thông báo', importance: AndroidImportance.HIGH });
  }
  let { status } = await getPermissionsAsync();
  if (status === 'undetermined') ({ status } = await requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  if (!projectId) return null;
  const { data: token } = await getExpoPushTokenAsync({ projectId });
  await http.post('/push-devices', { token, platform: Platform.OS });
  return token;
}

/** Thông báo đã xử lý: không mở lại khi màn được dựng lại (vd đăng nhập lại). */
let handledId: string | null = null;

function useOpenFromNotification() {
  const response = useLastNotificationResponse();
  useEffect(() => {
    if (!response) return;
    const { identifier, content } = response.notification.request;
    if (identifier === handledId) return;
    handledId = identifier;
    const data = content.data as { type?: unknown; invoiceId?: unknown } | null;
    const invoiceId = Number(data?.invoiceId);
    if (data?.type === 'invoice-delivered' && Number.isInteger(invoiceId) && invoiceId > 0) {
      router.push({ pathname: '/don-hang/[kind]/[id]', params: { kind: KIND_SLUG.invoice, id: String(invoiceId) } });
    }
  }, [response]);
}
