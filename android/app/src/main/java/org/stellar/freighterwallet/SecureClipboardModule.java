package org.stellar.freighterwallet;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PersistableBundle;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class SecureClipboardModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private final Handler mainHandler;

    public SecureClipboardModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    @Override
    public String getName() {
        return "SecureClipboard";
    }

      @ReactMethod
  public void setString(String text, int expirationMs, Promise promise) {
    try {
      Context context = reactContext.getApplicationContext();
      ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
      
      if (clipboard == null) {
        promise.reject("CLIPBOARD_ERROR", "Clipboard service not available");
        return;
      }

      ClipData clip = ClipData.newPlainText("SecureClipboard", text);
      
      // Add sensitive flag for secure clipboard service (Android 13+)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        PersistableBundle extras = new PersistableBundle();
        extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true);
        clip.getDescription().setExtras(extras);
      }
      
      // Schedule clipboard clearing if expiration is specified
      if (expirationMs > 0) {
        final String textToClear = text;
        final Context appContext = context;
        mainHandler.postDelayed(() -> {
          try {
            ClipboardManager delayedClipboard = (ClipboardManager) appContext.getSystemService(Context.CLIPBOARD_SERVICE);
            if (delayedClipboard != null) {
              // Only clear if the clipboard still contains our original text
              ClipData currentClip = delayedClipboard.getPrimaryClip();
              if (currentClip != null && currentClip.getItemCount() > 0) {
                String currentText = currentClip.getItemAt(0).getText().toString();
                if (textToClear.equals(currentText)) {
                  delayedClipboard.clearPrimaryClip();
                }
              }
            }
          } catch (Exception e) {
            // Silently handle expiration clear errors
          }
        }, expirationMs);
      }
      
      clipboard.setPrimaryClip(clip);
      promise.resolve(null);
    } catch (Exception e) {
      promise.reject("CLIPBOARD_ERROR", "Failed to set clipboard content", e);
    }
  }

    @ReactMethod
    public void getString(Promise promise) {
        try {
            Context context = reactContext.getApplicationContext();
            ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            
            if (clipboard == null) {
                promise.reject("CLIPBOARD_ERROR", "Clipboard service not available");
                return;
            }

            ClipData clip = clipboard.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0) {
                String text = clip.getItemAt(0).getText().toString();
                promise.resolve(text);
            } else {
                promise.resolve("");
            }
        } catch (Exception e) {
            promise.reject("CLIPBOARD_ERROR", "Failed to get clipboard content", e);
        }
    }

    @ReactMethod
    public void clearString(Promise promise) {
        try {
            Context context = reactContext.getApplicationContext();
            ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            
            if (clipboard == null) {
                promise.reject("CLIPBOARD_ERROR", "Clipboard service not available");
                return;
            }

            // Clear the clipboard
            clipboard.clearPrimaryClip();
            
            // Verify the clipboard was cleared
            ClipData currentClip = clipboard.getPrimaryClip();
            if (currentClip == null || currentClip.getItemCount() == 0) {
                promise.resolve(null);
            } else {
                // If still has content, try to set empty string as fallback
                ClipData emptyClip = ClipData.newPlainText("", "");
                clipboard.setPrimaryClip(emptyClip);
                promise.resolve(null);
            }
        } catch (Exception e) {
            promise.reject("CLIPBOARD_ERROR", "Failed to clear clipboard", e);
        }
    }
}
