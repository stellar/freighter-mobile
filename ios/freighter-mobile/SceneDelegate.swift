import UIKit
import React
import React_RCTAppDelegate

// Apps built with the iOS 27 SDK must use the UIKit scene life cycle, or UIKit
// stops them at launch ("UIScene life cycle is required for apps built with
// this SDK"). So the window, incoming URLs and the background/foreground
// callbacks come through here instead of through AppDelegate.
//
// React Native 0.81 has no scene entry points, so this feeds the app-delegate
// ones it does have, the way React Native 0.88+ does internally. After that
// upgrade, startReactNative(withModuleName:in:connectionOptions:) and
// RCTLinkingManager.scene(_:openURLContexts:) replace launchOptions(from:) and
// the body of scene(_:openURLContexts:).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = appDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    // A fresh UIWindow has a nil background, which renders black. That black
    // shows for a frame when RNBootSplash removes the splash view before React
    // has painted, giving a flash between the native splash and the JS one.
    // systemBackground is white in light and black in dark, matching the page
    // colour both the splash and the app paint, so any such gap is invisible
    // in either scheme.
    window.backgroundColor = .systemBackground
    self.window = window
    appDelegate.window = window

    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "freighter-mobile",
      in: window,
      launchOptions: Self.launchOptions(from: connectionOptions)
    )
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    // Let the window, and the React root in it, go with the scene. If UIKit
    // reconnects it, scene(_:willConnectTo:options:) starts a new one.
    if appDelegate?.window === window {
      appDelegate?.window = nil
    }
    window = nil
  }

  // A URL opened while the app is running or suspended. A cold launch's URL
  // comes in the connection options instead (see launchOptions(from:)).
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  // Privacy shield, owned by AppDelegate. didEnterBackground, not
  // willResignActive, so Face ID prompts and Control Center don't raise it.
  func sceneDidEnterBackground(_ scene: UIScene) {
    guard let windowScene = scene as? UIWindowScene else { return }
    appDelegate?.showPrivacyShield(in: windowScene)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.schedulePrivacyShieldFallbackHide()
  }

  // Linking.getInitialURL() reads a cold launch's URL from the launch options,
  // but UIKit gives a scene-based app that URL in the scene's connection
  // options. Rebuild the launch-option keys getInitialURL reads.
  private static func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any] {
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }
    return launchOptions
  }
}
