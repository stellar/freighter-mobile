#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

/**
 * Main build function that orchestrates the parallel build process
 */
async function main() {
  console.log("Building 16KB-aligned libscrypt_jni.so libraries...");

  const SCRYPT_DIR = path.join("node_modules", "react-native-scrypt");
  const LIBS_DIR = path.join(SCRYPT_DIR, "android", "src", "main", "libs");

  // Create libs directory
  fs.mkdirSync(LIBS_DIR, { recursive: true });

  // Get Android NDK path
  let ndkPath =
    process.env.ANDROID_NDK_HOME ||
    process.env.ANDROID_NDK_ROOT ||
    process.env.NDK_ROOT;

  if (!ndkPath) {
    // Try common NDK installation paths
    const commonPaths = [
      path.join(os.homedir(), "Library", "Android", "sdk", "ndk"), // macOS
      path.join(os.homedir(), "Android", "Sdk", "ndk"), // Linux
      path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "ndk"), // Windows
      "/usr/local/android-ndk", // Linux
      "/opt/android-ndk", // Linux
      path.join(process.env.ANDROID_HOME || "", "ndk"), // Android SDK
      "/usr/lib/android-sdk/ndk", // Linux
    ];

    for (const testPath of commonPaths) {
      if (testPath && fs.existsSync(testPath)) {
        ndkPath = testPath;
        break;
      }
    }

    if (!ndkPath) {
      if (process.env.CI || process.env.GITHUB_ACTIONS) {
        console.log(
          "⚠️  Android NDK not found, but running in CI environment.",
        );
        console.log(
          "⚠️  Skipping 16KB alignment build - using original libraries.",
        );
        console.log(
          "⚠️  This is expected in CI environments that don't build Android apps.",
        );
        process.exit(0);
      } else {
        console.error("Error: Android NDK not found in common locations:");
        commonPaths.forEach((p) => console.error(`  ${p}`));
        console.error("");
        console.error("Please set one of these environment variables:");
        console.error("  ANDROID_NDK_HOME");
        console.error("  ANDROID_NDK_ROOT");
        console.error("  NDK_ROOT");
        console.error("");
        console.error(
          "Or install Android NDK in one of the common locations above.",
        );
        process.exit(1);
      }
    }
  }

  console.log(`Using Android NDK: ${ndkPath}`);

  if (!fs.existsSync(ndkPath)) {
    console.error(`Error: NDK directory not found: ${ndkPath}`);
    process.exit(1);
  }

  // Find the latest NDK version
  const ndkVersions = fs
    .readdirSync(ndkPath)
    .filter((name) => /^\d+\.\d+\.\d+/.test(name))
    .sort((a, b) => {
      const aParts = a.split(".").map(Number);
      const bParts = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) {
          return aParts[i] - bParts[i];
        }
      }
      return 0;
    });

  if (ndkVersions.length === 0) {
    console.error(`Error: No NDK version found in ${ndkPath}`);
    process.exit(1);
  }

  const ndkVersion = ndkVersions[ndkVersions.length - 1];
  console.log(`Using NDK version: ${ndkVersion}`);

  // Detect platform for NDK toolchain path
  const platform = os.platform();
  let toolchainPath;
  if (platform === "darwin") {
    toolchainPath = path.join(
      ndkPath,
      ndkVersion,
      "toolchains",
      "llvm",
      "prebuilt",
      "darwin-x86_64",
    );
  } else if (platform === "win32") {
    toolchainPath = path.join(
      ndkPath,
      ndkVersion,
      "toolchains",
      "llvm",
      "prebuilt",
      "windows-x86_64",
    );
  } else {
    toolchainPath = path.join(
      ndkPath,
      ndkVersion,
      "toolchains",
      "llvm",
      "prebuilt",
      "linux-x86_64",
    );
  }

  if (!fs.existsSync(toolchainPath)) {
    console.error(`Error: NDK toolchain not found: ${toolchainPath}`);
    process.exit(1);
  }

  // Source directories
  const srcDir = path.join(SCRYPT_DIR, "android", "src", "main", "jni");
  const libscryptSrc = path.join(SCRYPT_DIR, "libscrypt");

  console.log(`Source directory: ${srcDir}`);
  console.log(`Libscrypt source: ${libscryptSrc}`);

  /**
   * Builds the scrypt library for a specific architecture
   * @param {Object} arch - Architecture configuration
   * @param {string} arch.name - Architecture name (e.g., "arm64-v8a")
   * @param {string} arch.prefix - Toolchain prefix (e.g., "aarch64-linux-android")
   * @param {string} arch.api - API level (e.g., "21")
   * @param {string} toolchainPath - Path to NDK toolchain
   * @param {string} srcDir - Source directory path
   * @param {string} libscryptSrc - Libscrypt source directory path
   * @param {string} LIBS_DIR - Output libraries directory
   * @returns {Promise<void>}
   */
  async function buildArch(
    arch,
    toolchainPath,
    srcDir,
    libscryptSrc,
    LIBS_DIR,
  ) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Building for ${arch.name}...`);

        const cc = path.join(
          toolchainPath,
          "bin",
          `${arch.prefix}${arch.api}-clang`,
        );
        const ar = path.join(toolchainPath, "bin", "llvm-ar");

        if (!fs.existsSync(cc)) {
          throw new Error(`Compiler not found: ${cc}`);
        }

        // Create output directory
        const outputDir = path.join(LIBS_DIR, arch.name);
        fs.mkdirSync(outputDir, { recursive: true });

        // Change to output directory for compilation
        const originalCwd = process.cwd();
        process.chdir(outputDir);

        try {
          // Build static library first
          console.log(`  [${arch.name}] Building static library...`);

          const sourceFiles = [
            "b64.c",
            "crypto_scrypt-hexconvert.c",
            "sha256.c",
            "crypto-mcf.c",
            "crypto_scrypt-nosse.c",
            "slowequals.c",
            "crypto_scrypt-check.c",
            "crypto-scrypt-saltgen.c",
            "crypto_scrypt-hash.c",
            "main.c",
          ];

          // Compile each source file
          for (const sourceFile of sourceFiles) {
            const sourcePath = path.resolve(
              originalCwd,
              libscryptSrc,
              sourceFile,
            );
            const objectFile = sourceFile.replace(".c", ".o");
            execSync(
              `${cc} -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"${path.resolve(originalCwd, libscryptSrc)}" "${sourcePath}" -o "${objectFile}"`,
            );
          }

          // Create static library
          execSync(`${ar} rcs libscrypt.a *.o`);

          // Build shared library with 16KB alignment
          console.log(
            `  [${arch.name}] Building shared library with 16KB alignment...`,
          );
          const jniFile = path.resolve(originalCwd, srcDir, "libscrypt-jni.c");
          execSync(
            `${cc} -shared -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"${path.resolve(originalCwd, libscryptSrc)}" -L. -lscrypt "${jniFile}" -llog -Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384 -o libscrypt_jni.so`,
          );

          // Clean up object files (cross-platform)
          try {
            const files = fs.readdirSync(".");
            for (const file of files) {
              if (file.endsWith(".o")) {
                fs.unlinkSync(file);
              }
            }
          } catch (error) {
            // Ignore cleanup errors
          }

          console.log(
            `  [${arch.name}] ✅ Built: ${path.join(outputDir, "libscrypt_jni.so")}`,
          );
          resolve();
        } finally {
          // Always return to original directory
          process.chdir(originalCwd);
        }
      } catch (error) {
        reject(new Error(`Failed to build ${arch.name}: ${error.message}`));
      }
    });
  }

  // Build for each architecture
  const architectures = [
    { name: "arm64-v8a", prefix: "aarch64-linux-android", api: "21" },
    { name: "armeabi-v7a", prefix: "armv7a-linux-androideabi", api: "21" },
    { name: "x86", prefix: "i686-linux-android", api: "21" },
    { name: "x86_64", prefix: "x86_64-linux-android", api: "21" },
  ];

  // Build all architectures in parallel
  console.log(`Building ${architectures.length} architectures in parallel...`);
  const buildPromises = architectures.map((arch) =>
    buildArch(arch, toolchainPath, srcDir, libscryptSrc, LIBS_DIR),
  );

  try {
    await Promise.all(buildPromises);
    console.log("✅ All architectures built successfully!");
  } catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
  }

  console.log(
    "✅ Successfully built 16KB-aligned libscrypt_jni.so libraries for all architectures!",
  );
  console.log(`Libraries are now available in: ${LIBS_DIR}`);
}

// Execute the main function and handle errors
main().catch((error) => {
  console.error("❌ Build script failed:", error.message);
  process.exit(1);
});
