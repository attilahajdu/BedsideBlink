#!/bin/bash
# Build BedsideBlink APK (no Android Studio needed)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Use project JDK + Android SDK
JDK_HOME=$(find "$SCRIPT_DIR/.jdks" -name java -path "*/bin/java" 2>/dev/null | head -1 | xargs dirname 2>/dev/null | xargs dirname 2>/dev/null)
export JAVA_HOME="${JAVA_HOME:-$JDK_HOME}"
export ANDROID_HOME="${ANDROID_HOME:-$SCRIPT_DIR/.android-sdk}"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/platform-tools:$PATH"

if [ -z "$JAVA_HOME" ] || [ ! -f "$JAVA_HOME/bin/java" ]; then
  echo "JDK not found. Run ./setup-android-build.sh first."
  exit 1
fi

if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
  echo "Android SDK components not installed. Run ./setup-android-build.sh first."
  exit 1
fi

echo "Building..."
./gradlew assembleDebug

echo ""
echo "APK: app/build/outputs/apk/debug/app-debug.apk"
echo "Install: adb install app/build/outputs/apk/debug/app-debug.apk"
