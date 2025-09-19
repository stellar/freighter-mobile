#!/usr/bin/env bash

set -e

echo "Building 16KB-aligned libscrypt_jni.so libraries..."

SCRYPT_DIR="node_modules/react-native-scrypt"
LIBS_DIR="$SCRYPT_DIR/android/src/main/libs"

# Create libs directory
mkdir -p "$LIBS_DIR"

# Get Android NDK path - try multiple common locations
if [ -z "$ANDROID_NDK_HOME" ]; then
    if [ -z "$ANDROID_NDK_ROOT" ]; then
        if [ -z "$NDK_ROOT" ]; then
            # Try common NDK installation paths
            COMMON_NDK_PATHS=(
                "$HOME/Library/Android/sdk/ndk"
                "$HOME/Android/Sdk/ndk"
                "/usr/local/android-ndk"
                "/opt/android-ndk"
            )
            
            NDK_PATH=""
            for path in "${COMMON_NDK_PATHS[@]}"; do
                if [ -d "$path" ]; then
                    NDK_PATH="$path"
                    break
                fi
            done
            
            if [ -z "$NDK_PATH" ]; then
                echo "Error: Android NDK not found in common locations:"
                printf '  %s\n' "${COMMON_NDK_PATHS[@]}"
                echo ""
                echo "Please set one of these environment variables:"
                echo "  ANDROID_NDK_HOME"
                echo "  ANDROID_NDK_ROOT" 
                echo "  NDK_ROOT"
                echo ""
                echo "Or install Android NDK in one of the common locations above."
                exit 1
            fi
        else
            NDK_PATH="$NDK_ROOT"
        fi
    else
        NDK_PATH="$ANDROID_NDK_ROOT"
    fi
else
    NDK_PATH="$ANDROID_NDK_HOME"
fi

echo "Using Android NDK: $NDK_PATH"

# Check if NDK exists
if [ ! -d "$NDK_PATH" ]; then
    echo "Error: NDK directory not found: $NDK_PATH"
    exit 1
fi

# Find the latest NDK version
NDK_VERSION=$(ls "$NDK_PATH" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | sort -V | tail -1)
if [ -z "$NDK_VERSION" ]; then
    echo "Error: No NDK version found in $NDK_PATH"
    exit 1
fi

echo "Using NDK version: $NDK_VERSION"

NDK_TOOLCHAIN="$NDK_PATH/$NDK_VERSION/toolchains/llvm/prebuilt/darwin-x86_64"
if [ ! -d "$NDK_TOOLCHAIN" ]; then
    echo "Error: NDK toolchain not found: $NDK_TOOLCHAIN"
    exit 1
fi

# Source directory
SRC_DIR="$SCRYPT_DIR/android/src/main/jni"
LIBSCRYPT_SRC="$SCRYPT_DIR/libscrypt"

echo "Source directory: $SRC_DIR"
echo "Libscrypt source: $LIBSCRYPT_SRC"

# Build for each architecture
for ARCH in arm64-v8a armeabi-v7a x86 x86_64; do
    echo "Building for $ARCH..."
    
    case $ARCH in
        arm64-v8a)
            TOOLCHAIN_PREFIX="aarch64-linux-android"
            API_LEVEL="21"
            ;;
        armeabi-v7a)
            TOOLCHAIN_PREFIX="armv7a-linux-androideabi"
            API_LEVEL="21"
            ;;
        x86)
            TOOLCHAIN_PREFIX="i686-linux-android"
            API_LEVEL="21"
            ;;
        x86_64)
            TOOLCHAIN_PREFIX="x86_64-linux-android"
            API_LEVEL="21"
            ;;
    esac
    
    # Set up compiler paths
    CC="$NDK_TOOLCHAIN/bin/${TOOLCHAIN_PREFIX}${API_LEVEL}-clang"
    CXX="$NDK_TOOLCHAIN/bin/${TOOLCHAIN_PREFIX}${API_LEVEL}-clang++"
    
    if [ ! -f "$CC" ]; then
        echo "Error: Compiler not found: $CC"
        exit 1
    fi
    
    # Create output directory
    OUTPUT_DIR="$LIBS_DIR/$ARCH"
    mkdir -p "$OUTPUT_DIR"
    
    # Build static library first
    echo "  Building static library..."
    # Compile each source file individually
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/b64.c" -o b64.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto_scrypt-hexconvert.c" -o crypto_scrypt-hexconvert.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/sha256.c" -o sha256.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto-mcf.c" -o crypto-mcf.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto_scrypt-nosse.c" -o crypto_scrypt-nosse.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/slowequals.c" -o slowequals.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto_scrypt-check.c" -o crypto_scrypt-check.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto-scrypt-saltgen.c" -o crypto-scrypt-saltgen.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/crypto_scrypt-hash.c" -o crypto_scrypt-hash.o
    $CC -c -fPIC -std=c99 -D_FORTIFY_SOURCE=2 -I"$LIBSCRYPT_SRC" "$LIBSCRYPT_SRC/main.c" -o main.o
    
    # Create static library
    $NDK_TOOLCHAIN/bin/llvm-ar rcs libscrypt.a *.o
    
    # Build shared library with 16KB alignment
    echo "  Building shared library with 16KB alignment..."
    $CC -shared -fPIC -std=c99 -D_FORTIFY_SOURCE=2 \
        -I"$LIBSCRYPT_SRC" \
        -L. -lscrypt \
        "$SRC_DIR/libscrypt-jni.c" \
        -llog \
        -Wl,-z,max-page-size=16384 \
        -Wl,-z,common-page-size=16384 \
        -o "$OUTPUT_DIR/libscrypt_jni.so"
    
    # Clean up
    rm -f libscrypt.a *.o
    
    echo "  Built: $OUTPUT_DIR/libscrypt_jni.so"
done

echo "✅ Successfully built 16KB-aligned libscrypt_jni.so libraries for all architectures!"
echo "Libraries are now available in: $LIBS_DIR"
