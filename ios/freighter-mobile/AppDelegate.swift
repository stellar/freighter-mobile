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
    // A fresh UIWindow has a nil background, which renders black. That black
    // shows for a frame when RNBootSplash removes the splash view before React
    // has painted, giving a flash between the native splash and the JS one.
    // systemBackground is white in light and black in dark, matching the page
    // colour both the splash and the app paint, so any such gap is invisible
    // in either scheme.
    window?.backgroundColor = .systemBackground

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
    // hidePrivacyShield no-ops unless the app is active, so a hide() that
    // lands during a background bounce won't expose the wallet.
    DispatchQueue.main.async { [weak self] in
      self?.hidePrivacyShield()
    }
  }
  
  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // Privacy shield: cover wallet content with the Varial lockup when the app is
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

  /// The shield's own view: the Varial lockup on the page colour, built in
  /// code rather than reusing BootSplash.storyboard. That storyboard is a
  /// plain page-colour screen so the JS splash animation owns the launch
  /// sequence, and the shield must not follow it into being blank.
  ///
  /// PrivacyShieldLogo carries its own dark variant and systemBackground
  /// follows the scheme, so the shield tracks the device like everything else.
  private static func makePrivacyShieldViewController() -> UIViewController {
    let controller = UIViewController()
    controller.view.backgroundColor = .systemBackground

    guard let logo = UIImage(named: "PrivacyShieldLogo") else {
      return controller
    }

    let imageView = UIImageView(image: logo)
    imageView.contentMode = .scaleAspectFit
    imageView.translatesAutoresizingMaskIntoConstraints = false
    controller.view.addSubview(imageView)

    NSLayoutConstraint.activate([
      imageView.centerXAnchor.constraint(equalTo: controller.view.centerXAnchor),
      imageView.centerYAnchor.constraint(equalTo: controller.view.centerYAnchor),
      imageView.widthAnchor.constraint(equalToConstant: 128),
      imageView.heightAnchor.constraint(equalToConstant: 151),
    ])

    return controller
  }

  func applicationDidEnterBackground(_ application: UIApplication) {
    // Cancel any fallback timer pending from a previous resume so it can't fire
    // during this new background period and tear down the shield we just want
    // to keep up.
    privacyShieldFallbackTimer?.invalidate()
    privacyShieldFallbackTimer = nil

    guard privacyWindow == nil else { return }
    let overlay = UIWindow(frame: UIScreen.main.bounds)
    overlay.windowLevel = .alert + 1
    overlay.rootViewController = Self.makePrivacyShieldViewController()
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
    // Only reveal while the app is actually active: a JS hide() or fallback
    // timer that lands during a background bounce must not expose the wallet.
    guard UIApplication.shared.applicationState == .active else { return }
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
    // Same reason as the window's background: the root view must not be
    // see-through while the JS splash is still coming up.
    rootView.backgroundColor = .systemBackground
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}
