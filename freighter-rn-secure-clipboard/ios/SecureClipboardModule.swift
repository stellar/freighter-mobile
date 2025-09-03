import Foundation
import React

@objc(SecureClipboardModule)
class SecureClipboardModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func setString(_ text: String, expirationMs: NSNumber, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let pasteboard = UIPasteboard.general
      
      // Always treat data as sensitive for secure clipboard service
      let expirationSeconds = Double(expirationMs.intValue) / 1000.0
      
      // Set expiration time using native iOS pasteboard expiration)
      if expirationSeconds > 0 {
        pasteboard.setItems([[UIPasteboard.type.string: text]], options: [
          UIPasteboard.OptionsKey.expirationDate: Date().addingTimeInterval(expirationSeconds)
        ])
      } else {
        // No expiration, just set the text
        pasteboard.string = text
      }
      
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
      let pasteboard = UIPasteboard.general
      pasteboard.string = ""
      resolver(nil)
    }
  }
}
