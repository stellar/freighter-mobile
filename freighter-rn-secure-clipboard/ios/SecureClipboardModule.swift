import Foundation
import React

@objc(SecureClipboardModule)
class SecureClipboardModule: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func setString(_ text: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let pasteboard = UIPasteboard.general
      
      // Always treat data as sensitive for secure clipboard service
      // 1. Set a shorter expiration time (iOS 10+)
      if #available(iOS 10.0, *) {
        pasteboard.setItems([[UIPasteboard.type.string: text]], options: [
          UIPasteboard.OptionsKey.expirationDate: Date().addingTimeInterval(30) // 30 seconds
        ])
      } else {
        // Fallback for older iOS versions
        pasteboard.string = text
      }
      
      // 2. Clear clipboard after a short delay for additional security
      DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
        pasteboard.string = ""
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
