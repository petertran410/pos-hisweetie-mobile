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

/** Máy trong mạng nội bộ (backend chạy local): localhost, *.local, IP LAN. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/**
 * Ảnh có thể là URL tuyệt đối hoặc đường dẫn `/uploads/...`. Backend chạy local
 * ghi địa chỉ ảnh theo `API_URL` của nó (vd `localhost` hay IP cũ của máy) mà
 * iPhone không gọi tới được: ảnh `/uploads/` ở máy nội bộ thì lấy qua đúng máy
 * chủ app đang gọi. Máy chủ thật (HTTPS, tên miền) giữ nguyên.
 */
export function resolveFileUrl(path?: string | null, origin: string = API_ORIGIN): string | undefined {
  if (!path) return undefined;
  const m = /^(https?):\/\/([^/:?#]+)(:\d+)?([/?#].*)?$/i.exec(path);
  if (m) {
    const rest = m[4] ?? "";
    if (rest.startsWith("/uploads/") && isPrivateHost(m[2]) && !path.startsWith(`${origin}/`)) return `${origin}${rest}`;
    return path;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path; // file://, ph://, data: … (ảnh trên máy)
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Nguồn ảnh để hiển thị (ảnh trên máy giữ nguyên). */
export const mediaUri = (uri: string): string => resolveFileUrl(uri) ?? uri;
