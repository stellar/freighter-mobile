package org.stellar.freighterwallet

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Lets JS dismiss the Android privacy shield (managed by MainActivity) once
 * the auto-lock decision has finished, so a soft-lock overlay can mount before
 * the wallet is revealed on return from the background.
 */
class PrivacyShieldModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PrivacyShield"

  @ReactMethod
  fun hide(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity is MainActivity) {
      activity.runOnUiThread { activity.hidePrivacyShield() }
    }
    promise.resolve(null)
  }
}
