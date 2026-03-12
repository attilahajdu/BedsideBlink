#!/bin/bash
# BedsideBlink: One command to set up and build (no Android Studio)
# Usage: ./run.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== BedsideBlink local build ==="

# 1. JDK 17
JDK_DIR="$SCRIPT_DIR/.jdks"
JDK_HOME=$(find "$JDK_DIR" -name java -path "*/bin/java" 2>/dev/null | head -1 | xargs dirname 2>/dev/null | xargs dirname 2>/dev/null)

if [ -z "$JDK_HOME" ] || [ ! -f "$JDK_HOME/bin/java" ]; then
  echo "[1/4] Downloading JDK 17..."
  mkdir -p "$JDK_DIR"
  curl -sL -o /tmp/jdk17.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse?project=jdk"
  tar -xzf /tmp/jdk17.tar.gz -C "$JDK_DIR"
  rm -f /tmp/jdk17.tar.gz
  JDK_HOME=$(find "$JDK_DIR" -name java -path "*/bin/java" 2>/dev/null | head -1 | xargs dirname | xargs dirname)
fi
export JAVA_HOME="$JDK_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
echo "  JDK: $JAVA_HOME"

# 2. Android SDK
ANDROID_HOME="$SCRIPT_DIR/.android-sdk"
export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "[2/4] Downloading Android command-line tools..."
  curl -sL -o /tmp/cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-mac-14742923_latest.zip"
  unzip -q -o /tmp/cmdline-tools.zip -d /tmp/
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
  rm -rf /tmp/cmdline-tools /tmp/cmdline-tools.zip
fi

if [ ! -d "$ANDROID_HOME/platforms/android-35" ] || [ ! -d "$ANDROID_HOME/build-tools/35.0.0" ]; then
  echo "[3/4] Installing SDK components..."
  if yes | sdkmanager --sdk_root="$ANDROID_HOME" \
    "platform-tools" "platforms;android-35" "build-tools;35.0.0" 2>/dev/null; then
    echo "  SDK components installed."
  else
    echo "  sdkmanager failed. Downloading packages directly..."
    [ ! -d "$ANDROID_HOME/platform-tools" ] && \
      curl -sL "https://dl.google.com/android/repository/platform-tools_r37.0.0-darwin.zip" -o /tmp/pt.zip && \
      unzip -q -o /tmp/pt.zip -d "$ANDROID_HOME" && rm /tmp/pt.zip
    [ ! -d "$ANDROID_HOME/platforms/android-35" ] && \
      curl -sL "https://dl.google.com/android/repository/platform-35_r02.zip" -o /tmp/p35.zip && \
      unzip -q -o /tmp/p35.zip -d "$ANDROID_HOME" && rm /tmp/p35.zip && \
      mkdir -p "$ANDROID_HOME/platforms" && mv "$ANDROID_HOME/android-35" "$ANDROID_HOME/platforms/" 2>/dev/null || true
    [ ! -d "$ANDROID_HOME/build-tools/35.0.0" ] && \
      curl -sL "https://dl.google.com/android/repository/build-tools_r35_macosx.zip" -o /tmp/bt.zip && \
      unzip -q -o /tmp/bt.zip -d /tmp/bt && rm /tmp/bt.zip && \
      mkdir -p "$ANDROID_HOME/build-tools" && mv /tmp/bt/android-15 "$ANDROID_HOME/build-tools/35.0.0" && rm -rf /tmp/bt
    echo "  SDK components installed."
  fi
fi

# 3. Gradle wrapper (ensure correct jar - the bootstrap that downloads Gradle)
WRAPPER_JAR="$SCRIPT_DIR/gradle/wrapper/gradle-wrapper.jar"
mkdir -p "$(dirname "$WRAPPER_JAR")"
echo "Downloading Gradle wrapper..."
curl -sL -o "$WRAPPER_JAR" \
  "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar"

echo "sdk.dir=$ANDROID_HOME" > "$SCRIPT_DIR/local.properties"

# 4. Build
echo ""
echo "Building APK..."
./gradlew assembleDebug

echo ""
echo "=== Done ==="
echo "APK: app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "To install on device (USB debugging on):"
echo "  $ANDROID_HOME/platform-tools/adb install app/build/outputs/apk/debug/app-debug.apk"
echo "  $ANDROID_HOME/platform-tools/adb shell am start -n com.bedsideblink/.MainActivity"
