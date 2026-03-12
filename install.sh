#!/bin/bash
# Install BedsideBlink APK on connected device
# Usage: ./install.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADB="${SCRIPT_DIR}/.android-sdk/platform-tools/adb"
APK="${SCRIPT_DIR}/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK" ]; then
  echo "APK not found. Run ./run.sh first."
  exit 1
fi

if [ ! -x "$ADB" ]; then
  echo "adb not found. Run ./run.sh first."
  exit 1
fi

echo "Installing BedsideBlink..."
$ADB install -r "$APK"
echo ""
echo "Launching app..."
$ADB shell am start -n com.bedsideblink/.MainActivity
