const { withInfoPlist, withPodfile } = require('expo/config-plugins');

/**
 * Cấu hình iOS cho đăng nhập bằng app Lark (LarkSSOSDK):
 * - Podfile: lấy pod LarkSSOSDK từ nguồn riêng của Lark;
 * - Info.plist: được hỏi app Lark có cài không (`lark`), và scheme để app Lark
 *   trả kết quả về (App ID bỏ dấu gạch dưới).
 * App ID đọc từ `EXPO_PUBLIC_LARK_APP_ID` trong `.env` (không commit). Thiếu App
 * ID thì bản build không có scheme quay về và app tự đăng nhập Lark qua web.
 */
const LARK_SPECS = 'https://github.com/volcengine/volcengine-specs.git';
const LARK_POD = `pod 'LarkSSOSDK', '1.2.0', :source => '${LARK_SPECS}'`;

const isLarkAppId = (appId) => /^cli_[A-Za-z0-9]+$/.test(appId);
const larkScheme = (appId) => appId.replace(/_/g, '').toLowerCase();

function addLarkPod(contents) {
  if (contents.includes("pod 'LarkSSOSDK'")) return contents;
  const anchor = /^([ \t]*)use_expo_modules!.*$/m;
  if (!anchor.test(contents)) {
    throw new Error('[lark-sso] Không tìm thấy `use_expo_modules!` trong Podfile');
  }
  return contents.replace(
    anchor,
    (line, indent) => `${line}\n${indent}# Đăng nhập bằng app Lark: pod nằm ở nguồn riêng của Lark.\n${indent}${LARK_POD}`,
  );
}

function addLarkPlist(plist, appId) {
  const queries = new Set(plist.LSApplicationQueriesSchemes || []);
  queries.add('lark');
  plist.LSApplicationQueriesSchemes = [...queries];
  if (isLarkAppId(appId)) {
    const scheme = larkScheme(appId);
    const types = plist.CFBundleURLTypes || [];
    if (!types.some((t) => (t.CFBundleURLSchemes || []).includes(scheme))) {
      types.push({ CFBundleURLSchemes: [scheme] });
    }
    plist.CFBundleURLTypes = types;
  }
  return plist;
}

function withLarkSso(config) {
  const appId = (process.env.EXPO_PUBLIC_LARK_APP_ID || '').trim();
  if (!isLarkAppId(appId)) {
    console.warn('[lark-sso] Chưa có EXPO_PUBLIC_LARK_APP_ID: bản build này đăng nhập Lark qua web.');
  }
  config = withPodfile(config, (c) => {
    c.modResults.contents = addLarkPod(c.modResults.contents);
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults = addLarkPlist(c.modResults, appId);
    return c;
  });
}

module.exports = withLarkSso;
module.exports.addLarkPod = addLarkPod;
module.exports.addLarkPlist = addLarkPlist;
