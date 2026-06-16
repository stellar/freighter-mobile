package org.stellar.freighterwallet

// this import is needed for the onCreate override function
import android.os.Bundle;
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.core.content.ContextCompat

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  // Privacy shield: a BootSplash-styled overlay added when the app is
  // backgrounded (onStop, so it does NOT trigger for the biometric prompt /
  // transient pauses) and kept up after return until JS finishes the
  // auto-lock decision and calls PrivacyShield.hide() — so a soft-lock
  // overlay can mount before the wallet is revealed. A fallback removes it if
  // JS never calls. (FLAG_SECURE already blanks the recents thumbnail; this
  // covers the brief on-return flash.)
  private var privacyOverlay: View? = null
  private val privacyHandler = Handler(Looper.getMainLooper())

  companion object {
    private const val PRIVACY_SHIELD_FALLBACK_MS = 1000L
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "freighter-mobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Pass null to super.onCreate to prevent Android from restoring react-native-screens
   * fragments — they intentionally throw on restoration (process death, config change in
   * background) and crash the app on relaunch.
   * https://github.com/software-mansion/react-native-screens/issues/17#issuecomment-424704067
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme)
    // Blank wallet content in the recents/app-switcher thumbnail (also blocks
    // screenshots) when backgrounded
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE,
    )
    super.onCreate(null)
  }

  override fun onStop() {
    showPrivacyShield()
    super.onStop()
  }

  override fun onResume() {
    super.onResume()
    // Fallback: ensure the shield can't get stuck if JS never calls hide()
    privacyHandler.removeCallbacksAndMessages(null)
    privacyHandler.postDelayed({ hidePrivacyShield() }, PRIVACY_SHIELD_FALLBACK_MS)
  }

  fun showPrivacyShield() {
    if (privacyOverlay != null) return
    val decor = window.decorView as? ViewGroup ?: return

    val overlay = FrameLayout(this).apply {
      setBackgroundColor(
        ContextCompat.getColor(this@MainActivity, R.color.bootsplash_background),
      )
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
    }
    val logo = ImageView(this).apply {
      setImageResource(R.drawable.bootsplash_logo)
      layoutParams = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      )
    }
    overlay.addView(logo)
    decor.addView(overlay)
    privacyOverlay = overlay
  }

  fun hidePrivacyShield() {
    privacyHandler.removeCallbacksAndMessages(null)
    val overlay = privacyOverlay ?: return
    (overlay.parent as? ViewGroup)?.removeView(overlay)
    privacyOverlay = null
  }
}