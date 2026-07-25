package org.stellar.freighterwallet

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.reactnativecommunity.webview.RNCWebChromeClient

/**
 * Bridges the in-app browser's per-origin camera/microphone consent so JS can
 * clear it as part of the logout / data-wipe scrub, keeping it in sync with the
 * rest of the WebView data cleanup. Android-only (iOS WKWebView prompts
 * per-origin on its own, so there is no equivalent state to clear there).
 */
class WebViewMediaConsentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WebViewMediaConsent"

  @ReactMethod
  fun clearConsent(promise: Promise) {
    RNCWebChromeClient.clearMediaCaptureConsent()
    promise.resolve(null)
  }
}
