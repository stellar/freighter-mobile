package org.stellar.freighterwallet

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.ViewGroup
import android.widget.ImageView
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Native copy of the Preferences theme choice ("system" | "light" | "dark").
 *
 * JS keeps no other copy: it reads the stored value synchronously at startup
 * (getConstants) and writes here on change. Being native lets MainApplication
 * apply a pinned theme before the splash is drawn, which AsyncStorage can't.
 */
object ThemePreferenceStore {
  private const val PREFS_NAME = "theme_preference"
  private const val KEY = "themePreference"
  private val VALUES = setOf("system", "light", "dark")

  fun read(context: Context): String {
    val stored =
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY, null)
    return if (stored in VALUES) stored!! else "system"
  }

  fun write(context: Context, value: String): Boolean =
      context
          .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
          .edit()
          .putString(KEY, value)
          .commit()

  fun appCompatNightMode(value: String): Int =
      when (value) {
        "light" -> AppCompatDelegate.MODE_NIGHT_NO
        "dark" -> AppCompatDelegate.MODE_NIGHT_YES
        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
      }

  /**
   * Android 12+ draws the launch window itself, before the app runs, using the
   * per-app night mode the system stores. Setting it here makes the next
   * launch's system splash match the pinned theme. It also changes the running
   * app's configuration at once, which the app follows while unpinned.
   */
  fun syncSystemSplash(context: Context, value: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    val uiModeManager =
        context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager ?: return
    uiModeManager.setApplicationNightMode(
        when (value) {
          "light" -> UiModeManager.MODE_NIGHT_NO
          "dark" -> UiModeManager.MODE_NIGHT_YES
          else -> UiModeManager.MODE_NIGHT_AUTO
        },
    )
  }

  /**
   * The device's own scheme. Not the app's configuration: that carries the
   * per-app night mode set above, which lags behind an unpin. UiModeManager
   * reports the device setting; a schedule (auto/custom) has no public
   * current-state getter, so those fall back to the system resources.
   */
  fun systemColorScheme(context: Context): String {
    val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
    return when (uiModeManager?.nightMode) {
      UiModeManager.MODE_NIGHT_YES -> "dark"
      UiModeManager.MODE_NIGHT_NO -> "light"
      else -> {
        val nightBits = Resources.getSystem().configuration.uiMode and
            Configuration.UI_MODE_NIGHT_MASK
        if (nightBits == Configuration.UI_MODE_NIGHT_YES) "dark" else "light"
      }
    }
  }
}

class ThemePreferenceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  // A pinned choice's launch-window sync waits for the background: done at once
  // it switches the app before the JS fade has frozen the screen. Unpinning
  // syncs at once, since "system" follows the per-app mode it sets.
  @Volatile private var pendingSplashSync: String? = null

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun onHostResume() {}

  override fun onHostPause() {
    val value = pendingSplashSync ?: return
    pendingSplashSync = null
    ThemePreferenceStore.syncSystemSplash(reactContext, value)
  }

  override fun onHostDestroy() {
    onHostPause()
  }

  override fun getName(): String = "ThemePreference"

  override fun getConstants(): Map<String, Any> =
      mapOf("initialThemePreference" to ThemePreferenceStore.read(reactContext))

  @ReactMethod
  fun setThemePreference(value: String, promise: Promise) {
    if (!ThemePreferenceStore.write(reactContext, value)) {
      promise.reject("E_THEME_PREFERENCE_WRITE", "Failed to save theme preference")
      return
    }
    if (value == "system") {
      pendingSplashSync = null
      ThemePreferenceStore.syncSystemSplash(reactContext, value)
    } else {
      pendingSplashSync = value
    }
    promise.resolve(value)
  }

  @ReactMethod
  fun getSystemColorScheme(promise: Promise) {
    promise.resolve(ThemePreferenceStore.systemColorScheme(reactContext))
  }

  // Cross-fade for a theme change: JS freezes the current frame on top, swaps
  // the theme underneath, then fades the frozen frame out once the new theme
  // has rendered. Only touched on the UI thread.
  private var transitionOverlay: ImageView? = null
  // Snapshots finish asynchronously; only the newest request may attach.
  private var latestTransitionRequest = 0

  @ReactMethod
  fun beginThemeTransition(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    UiThreadUtil.runOnUiThread {
      removeTransitionOverlay()
      latestTransitionRequest += 1
      val request = latestTransitionRequest
      val decor = activity.window.decorView as? ViewGroup
      if (decor == null || decor.width == 0 || decor.height == 0) {
        promise.resolve(false)
        return@runOnUiThread
      }
      val bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
      val attach = attach@{
        if (request != latestTransitionRequest) {
          promise.resolve(false)
          return@attach
        }
        removeTransitionOverlay()
        val overlay = ImageView(activity).apply {
          setImageBitmap(bitmap)
          scaleType = ImageView.ScaleType.FIT_XY
        }
        decor.addView(
            overlay,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        transitionOverlay = overlay
        promise.resolve(true)
      }
      // Drawing the view tree misses hardware-only content (blurs, Skia), so
      // copy the window's pixels where the API exists.
      val drawFallback = {
        try {
          decor.draw(Canvas(bitmap))
          attach()
        } catch (e: Exception) {
          promise.resolve(false)
        }
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          PixelCopy.request(
              activity.window,
              bitmap,
              { result -> if (result == PixelCopy.SUCCESS) attach() else drawFallback() },
              Handler(Looper.getMainLooper()),
          )
        } catch (e: IllegalArgumentException) {
          // The window has no surface (e.g. the app just went to the background).
          promise.resolve(false)
        }
      } else {
        drawFallback()
      }
    }
  }

  @ReactMethod
  fun endThemeTransition(durationMs: Double) {
    UiThreadUtil.runOnUiThread {
      val overlay = transitionOverlay ?: return@runOnUiThread
      transitionOverlay = null
      overlay
          .animate()
          .alpha(0f)
          .setDuration(durationMs.toLong())
          .withEndAction { (overlay.parent as? ViewGroup)?.removeView(overlay) }
          .start()
    }
  }

  private fun removeTransitionOverlay() {
    val overlay = transitionOverlay ?: return
    transitionOverlay = null
    (overlay.parent as? ViewGroup)?.removeView(overlay)
  }
}
