#!/usr/bin/env bash

set -e

echo "Setting up react-native-scrypt for 16KB page size alignment..."

SCRYPT_DIR="node_modules/react-native-scrypt/android"

# Check if react-native-scrypt is installed
if [ ! -d "$SCRYPT_DIR" ]; then
    echo "Error: react-native-scrypt not found. Run 'yarn install' first."
    exit 1
fi

# 1. Update build.gradle: compile -> implementation
echo "=> Updating build.gradle..."
sed -i '' 's/compile '\''com.facebook.react:react-native:+'\''/implementation '\''com.facebook.react:react-native:+'\''/g' "$SCRYPT_DIR/build.gradle"

# 2. Add stdlib.h include to libscrypt-jni.c
echo "=> Updating libscrypt-jni.c..."
# First remove any existing stdlib.h include to avoid duplicates
sed -i '' '/#include <stdlib.h>/d' "$SCRYPT_DIR/src/main/jni/libscrypt-jni.c"
# Then add it after string.h
sed -i '' 's|#include <string.h>|#include <string.h>\
#include <stdlib.h>|' "$SCRYPT_DIR/src/main/jni/libscrypt-jni.c"

# 3. Build 16KB-aligned prebuilt libraries
echo "=> Building 16KB-aligned prebuilt libraries..."
./scripts/build-scrypt-16kb-aligned.sh

echo "=> 16KB page size alignment setup complete!"