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

    return true
  }
  
  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // Privacy shield: cover wallet content with the BootSplash when the app is
  // backgrounded, so the OS app-switcher snapshot never reveals it. Uses
  // didEnterBackground (not willResignActive) so it does NOT trigger for the
  // Face ID prompt / control center, which only make the app inactive — the
  // snapshot is still taken after didEnterBackground, so it's in time.
  private var privacyWindow: UIWindow?

  func applicationDidEnterBackground(_ application: UIApplication) {
    let overlay = UIWindow(frame: UIScreen.main.bounds)
    overlay.windowLevel = .alert + 1
    overlay.rootViewController = UIStoryboard(name: "BootSplash", bundle: nil)
      .instantiateInitialViewController()
    overlay.isHidden = false
    privacyWindow = overlay
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
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
