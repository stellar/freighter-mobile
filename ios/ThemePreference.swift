import Foundation
import React
import UIKit

// Native copy of the Preferences theme choice ("system" | "light" | "dark").
//
// JS keeps no other copy: it reads the stored value synchronously at startup
// (constantsToExport) and writes here on change. Being native lets
// SceneDelegate pin the window's style before the splash overlay is drawn,
// which AsyncStorage can't. The local pod can't reference the app target, so
// SceneDelegate reads the same UserDefaults key itself.
@objc(ThemePreference)
class ThemePreference: NSObject {

  // Must match the key SceneDelegate reads.
  static let defaultsKey = "themePreference"
  static let values: Set<String> = ["system", "light", "dark"]

  static func stored() -> String {
    let value = UserDefaults.standard.string(forKey: defaultsKey) ?? "system"
    return values.contains(value) ? value : "system"
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func constantsToExport() -> [AnyHashable: Any]! {
    return ["initialThemePreference": ThemePreference.stored()]
  }

  @objc
  func setThemePreference(
    _ value: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    guard ThemePreference.values.contains(value) else {
      rejecter("E_THEME_PREFERENCE_INVALID", "Unknown theme preference", nil)
      return
    }
    UserDefaults.standard.set(value, forKey: ThemePreference.defaultsKey)
    resolver(value)
  }

  // The device's own scheme. The scene's traits ignore the window override
  // that a pinned theme sets, so this stays correct while light or dark is
  // pinned or just being unpinned.
  @objc
  func getSystemColorScheme(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let scene = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .first
      let style = scene?.traitCollection.userInterfaceStyle
        ?? UIScreen.main.traitCollection.userInterfaceStyle
      resolver(style == .dark ? "dark" : "light")
    }
  }

  // Cross-fade for a theme change: JS freezes the current frame on top, swaps
  // the theme underneath, then fades the frozen frame out once the new theme
  // has rendered. Main-queue only.
  private var transitionSnapshot: UIView?

  @objc
  func beginThemeTransition(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.transitionSnapshot?.removeFromSuperview()
      self.transitionSnapshot = nil
      let window = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }
      guard let window, let snapshot = window.snapshotView(afterScreenUpdates: false) else {
        resolver(false)
        return
      }
      snapshot.frame = window.bounds
      snapshot.isUserInteractionEnabled = false
      window.addSubview(snapshot)
      self.transitionSnapshot = snapshot
      resolver(true)
    }
  }

  @objc
  func endThemeTransition(_ durationMs: NSNumber) {
    DispatchQueue.main.async {
      guard let snapshot = self.transitionSnapshot else { return }
      self.transitionSnapshot = nil
      UIView.animate(
        withDuration: durationMs.doubleValue / 1000,
        delay: 0,
        options: [.curveEaseInOut, .beginFromCurrentState],
        animations: { snapshot.alpha = 0 },
        completion: { _ in snapshot.removeFromSuperview() }
      )
    }
  }
}
