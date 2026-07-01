import Foundation
import React

// PrivacyShield native module — lets JS dismiss the iOS privacy shield once
// the auto-lock decision has finished, so a soft-lock overlay can mount
// before the wallet is revealed on return from the background.
//
// Packaged as a local pod (separate compilation module), so it can't
// reference the app target's AppDelegate directly. It decouples via
// NotificationCenter: AppDelegate owns the shield window (it's alive from
// launch and shows the shield reliably on every background) and observes this
// notification to dismiss it.
@objc(PrivacyShield)
class PrivacyShield: NSObject {

  // Must match the name AppDelegate observes.
  static let hideNotificationName = Notification.Name("FreighterPrivacyShieldHide")

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func hide(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    NotificationCenter.default.post(
      name: PrivacyShield.hideNotificationName,
      object: nil
    )
    resolver(nil)
  }
}
