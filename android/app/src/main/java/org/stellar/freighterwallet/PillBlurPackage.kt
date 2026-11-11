package org.stellar.freighterwallet

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.uimanager.annotations.ReactProp
import eightbitlab.com.blurview.BlurTarget
import eightbitlab.com.blurview.BlurView

/**
 * The floating tab bar's background blur on Android, built on Dimezis
 * BlurView 3. From Android 12 (API 31) it records the content on a RenderNode
 * and blurs it on the render thread, so nothing is redrawn in software. The
 * app only mounts these views from API 31: before that the library falls back
 * to software snapshots, which is what broke screen transitions with the old
 * blur library.
 */
class PillBlurPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext,
  ): List<NativeModule> = emptyList()

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = listOf(PillBlurTargetManager(), PillBlurViewManager())
}

/**
 * Wraps a tab screen's content so a [PillBlurView] can blur it. React Native
 * lays out its children, so the FrameLayout's own layout pass does nothing.
 */
class PillBlurTarget(context: Context) : BlurTarget(context) {
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) = Unit
}

class PillBlurTargetManager : ViewGroupManager<PillBlurTarget>() {
  override fun getName() = "FreighterPillBlurTarget"

  override fun createViewInstance(context: ThemedReactContext) = PillBlurTarget(context)
}

/**
 * Blurs whichever [PillBlurTarget] is on screen. The tab bar sits next to the
 * tab screens, not inside them, and each screen has its own target, so the
 * view looks the visible one up and sets up again when the tab changes.
 */
class PillBlurView(context: Context) : BlurView(context) {
  private var target: PillBlurTarget? = null

  /** The blur's standard deviation in dp, as Figma and CSS give it. */
  var blurRadiusDp = DEFAULT_BLUR_RADIUS_DP
    set(value) {
      field = value
      target?.let { setBlurRadius(radiusPx()) }
    }

  private val onPreDraw = ViewTreeObserver.OnPreDrawListener {
    attachToVisibleTarget()
    true
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(onPreDraw)
    attachToVisibleTarget()
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(onPreDraw)
    target = null
    super.onDetachedFromWindow()
  }

  private fun attachToVisibleTarget() {
    val current = target
    if (current != null && current.isAttachedToWindow && current.isShown) return
    val visible = findVisibleTarget(rootView) ?: return
    if (visible === current) return
    target = visible
    // setupWith swaps in a new controller but leaves the old one's pre-draw
    // listener registered, so each tab switch would add one more to every
    // frame. Turning auto-update off first removes it.
    setBlurAutoUpdate(false)
    // Scale factor 1: on API 31+ RenderEffect scales the snapshot itself, and
    // a full-size one blurs more precisely. No noise: Figma's blur has none.
    setupWith(visible, 1f, false).setBlurRadius(radiusPx())
    setBlurAutoUpdate(true)
    // The view's last drawing still points at the old controller's blur,
    // which setupWith discarded. Nothing else redraws the pill when the tab
    // changes, so without this it shows only its fill until it next does.
    invalidate()
  }

  private fun findVisibleTarget(view: View): PillBlurTarget? {
    if (view is PillBlurTarget) return if (view.isShown) view else null
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findVisibleTarget(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }

  /**
   * RenderEffect takes a blur radius, which Skia turns into a standard
   * deviation of 0.57735 × radius + 0.5. Inverted here, so the blur's standard
   * deviation in pixels is [blurRadiusDp] at the screen's density.
   */
  private fun radiusPx(): Float {
    val sigmaPx = blurRadiusDp * resources.displayMetrics.density
    return ((sigmaPx - 0.5f) / 0.57735f).coerceAtLeast(0f)
  }

  companion object {
    const val DEFAULT_BLUR_RADIUS_DP = 4f
  }
}

class PillBlurViewManager : SimpleViewManager<PillBlurView>() {
  override fun getName() = "FreighterPillBlurView"

  override fun createViewInstance(context: ThemedReactContext) = PillBlurView(context)

  @ReactProp(name = "blurRadius", defaultFloat = PillBlurView.DEFAULT_BLUR_RADIUS_DP)
  fun setBlurRadius(view: PillBlurView, radius: Float) {
    view.blurRadiusDp = radius
  }
}
