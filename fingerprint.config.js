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
};
