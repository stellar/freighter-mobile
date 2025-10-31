#!/usr/bin/env node

/**
 * Google Play requires all new apps and updates targeting Android 15 and higher
 * to support 16 KB page sizes on 64-bit devices, effective November 1, 2025.
 *
 * This requirement is intended to optimize device performance and efficiency,
 * especially as devices incorporate larger amounts of physical memory (RAM).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// This script changes only Android files so it's safe to skip on iOS
const isIOSOnlyEnvironment =
  // CI: Check if we're in iOS workflow (skip for Android workflow)
  !!process.env.APPLE_CONNECT_KEY_ID ||
  // Local: macOS without Android SDK suggests iOS-only development
  (os.platform() === "darwin" &&
    !process.env.ANDROID_HOME &&
    !process.env.ANDROID_SDK_ROOT &&
    !process.env.ANDROID_NDK_HOME);

if (isIOSOnlyEnvironment) {
  console.log(
    "=> Skipping Android 16KB page size alignment setup (iOS-only environment detected)",
  );
  process.exit(0);
}

console.log("Setting up react-native-scrypt for 16KB page size alignment...");

const SCRYPT_DIR = path.join("node_modules", "react-native-scrypt", "android");

// Check if react-native-scrypt is installed
if (!fs.existsSync(SCRYPT_DIR)) {
  console.error(
    'Error: react-native-scrypt not found. Run "yarn install" first.',
  );
  process.exit(1);
}

// 1. Update build.gradle: compile -> implementation
console.log("=> Updating build.gradle...");
const buildGradlePath = path.join(SCRYPT_DIR, "build.gradle");
let buildGradleContent = fs.readFileSync(buildGradlePath, "utf8");
buildGradleContent = buildGradleContent.replace(
  /compile 'com\.facebook\.react:react-native:\+'/g,
  "implementation 'com.facebook.react:react-native:+'",
);
fs.writeFileSync(buildGradlePath, buildGradleContent);

// 2. Add stdlib.h include to libscrypt-jni.c
console.log("=> Updating libscrypt-jni.c...");
const jniCPath = path.join(SCRYPT_DIR, "src", "main", "jni", "libscrypt-jni.c");
let jniContent = fs.readFileSync(jniCPath, "utf8");

// Remove any existing stdlib.h include to avoid duplicates
jniContent = jniContent.replace(/#include <stdlib\.h>\s*\n/g, "");

// Add stdlib.h after string.h
jniContent = jniContent.replace(
  /#include <string\.h>/,
  "#include <string.h>\n#include <stdlib.h>",
);
fs.writeFileSync(jniCPath, jniContent);

// 3. Try to build 16KB-aligned prebuilt libraries
console.log("=> Building 16KB-aligned prebuilt libraries...");
try {
  const buildScript = path.join(__dirname, "build-scrypt-16kb-aligned.js");
  execSync(`node "${buildScript}"`, { stdio: "inherit" });
  console.log("=> 16KB page size alignment setup complete!");
} catch (error) {
  console.error("=> Error during 16KB page size alignment setup.");
  console.error(error.message);
  process.exit(1);
}
