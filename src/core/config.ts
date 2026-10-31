import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Địa chỉ backend lấy từ biến môi trường lúc build (`.env` khi dev, biến
 * môi trường EAS khi phát hành) — không ghi cứng trong mã nguồn.
 * Phải đọc đúng `process.env.EXPO_PUBLIC_API_URL` để Expo thay giá trị vào.
 */
function readApiUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "Thiếu EXPO_PUBLIC_API_URL. Tạo file .env theo mẫu .env.example rồi chạy lại.",
    );
  }
  // Bản phát hành chỉ nói chuyện với backend qua HTTPS.
  if (!__DEV__ && !raw.startsWith("https://")) {
    throw new Error("EXPO_PUBLIC_API_URL phải dùng https:// ở bản phát hành.");
  }
  return raw.replace(/\/$/, "");
}

export const API_URL = readApiUrl();

/** Gốc của API (ảnh upload nằm ở `/uploads`, không có `/api`). */
export const API_ORIGIN = API_URL.replace(/\/api$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** Backend nhận diện app qua chuỗi này (danh sách "Thiết bị đăng nhập"). */
export const USER_AGENT = `HiSweetiePOS/${APP_VERSION} (iPhone; iOS ${String(Platform.Version)})`;

/** Ảnh có thể là URL tuyệt đối hoặc đường dẫn `/uploads/...`. */
export function resolveFileUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}
