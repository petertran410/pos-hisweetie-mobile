# HiSweetie POS — app iPhone

App bán hàng nội bộ cho iPhone, viết bằng Expo (React Native).

## Chạy thử

Dự án dùng **Yarn 1** (`yarn.lock`), giống web và backend. Đừng dùng `npm install`: npm sẽ tạo thêm `package-lock.json`.

1. Cài thư viện: `yarn install`
2. Tạo file `.env` từ mẫu: `cp .env.example .env`, rồi điền `EXPO_PUBLIC_API_URL`
3. Chạy: `yarn start` (xóa bộ nhớ đệm: `yarn start -c`), mở bằng app **Expo Go** trên iPhone (cùng Wi‑Fi với máy tính)

Thêm thư viện: `npx expo install <tên>` (tự chọn bản hợp với Expo SDK và tự dùng yarn).

Yarn 1 không tự cài thư viện "peer" như npm, nên các thư viện peer cần thiết (`@expo/log-box`, `@expo/metro-runtime`, `@babel/runtime`, `@babel/core`...) được khai báo thẳng trong `package.json`. Sau khi thêm thư viện mới, chạy `yarn install` và xem dòng `unmet peer dependency`.

## Kiểm tra

- `yarn typecheck`
- `yarn lint`
- `yarn test`
- `yarn verify`: chạy cả 3 lệnh trên

## Phát hành

Các lệnh dưới tự chạy `yarn verify` trước, lỗi thì dừng. Địa chỉ backend lấy từ biến môi trường EAS của kênh tương ứng (không lấy `.env` trên máy).

| Lệnh | Việc làm |
| --- | --- |
| `yarn update:prod` | Đẩy bản cập nhật qua mạng cho app đang dùng (kênh `production`). Lời nhắn lấy từ commit cuối; muốn ghi khác: `yarn update:prod -m "…"` |
| `yarn update:preview` | Như trên, cho bản thử nội bộ (kênh `preview`) |
| `yarn build:prod` | Build bản App Store trên EAS |
| `yarn build:prod:submit` | Build bản App Store rồi tự gửi lên TestFlight |
| `yarn submit` | Gửi bản build App Store mới nhất lên TestFlight |
| `yarn build:preview` | Build bản cài nội bộ (ad hoc) |

Cập nhật qua mạng chỉ dùng được khi chỉ đổi mã JS / giao diện. Thêm thư viện native, đổi quyền, icon hay cấu hình app thì phải build lại.

## Quy tắc bảo mật

- **Không commit** `.env`, chứng chỉ, khoá ký app, file thông tin đăng nhập dịch vụ (đã có trong `.gitignore`).
- Không ghi cứng địa chỉ backend, mật khẩu, token hay khoá API trong mã nguồn. Địa chỉ backend chỉ lấy từ biến môi trường lúc build.
- Biến `EXPO_PUBLIC_*` được đóng vào app: chỉ dùng cho thông tin không bí mật (ví dụ địa chỉ API). Mọi quyền truy cập đi qua đăng nhập của người dùng.
- Refresh token lưu trong Keychain (chỉ trên máy này, không sao lưu iCloud); access token chỉ nằm trong bộ nhớ.
- Bản phát hành bắt buộc HTTPS.
