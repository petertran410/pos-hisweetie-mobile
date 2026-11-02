import ExpoModulesCore
import LarkSSOSDK

/// App Lark trả kết quả về qua scheme riêng (App ID bỏ dấu gạch dưới).
public class LarkSsoAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Chỉ nhận link của Lark, các link khác (expo-router...) để nguyên.
    guard let scheme = LarkSsoModule.registeredScheme,
      url.scheme?.lowercased() == scheme.lowercased()
    else { return false }
    return LarkSSO.handleURL(url)
  }
}
