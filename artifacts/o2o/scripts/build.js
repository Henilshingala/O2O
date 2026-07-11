/**
 * Build script for the Android React Native CLI project.
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

  // 1. Manually bundle JS (since Gradle tasks for this are disabled in build.gradle)
  console.log("\n[1/2] Bundling JS & Assets...");
  
  // Ensure assets dir exists
  const assetsDir = path.join(projectRoot, "android", "app", "src", "main", "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  run(`npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/ --reset-cache`);

  // 2. Build Release APK
  console.log("\n[2/2] Running Gradle assembleRelease...");
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
    // Copy the APK to the artifacts directory and rename it to o2o.apk
    const artifactsDir = path.resolve(projectRoot, "..");
    const destApkPath = path.join(artifactsDir, "o2o.apk");
    try {
      fs.copyFileSync(apkPath, destApkPath);
      console.log(`✅ Success! Renamed and copied to: ${destApkPath}`);
    } catch (err) {
      console.error(`⚠️ Failed to copy/rename APK: ${err.message}`);
    }
  } else {
    console.log("\n⚠️  Build completed but APK not found at expected path.");
  }
}

// ----- Main -----
const args = process.argv.slice(2);
const platform = args[0]?.toLowerCase();

if (platform && platform !== "android") {
  console.log(`Unsupported platform: ${platform}. Only android is available.`);
  process.exit(1);
}

buildAndroid();
