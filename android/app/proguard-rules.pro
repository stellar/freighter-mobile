# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

#########################
# OPTIMIZATION SETTINGS #
#########################

# Enable aggressive optimization
-optimizationpasses 5
-dontpreverify
-verbose

# Optimize method invocation
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*

# Allow obfuscation of class names
-repackageclasses ''
-allowaccessmodification

#########################
# REACT NATIVE CORE     #
#########################

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep ReactNativeHost
-keep class com.freightermobile.MainApplication { *; }

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Keep Hermes (JavaScript engine)
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

#########################
# REACT NATIVE LIBRARIES#
#########################

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Safe Area Context
-keep class com.th3rdwave.safeareacontext.** { *; }

# React Native SVG
-keep class com.horcrux.svg.** { *; }

# Shopify React Native Skia (already present, keeping for reference)
-keep class com.shopify.reactnative.skia.** { *; }

# React Native Vision Camera
-keep class com.mrousavy.camera.** { *; }

# React Native Keychain
-keep class com.oblador.keychain.** { *; }

# React Native Device Info
-keep class com.learnium.RNDeviceInfo.** { *; }

# React Native Biometrics
-keep class com.rnbiometrics.** { *; }

# React Native Config
-keep class com.lugg.ReactNativeConfig.** { *; }

# React Native Blur
-keep class com.cmcewen.blurview.** { *; }

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }

# React Native Async Storage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# React Native NetInfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# React Native Clipboard
-keep class com.reactnativecommunity.clipboard.** { *; }

# React Native BootSplash
-keep class com.zoontek.rnbootsplash.** { *; }

# React Native Localize
-keep class com.zoontek.rnlocalize.** { *; }

# React Native Permissions
-keep class com.zoontek.rnpermissions.** { *; }

# React Native Camera Roll
-keep class com.reactnativecommunity.cameraroll.** { *; }

# React Native Fast OpenCV
-keep class com.reactnativefastopencv.** { *; }

# React Native Worklets
-keep class com.swmansion.worklets.** { *; }

# React Native Menu
-keep class com.reactnativemenu.** { *; }

# React Native Context Menu
-keep class com.reactnativeioscontextmenu.** { *; }

# React Native Utilities
-keep class com.reactnativeiosutilities.** { *; }

# Jail Monkey (jailbreak detection)
-keep class com.gantix.JailMonkey.** { *; }

# React Native InAppBrowser
-keep class com.proyecto26.inappbrowser.** { *; }

# React Native Scrypt
-keep class com.reactlibrary.** { *; }

#########################
# SENTRY (Crash Reporting)
#########################

# Keep Sentry classes for crash reporting
-keep class io.sentry.** { *; }
-keep class io.sentry.react.** { *; }

# Don't obfuscate Sentry to ensure proper crash reporting
-keepnames class io.sentry.** { *; }

#########################
# STELLAR / CRYPTO      #
#########################

# Keep crypto classes (important for wallet security)
-keep class org.stellar.** { *; }
-keep class org.bouncycastle.** { *; }

# Keep SecureRandom for cryptographic operations
-keep class java.security.SecureRandom { *; }
-keep class javax.crypto.** { *; }

#########################
# THIRD-PARTY LIBRARIES #
#########################

# OkHttp
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson (if used for JSON serialization)
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Fresco (image loading)
-keep class com.facebook.fresco.** { *; }
-keep class com.facebook.imagepipeline.** { *; }

# WalletConnect
-keep class com.walletconnect.** { *; }

# Amplitude Analytics
-keep class com.amplitude.** { *; }

#########################
# SERIALIZATION         #
#########################

# Keep model classes from being obfuscated (if using Gson/JSON)
# -keep class com.freightermobile.models.** { *; }

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

#########################
# GENERAL ANDROID       #
#########################

# Keep Android Support Library classes
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# Keep Google Play Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Keep source file names and line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable

# Rename source file attribute to hide original file name
-renamesourcefileattribute SourceFile

#########################
# WARNINGS SUPPRESSION  #
#########################

# Suppress warnings for missing classes (usually harmless)
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**