#!/usr/bin/env bash
# Builds and runs the app on an iOS Simulator without touching code signing.
# `expo run:ios` refuses to build for the simulator when the Sign In with Apple
# entitlement is present unless a real Development certificate exists in the
# keychain. This script bypasses that check by building directly with
# xcodebuild (which uses ad-hoc "Sign to Run Locally" signing for simulators)
# and driving the simulator with simctl instead.
set -euo pipefail

cd "$(dirname "$0")/.."

WORKSPACE="ios/LaMnagreParis.xcworkspace"
SCHEME="LaMnagreParis"
CONFIGURATION="Debug"
DEVICE_NAME="${1:-iPhone 17}"
DERIVED_DATA="ios/build"

UDID=$(xcrun simctl list devices available | awk -v name="$DEVICE_NAME" -F'[()]' '
  $0 ~ "^ *"name" \\(" { print $2; exit }
')

if [ -z "$UDID" ]; then
  echo "error: no available simulator matching \"$DEVICE_NAME\"" >&2
  echo "available devices:" >&2
  xcrun simctl list devices available >&2
  exit 1
fi

if ! xcrun simctl list devices | grep -q "$UDID.*Booted"; then
  echo "Booting $DEVICE_NAME ($UDID)..."
  xcrun simctl boot "$UDID"
fi
open -a Simulator

echo "Building $SCHEME for $DEVICE_NAME..."
if command -v xcbeautify >/dev/null 2>&1; then
  xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration "$CONFIGURATION" \
    -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath "$DERIVED_DATA" build | xcbeautify
else
  xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration "$CONFIGURATION" \
    -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath "$DERIVED_DATA" build
fi

APP_PATH="$DERIVED_DATA/Build/Products/${CONFIGURATION}-iphonesimulator/${SCHEME}.app"
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PATH/Info.plist")

echo "Installing $BUNDLE_ID..."
xcrun simctl install "$UDID" "$APP_PATH"

METRO_PID=""
if ! lsof -iTCP:8081 -sTCP:LISTEN -Pn >/dev/null 2>&1; then
  echo "Starting Metro bundler..."
  npx expo start &
  METRO_PID=$!
  for _ in $(seq 1 30); do
    lsof -iTCP:8081 -sTCP:LISTEN -Pn >/dev/null 2>&1 && break
    sleep 1
  done
fi

echo "Launching app..."
xcrun simctl launch "$UDID" "$BUNDLE_ID"

echo "$SCHEME is running on $DEVICE_NAME."

if [ -n "$METRO_PID" ]; then
  trap 'kill "$METRO_PID" 2>/dev/null' EXIT
  echo "Metro is live below — press Ctrl+C to stop."
  wait "$METRO_PID"
else
  echo "Metro was already running elsewhere; nothing to attach to."
fi
