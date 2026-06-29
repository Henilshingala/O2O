/**
 * Build script for React Native CLI project.
 *
 * Supports:
 *   - `node build.js android` → builds the Android APK/bundle
 *   - `node build.js ios`     → builds the iOS archive (macOS only)
 *   - `node build.js web`     → builds the web bundle via Vite
 *   - `node build.js`         → builds all available platforms
 *
 * Zero Expo dependency — uses react-native CLI and Vite directly.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, {
    stdio: "inherit",
    cwd: projectRoot,
    ...opts,
  });
}

function buildAndroid() {
  console.log("========================================");
  console.log("  Building Android (Release APK)");
  console.log("========================================");

  const gradlew =
    process.platform === "win32"
      ? path.join(projectRoot, "android", "gradlew.bat")
      : path.join(projectRoot, "android", "gradlew");

  run(`"${gradlew}" assembleRelease`, {
    cwd: path.join(projectRoot, "android"),
  });

  const apkPath = path.join(
    projectRoot,
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "release",
    "app-release.apk"
  );

  if (fs.existsSync(apkPath)) {
    console.log(`\n✅ Android APK built: ${apkPath}`);
  } else {
    console.log("\n⚠️  Build completed but APK not found at expected path.");
  }
}

function buildIOS() {
  if (process.platform !== "darwin") {
    console.log("⚠️  iOS builds are only supported on macOS. Skipping.");
    return;
  }

  console.log("========================================");
  console.log("  Building iOS");
  console.log("========================================");

  const iosDir = path.join(projectRoot, "ios");
  if (!fs.existsSync(iosDir)) {
    console.log("⚠️  No ios/ directory found. Run `npx react-native init` with --template to generate it, or create it manually.");
    return;
  }

  run("pod install", { cwd: iosDir });
  run(
    'xcodebuild -workspace ios/*.xcworkspace -scheme O2O -configuration Release -sdk iphoneos -archivePath build/O2O.xcarchive archive',
    { cwd: projectRoot }
  );

  console.log("\n✅ iOS archive built.");
}

function buildWeb() {
  console.log("========================================");
  console.log("  Building Web (Vite)");
  console.log("========================================");

  run("npx vite build");

  const distDir = path.join(projectRoot, "dist");
  if (fs.existsSync(distDir)) {
    console.log(`\n✅ Web build output: ${distDir}`);
  } else {
    console.log("\n⚠️  Build completed but dist/ not found.");
  }
}

// ----- Main -----
const args = process.argv.slice(2);
const platform = args[0]?.toLowerCase();

if (platform === "android") {
  buildAndroid();
} else if (platform === "ios") {
  buildIOS();
} else if (platform === "web") {
  buildWeb();
} else {
  // Build all available platforms
  buildAndroid();
  buildIOS();
  buildWeb();
}
