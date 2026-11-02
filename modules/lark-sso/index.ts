import { requireOptionalNativeModule } from 'expo';

export interface LarkSsoCode {
  code: string;
  codeVerifier: string;
}

interface LarkSsoNative {
  /** App Lark đã cài và bản build có scheme quay về của App ID này. */
  isAvailable(appId: string): Promise<boolean>;
  /** Mở app Lark; trả mã Lark + code_verifier (PKCE) để backend đổi lấy phiên. */
  authorize(appId: string, scopes: string[]): Promise<LarkSsoCode>;
  /** Kết thúc lượt đang chờ khi người dùng quay lại mà Lark không trả kết quả. */
  abandon(): Promise<void>;
}

/** null khi chạy bằng Expo Go hoặc bản build chưa có module: đăng nhập Lark qua web. */
export const LarkSso = requireOptionalNativeModule<LarkSsoNative>('LarkSso');

/** App ID Lark hợp lệ (dạng `cli_xxx`). */
export const isLarkAppId = (appId: string) => /^cli_[A-Za-z0-9]+$/.test(appId);

/** Scheme app Lark dùng để trả kết quả về app: App ID bỏ dấu gạch dưới. */
export const larkScheme = (appId: string) => appId.replace(/_/g, '').toLowerCase();
