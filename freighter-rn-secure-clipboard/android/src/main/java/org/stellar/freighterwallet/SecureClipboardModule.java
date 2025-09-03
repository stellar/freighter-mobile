package org.stellar.freighterwallet;

import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.os.PersistableBundle;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class SecureClipboardModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public SecureClipboardModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "SecureClipboard";
    }

      @ReactMethod
  public void setString(String text, Promise promise) {
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

            clipboard.clearPrimaryClip();
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("CLIPBOARD_ERROR", "Failed to clear clipboard", e);
        }
    }
}
