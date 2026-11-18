package org.stellar.freighterwallet

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native copy of the Preferences theme choice ("system" | "light" | "dark").
 *
 * JS keeps no other copy: it reads the stored value synchronously at startup
 * (getConstants) and writes here on change. Being native lets MainActivity
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
   * launch's system splash match the pinned theme.
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
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ThemePreference"

  override fun getConstants(): Map<String, Any> =
      mapOf("initialThemePreference" to ThemePreferenceStore.read(reactContext))

  @ReactMethod
  fun setThemePreference(value: String, promise: Promise) {
    if (!ThemePreferenceStore.write(reactContext, value)) {
      promise.reject("E_THEME_PREFERENCE_WRITE", "Failed to save theme preference")
      return
    }
    ThemePreferenceStore.syncSystemSplash(reactContext, value)
    promise.resolve(value)
  }

  @ReactMethod
  fun getSystemColorScheme(promise: Promise) {
    promise.resolve(ThemePreferenceStore.systemColorScheme(reactContext))
  }
}
