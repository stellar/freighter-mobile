import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "freighter-mobile",
      in: window,
      launchOptions: launchOptions
    )

    // The PrivacyShield native module (local pod) can't reference this class
    // directly, so it requests dismissal via this notification.
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handlePrivacyShieldHideRequest),
      name: Notification.Name("FreighterPrivacyShieldHide"),
      object: nil
    )

    return true
  }

  @objc private func handlePrivacyShieldHideRequest() {
    DispatchQueue.main.async { [weak self] in
      // Skip if the app re-backgrounded between JS calling hide() and this
      // dispatch — a fresh shield was raised; don't tear it down mid-snapshot.
      guard UIApplication.shared.applicationState == .active else { return }
      self?.hidePrivacyShield()
    }
  }
  
  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // Privacy shield: cover wallet content with the BootSplash when the app is
  // backgrounded, so the OS app-switcher snapshot never reveals it. Uses
  // didEnterBackground (not willResignActive) so it does NOT trigger for the
  // Face ID prompt / control center, which only make the app inactive — the
  // snapshot is still taken after didEnterBackground, so it's in time.
  //
  // The shield stays up after the app becomes active until JS finishes the
  // auto-lock decision and calls PrivacyShield.hide() (the PrivacyShield pod
  // posts the FreighterPrivacyShieldHide notification observed above), so a
  // soft-lock overlay can mount before the wallet is revealed (no flash of
  // the unlocked screen). The fallback timer guarantees it can never get
  // stuck if JS doesn't run, and degrades to a bounded splash if the
  // PrivacyShield pod isn't installed (run `pod install`).
  private var privacyWindow: UIWindow?
  private var privacyShieldFallbackTimer: Timer?
  private static let privacyShieldFallbackTimeout: TimeInterval = 1.0

  func applicationDidEnterBackground(_ application: UIApplication) {
    guard privacyWindow == nil else { return }
    let overlay = UIWindow(frame: UIScreen.main.bounds)
    overlay.windowLevel = .alert + 1
    overlay.rootViewController = UIStoryboard(name: "BootSplash", bundle: nil)
      .instantiateInitialViewController()
    overlay.isHidden = false
    privacyWindow = overlay
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    guard privacyWindow != nil else { return }
    privacyShieldFallbackTimer?.invalidate()
    privacyShieldFallbackTimer = Timer.scheduledTimer(
      withTimeInterval: Self.privacyShieldFallbackTimeout,
      repeats: false
    ) { [weak self] _ in
      self?.hidePrivacyShield()
    }
  }

  // Called from the PrivacyShield native module once JS has settled the lock
  // decision (and any lock overlay has mounted). Must run on the main thread.
  func hidePrivacyShield() {
    privacyShieldFallbackTimer?.invalidate()
    privacyShieldFallbackTimer = nil
    privacyWindow?.isHidden = true
    privacyWindow = nil
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}
