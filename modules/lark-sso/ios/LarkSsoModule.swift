import ExpoModulesCore
import LarkSSOSDK

/// Kết quả 1 lượt xác thực bằng app Lark.
enum LarkSsoOutcome {
  case success(code: String, codeVerifier: String)
  case cancelled
  case failed(String)
}

/**
 Mở app Lark trên điện thoại để đăng nhập (LarkSSOSDK, chế độ mã thử thách).
 App chỉ nhận mã Lark + code_verifier; đổi mã lấy phiên do backend làm vì cần
 app secret (không bao giờ nằm trong app).
 */
public class LarkSsoModule: Module {
  /// Scheme Lark dùng để quay về app (App ID bỏ dấu gạch dưới).
  static var registeredScheme: String?

  private var pending: Promise?
  private var receiver: LarkSsoReceiver?

  public func definition() -> ModuleDefinition {
    Name("LarkSso")

    /// Dùng được khi: app Lark đã cài và bản build có scheme quay về của App ID này.
    AsyncFunction("isAvailable") { (appId: String) -> Bool in
      let scheme = appId.replacingOccurrences(of: "_", with: "").lowercased()
      let types = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
      let registered = types.contains { type in
        ((type["CFBundleURLSchemes"] as? [String]) ?? []).contains { $0.lowercased() == scheme }
      }
      guard registered, let url = URL(string: "lark://") else { return false }
      return UIApplication.shared.canOpenURL(url)
    }.runOnQueue(.main)

    AsyncFunction("authorize") { (appId: String, scopes: [String], promise: Promise) in
      let scheme = appId.replacingOccurrences(of: "_", with: "")
      if LarkSsoModule.registeredScheme != scheme {
        LarkSSO.register(apps: [LarkSSOSDK.App(server: .lark, appId: appId, scheme: scheme)])
        LarkSsoModule.registeredScheme = scheme
      }
      // Chỉ giữ 1 lượt: lượt cũ (nếu còn treo) coi như đã hủy.
      self.finish(.cancelled)
      self.pending = promise

      let receiver = LarkSsoReceiver { [weak self] outcome in self?.finish(outcome) }
      self.receiver = receiver
      let request: SSORequest = .lark
      request.scope = scopes
      // PKCE: mã Lark chỉ đổi được khi kèm code_verifier mà SDK trả riêng cho app.
      request.useChallengeCode = true
      // Màn đang mở: SDK dùng để hiện trang Lark dự phòng khi không mở được app Lark.
      LarkSSO.send(
        request: request,
        viewController: self.appContext?.utilities?.currentViewController(),
        delegate: receiver
      )
    }.runOnQueue(.main)

    /// Người dùng quay lại app mà Lark không trả kết quả: kết thúc lượt đang chờ.
    AsyncFunction("abandon") {
      self.finish(.cancelled)
    }.runOnQueue(.main)
  }

  private func finish(_ outcome: LarkSsoOutcome) {
    guard let promise = pending else { return }
    pending = nil
    receiver = nil
    switch outcome {
    case let .success(code, codeVerifier):
      promise.resolve(["code": code, "codeVerifier": codeVerifier])
    case .cancelled:
      promise.reject("ERR_LARK_CANCELLED", "Đã hủy đăng nhập Lark")
    case let .failed(message):
      promise.reject("ERR_LARK_FAILED", message)
    }
  }
}

/// Nhận kết quả từ LarkSSOSDK (gọi trên luồng chính).
final class LarkSsoReceiver: NSObject, LarkSSODelegate {
  private let onOutcome: (LarkSsoOutcome) -> Void
  private var done = false

  init(onOutcome: @escaping (LarkSsoOutcome) -> Void) {
    self.onOutcome = onOutcome
  }

  func lkSSODidReceive(response: SSOResponse) {
    handle(response)
  }

  /// Tên hàm ở các bản SDK cũ (trước 1.2.0).
  func didReceive(response: SSOResponse) {
    handle(response)
  }

  private func handle(_ response: SSOResponse) {
    guard !done else { return }
    done = true
    response.safeHandleResultWithCodeVerifier(success: { [onOutcome] code, codeVerifier in
      onOutcome(.success(code: code, codeVerifier: codeVerifier))
    }, failure: { [onOutcome] error in
      if case .cancelled = error.type {
        onOutcome(.cancelled)
      } else {
        onOutcome(.failed("\(error)"))
      }
    })
  }
}
