import Foundation
import React
import UniformTypeIdentifiers

@objc(SecureClipboard)
class SecureClipboard: NSObject, RCTBridgeModule {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  static func moduleName() -> String! {
    return "SecureClipboard"
  }
  
  @objc
  func setString(_ text: String, expirationMs: NSNumber, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let pasteboard = UIPasteboard.general
      let item = [UTType.utf8PlainText.identifier: text]

      // Local only: Universal Clipboard would otherwise copy a recovery
      // phrase to the user's other Apple devices.
      var options: [UIPasteboard.OptionsKey: Any] = [.localOnly: true]

      // Set expiration time using native iOS pasteboard expiration (iOS 15.1+)
      let expirationSeconds = Double(expirationMs.intValue) / 1000.0
      if expirationSeconds > 0, #available(iOS 15.1, *) {
        options[.expirationDate] = Date().addingTimeInterval(expirationSeconds)
      }

      pasteboard.setItems([item], options: options)

      resolver(nil)
    }
  }
  
  @objc
  func getString(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let pasteboard = UIPasteboard.general
      let text = pasteboard.string ?? ""
      resolver(text)
    }
  }
  
  @objc
  func clearString(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      // Empty and local only, so the clear doesn't reach other devices
      // either.
      UIPasteboard.general.setItems([], options: [.localOnly: true])
      resolver(nil)
    }
  }
}
