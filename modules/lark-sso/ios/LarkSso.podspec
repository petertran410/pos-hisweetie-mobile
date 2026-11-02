Pod::Spec.new do |s|
  s.name           = 'LarkSso'
  s.version        = '1.0.0'
  s.summary        = 'Đăng nhập bằng app Lark trên iPhone (LarkSSOSDK)'
  s.description    = 'Mở app Lark để xác thực, trả mã Lark kèm code_verifier cho app.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Pod nằm ở nguồn riêng của Lark: Podfile khai báo nguồn (xem app.plugin.js).
  s.dependency 'LarkSSOSDK', '1.2.0'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
