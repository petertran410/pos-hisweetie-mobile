// Cấu hình mã "fingerprint" (runtimeVersion) của EAS Update.
// Giữ các mục Expo mặc định bỏ qua (preset "balanced"), thêm bỏ qua phần `scripts`
// trong package.json: sửa lệnh yarn không đổi code native nên không cần build lại.
// Thêm/nâng thư viện có code native vẫn đổi fingerprint → phải build lại.
const { SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun |
    SourceSkips.ExpoConfigVersions |
    SourceSkips.ExpoConfigRuntimeVersionIfString |
    SourceSkips.EasJson |
    SourceSkips.Easignore |
    SourceSkips.AutolinkingConfigPaths |
    SourceSkips.PackageJsonScriptsAll,
  // File từ biến môi trường kiểu File của EAS (vd GOOGLE_SERVICES_JSON của
  // Firebase): EAS CLI không tải các file này về máy, nên runtime version tính ở
  // máy sẽ lệch với trên EAS và build bị dừng. Bỏ qua chúng khi tính fingerprint;
  // đổi file Firebase thì vẫn phải build lại app.
  ignorePaths: ['**/eas-environment-secrets/**'],
};
