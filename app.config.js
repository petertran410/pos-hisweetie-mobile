// Cấu hình động bổ sung cho app.json.
// IOS_BUNDLE_ID: dùng khi ký bằng profile có Bundle ID khác (đặt trong biến
// môi trường EAS, không ghi trong mã nguồn). Không có thì giữ Bundle ID gốc.
// GOOGLE_SERVICES_JSON: file google-services.json của Firebase (để Android nhận
// thông báo đẩy), lưu dạng biến kiểu file trên EAS, không commit vào mã nguồn.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier: process.env.IOS_BUNDLE_ID || config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
