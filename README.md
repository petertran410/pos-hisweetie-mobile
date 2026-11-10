# HiSweetie POS — app iPhone và Android

App bán hàng nội bộ cho iPhone và Android, viết bằng Expo (React Native).

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

| Lệnh                     | Việc làm                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn update:prod`       | Đẩy bản cập nhật qua mạng cho app đang dùng (kênh `production`). Lời nhắn lấy từ commit cuối; muốn ghi khác: `yarn update:prod -m "…"` |
| `yarn update:preview`    | Như trên, cho bản thử nội bộ (kênh `preview`)                                                                                          |
| `yarn build:prod`        | Build bản App Store trên EAS                                                                                                           |
| `yarn build:prod:submit` | Build bản App Store rồi tự gửi lên TestFlight                                                                                          |
| `yarn submit`            | Gửi bản build App Store mới nhất lên TestFlight                                                                                        |
| `yarn build:preview`     | Build bản cài nội bộ (ad hoc)                                                                                                          |
| `yarn build:preview:android` | Build APK Android nội bộ, kênh và môi trường `preview`, khóa ký do EAS quản lý                                                        |
| `yarn update:preview:android` | Phát hành OTA riêng cho Android, kênh và môi trường `preview`                                                                        |

Cập nhật qua mạng chỉ dùng được khi chỉ đổi mã JS / giao diện. Thêm thư viện native, đổi quyền, icon hay cấu hình app thì phải build lại.

### Android preview

- Các lệnh không có hậu tố `:android` ở bảng trên vẫn dành cho iPhone.
- Chạy `yarn build:preview:android`, đăng nhập Expo nếu được yêu cầu; ở lần build đầu cho phép EAS tạo khóa ký Android mới nếu dự án chưa có. Giữ cùng package và khóa ký cho những APK nâng cấp sau này.
- APK preview chỉ chứa kiến trúc `arm64-v8a`, dùng cho điện thoại Android. Không build `x86`/`x86_64` cho máy ảo.
- Sau khi EAS build thành công, tải APK từ đường dẫn EAS và cài trên điện thoại Android. Bản này chạy độc lập, không cần Expo Go hay máy tính mở Metro.
- EAS environment `preview` phải có `EXPO_PUBLIC_API_URL` trỏ tới backend HTTPS. Đăng nhập Lark trên Android dùng trình duyệt; module Lark native hiện chỉ hỗ trợ iOS.
- Sau khi chỉ sửa giao diện hoặc logic JS/TS tương thích native, chạy `yarn update:preview:android -m "Mô tả thay đổi"`. Sửa code hoặc push Git chưa tự phát hành OTA.
- App chỉ nhận OTA đúng Android, kênh `preview` và runtime fingerprint tương thích. Khi mở app có mạng, app kiểm tra cập nhật; khi quay lại app sẽ kiểm tra thêm tối đa 15 phút một lần.
- App tải ngầm và hỏi "Cập nhật ngay" / "Để sau". Cập nhật ngay sẽ mở lại app; để sau thì bản đã tải được dùng ở lần khởi động tiếp theo. Có thể kiểm tra thủ công trong mục Thêm > Ứng dụng.
- Thêm/nâng thư viện native, sửa Swift/Kotlin, quyền hệ điều hành, icon hay cấu hình native thì chạy build APK mới, không dùng OTA thay cho APK.

Kiểm thử OTA trên thiết bị: cài APK trước, phát hành một thay đổi hiển thị nhỏ chỉ cho Android `preview`, kiểm tra app cũ tải và áp dụng bản mới mà không cài lại APK. Đồng thời kiểm tra đăng nhập, điều hướng, camera/quét mã, đính kèm và in/chia sẻ. Build hoặc xuất bundle thành công chưa xác nhận các thao tác này hoạt động trên máy thật.

## Quy tắc bảo mật

- **Không commit** `.env`, chứng chỉ, khoá ký app, file thông tin đăng nhập dịch vụ (đã có trong `.gitignore`).
- Không ghi cứng địa chỉ backend, mật khẩu, token hay khoá API trong mã nguồn. Địa chỉ backend chỉ lấy từ biến môi trường lúc build.
- Biến `EXPO_PUBLIC_*` được đóng vào app: chỉ dùng cho thông tin không bí mật (ví dụ địa chỉ API). Mọi quyền truy cập đi qua đăng nhập của người dùng.
- Refresh token lưu trong Keychain (chỉ trên máy này, không sao lưu iCloud); access token chỉ nằm trong bộ nhớ.
- Bản phát hành bắt buộc HTTPS.
