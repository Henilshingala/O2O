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

// ----- Main -----
const args = process.argv.slice(2);
const platform = args[0]?.toLowerCase();

if (platform && platform !== "android") {
  console.log(`Unsupported platform: ${platform}. Only android is available.`);
  process.exit(1);
}

buildAndroid();
