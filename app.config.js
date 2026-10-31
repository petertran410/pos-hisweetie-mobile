// Cấu hình động bổ sung cho app.json.
// IOS_BUNDLE_ID: dùng khi ký bằng profile có Bundle ID khác (đặt trong biến
// môi trường EAS, không ghi trong mã nguồn). Không có thì giữ Bundle ID gốc.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier: process.env.IOS_BUNDLE_ID || config.ios.bundleIdentifier,
  },
});
