#!/bin/bash
# BedsideBlink: Set up JDK 17 + Android SDK for command-line build (no Android Studio)
# Run this script in your terminal: ./setup-android-build.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 1. JDK 17 (portable, in project .jdks/)
JDK_DIR="$SCRIPT_DIR/.jdks"
# On macOS, Adoptium extracts as jdk-17.x.x+xx with Contents/Home
JDK_HOME=$(find "$JDK_DIR" -name java -path "*/bin/java" 2>/dev/null | head -1 | xargs dirname | xargs dirname)

if [ -z "$JDK_HOME" ] || [ ! -f "$JDK_HOME/bin/java" ]; then
  echo "Downloading JDK 17 (macOS aarch64)..."
  mkdir -p "$JDK_DIR"
  curl -sL -o /tmp/jdk17.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse?project=jdk"
  tar -xzf /tmp/jdk17.tar.gz -C "$JDK_DIR"
  rm /tmp/jdk17.tar.gz
  JDK_HOME=$(find "$JDK_DIR" -name java -path "*/bin/java" 2>/dev/null | head -1 | xargs dirname | xargs dirname)
  echo "JDK 17 installed at $JDK_HOME"
fi

export JAVA_HOME="$JDK_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

# 2. Android SDK (in project .android-sdk)
ANDROID_HOME="$SCRIPT_DIR/.android-sdk"

if [ ! -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "Downloading Android command-line tools..."
  curl -sL -o /tmp/cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-mac-14742923_latest.zip"
  unzip -q -o /tmp/cmdline-tools.zip -d /tmp/
  mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
  rm -rf /tmp/cmdline-tools /tmp/cmdline-tools.zip
  echo "Android SDK tools installed"
fi

export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# 3. Install SDK components (skip if already present)
if [ ! -d "$ANDROID_HOME/platforms/android-35" ] || [ ! -d "$ANDROID_HOME/build-tools/35.0.0" ]; then
  echo "Installing Android SDK components (platform-tools, android-35, build-tools)..."
  if yes | sdkmanager --sdk_root="$ANDROID_HOME" \
    "platform-tools" \
    "platforms;android-35" \
    "build-tools;35.0.0" 2>/dev/null; then
    echo "SDK components installed."
  else
    echo ""
    echo "WARNING: sdkmanager failed. If components are missing, run in your terminal:"
    echo "  cd $SCRIPT_DIR && ./setup-android-build.sh"
  fi
else
  echo "Android SDK components already installed."
fi

# 4. Gradle wrapper JAR
echo "Downloading Gradle wrapper jar..."
curl -sL -o "$SCRIPT_DIR/gradle/wrapper/gradle-wrapper.jar" \
  "https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar"

# 5. local.properties
echo "sdk.dir=$ANDROID_HOME" > "$SCRIPT_DIR/local.properties"
echo "Created local.properties"

echo ""
echo "=== Setup complete ==="
echo "Build with: ./build.sh"
echo "Or: ./gradlew assembleDebug"
echo "APK: app/build/outputs/apk/debug/app-debug.apk"
