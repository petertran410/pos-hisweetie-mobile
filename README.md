# HiSweetie POS — app iPhone

App bán hàng nội bộ cho iPhone, viết bằng Expo (React Native).

## Chạy thử

1. Cài thư viện: `npm install`
2. Tạo file `.env` từ mẫu: `cp .env.example .env`, rồi điền `EXPO_PUBLIC_API_URL`
3. Chạy: `npx expo start`, mở bằng app **Expo Go** trên iPhone (cùng Wi‑Fi với máy tính)

## Kiểm tra

- `npm run typecheck`
- `npm run lint`
- `npm test`

## Quy tắc bảo mật

- **Không commit** `.env`, chứng chỉ, khoá ký app, file thông tin đăng nhập dịch vụ (đã có trong `.gitignore`).
- Không ghi cứng địa chỉ backend, mật khẩu, token hay khoá API trong mã nguồn. Địa chỉ backend chỉ lấy từ biến môi trường lúc build.
- Biến `EXPO_PUBLIC_*` được đóng vào app: chỉ dùng cho thông tin không bí mật (ví dụ địa chỉ API). Mọi quyền truy cập đi qua đăng nhập của người dùng.
- Refresh token lưu trong Keychain (chỉ trên máy này, không sao lưu iCloud); access token chỉ nằm trong bộ nhớ.
- Bản phát hành bắt buộc HTTPS.
