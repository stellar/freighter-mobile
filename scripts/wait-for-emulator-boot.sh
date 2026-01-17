#!/bin/sh
# Script to wait for Android emulator to boot completely
# Exit on error, undefined vars
set -eu

# Wait for emulator to be online before continuing
adb wait-for-device

# Wait till boot completed flag is set (timeout after 10 mins)
boot_completed=""
timeout=600
while [ "$timeout" -gt 0 ]; do
  boot_completed=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$boot_completed" = "1" ]; then
    break
  fi
  sleep 2
  timeout=$((timeout - 2))
done

if [ "$boot_completed" != "1" ]; then
  echo "Emulator failed to boot in 10 minutes."
  exit 1
fi

# Wait for ADB to show device as "device" (not "offline")
echo "Waiting for ADB to recognize device as online..."
timeout=300  # 5 minutes
while [ $timeout -gt 0 ]; do
  if adb devices | grep -q "device$"; then
    echo "✅ ADB device connection verified"
    break
  fi
  sleep 5
  timeout=$((timeout - 5))
done

if [ $timeout -eq 0 ]; then
  echo "⚠️  Warning: ADB did not show device as online within 5 minutes"
  echo "ADB devices output:"
  adb devices
  # Don't exit - continue anyway as boot_completed is set
fi

echo "✅ Emulator is online and ready"
