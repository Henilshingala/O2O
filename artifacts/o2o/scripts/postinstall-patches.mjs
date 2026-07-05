#!/usr/bin/env node
/**
 * postinstall-patches.mjs
 *
 * Applies source-level patches to node_modules files that are incompatible
 * with AGP 8.x / Kotlin 2.x on React Native 0.68.7.
 *
 * Run automatically via the "postinstall" script in package.json.
 * Safe to run multiple times (idempotent - only patches if the original text is still present).
 *
 * Patches applied:
 *   1. @react-native-async-storage/async-storage@1.18.2
 *      - AsyncStorageModule.java  : BuildConfig.AsyncStorage_useDedicatedExecutor → false
 *      - AsyncStoragePackage.java : BuildConfig.AsyncStorage_useNextStorage → false
 *      - ReactDatabaseSupplier.java: BuildConfig.AsyncStorage_db_size → 6
 *
 *   2. react-native-gesture-handler@2.4.2
 *      - RNGestureHandlerPackage.kt: Remove BuildConfig import; IS_NEW_ARCHITECTURE_ENABLED → false
 *      - PanGestureHandler.kt      : ViewConfiguration.get(context) → ViewConfiguration.get(context!!)
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// scripts/ is inside artifacts/o2o/ — go up two levels to reach the monorepo root
const MONOREPO_ROOT = resolve(__dirname, '..', '..', '..');
const NODE_MODULES = join(MONOREPO_ROOT, 'node_modules');
const PNPM_STORE = join(NODE_MODULES, '.pnpm');

let patchCount = 0;
let skipCount = 0;

// ─── File patcher ─────────────────────────────────────────────────────────────

function patchFile(filePath, patches) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`  [SKIP] Not found: ${filePath}`);
    skipCount++;
    return;
  }

  let modified = content;
  let changed = false;

  for (const [from, to, desc] of patches) {
    const isRe = from instanceof RegExp;
    if (isRe ? from.test(modified) : modified.includes(from)) {
      modified = isRe ? modified.replace(from, to) : modified.split(from).join(to);
      changed = true;
      console.log(`  [PATCH] ${desc}`);
    }
  }

  if (changed) {
    writeFileSync(filePath, modified, 'utf8');
    patchCount++;
  } else {
    console.log(`  [OK]   Already patched`);
    skipCount++;
  }
}

// ─── Package finder ───────────────────────────────────────────────────────────
// Scans the pnpm virtual store for a dir that contains exactly the requested version.

function findPackageDir(packageName, expectedVersion) {
  // 1. Try flat layout first (npm / Yarn classic / pnpm hoisting)
  const flat = join(NODE_MODULES, packageName);
  try {
    const meta = JSON.parse(readFileSync(join(flat, 'package.json'), 'utf8'));
    if (!expectedVersion || meta.version === expectedVersion) {
      console.log(`  [FOUND] flat: ${flat}`);
      return flat;
    }
  } catch { /* not hoisted */ }

  // 2. Scan pnpm virtual store
  let storeDirs;
  try {
    storeDirs = readdirSync(PNPM_STORE);
  } catch {
    console.warn(`  [WARN] pnpm store not found at ${PNPM_STORE}`);
    return null;
  }

  // pnpm encodes scoped packages with @ → @scope_name... but also uses non-scoped prefix
  // e.g. @react-native-async-storage/async-storage → @react-native-async-storage_<hash>
  // and react-native-gesture-handler → react-native-gesture-handle_<hash>   (note: truncated!)
  const rawPrefix = packageName
    .split('/')[0]                // @react-native-async-storage  OR  react-native-gesture-handler
    .toLowerCase();

  for (const dir of storeDirs) {
    const dirLower = dir.toLowerCase();
    // Quick prefix check (handles both @scoped and plain packages)
    const startsWithScope = dirLower.startsWith(rawPrefix.toLowerCase().substring(0, 20));
    if (!startsWithScope) continue;

    const pkgJsonPath = join(PNPM_STORE, dir, 'node_modules', packageName, 'package.json');
    try {
      const meta = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (!expectedVersion || meta.version === expectedVersion) {
        const found = join(PNPM_STORE, dir, 'node_modules', packageName);
        console.log(`  [FOUND] pnpm store: ${dir}`);
        return found;
      }
    } catch { /* wrong dir or not a match */ }
  }

  console.warn(`  [WARN] ${packageName}@${expectedVersion} not found anywhere in node_modules`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. @react-native-async-storage/async-storage@1.18.2
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching @react-native-async-storage/async-storage@1.18.2 ===');

const asyncStorageDir = findPackageDir('@react-native-async-storage/async-storage', '1.18.2');
if (asyncStorageDir) {
  const javaBase = join(
    asyncStorageDir,
    'android/src/main/java/com/reactnativecommunity/asyncstorage'
  );

  patchFile(join(javaBase, 'AsyncStorageModule.java'), [
    [
      'BuildConfig.AsyncStorage_useDedicatedExecutor',
      'false',
      'AsyncStorageModule.java: BuildConfig.AsyncStorage_useDedicatedExecutor → false'
    ],
    [
      'BuildConfig.AsyncStorage_useNextStorage',
      'false',
      'AsyncStorageModule.java: BuildConfig.AsyncStorage_useNextStorage → false'
    ],
  ]);

  patchFile(join(javaBase, 'AsyncStoragePackage.java'), [
    [
      'BuildConfig.AsyncStorage_useNextStorage',
      'false',
      'AsyncStoragePackage.java: BuildConfig.AsyncStorage_useNextStorage → false'
    ],
  ]);

  patchFile(join(javaBase, 'ReactDatabaseSupplier.java'), [
    [
      /BuildConfig\.AsyncStorage_db_size/g,
      '6',
      'ReactDatabaseSupplier.java: BuildConfig.AsyncStorage_db_size → 6'
    ],
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. react-native-gesture-handler@2.4.2
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-gesture-handler@2.4.2 ===');

const gestureHandlerDir = findPackageDir('react-native-gesture-handler', '2.4.2');
if (gestureHandlerDir) {
  patchFile(
    join(
      gestureHandlerDir,
      'android/src/main/java/com/swmansion/gesturehandler/RNGestureHandlerPackage.kt'
    ),
    [
      [
        'import com.swmansion.gesturehandler.BuildConfig\n',
        '',
        'RNGestureHandlerPackage.kt: Remove BuildConfig import'
      ],
      [
        'BuildConfig.IS_NEW_ARCHITECTURE_ENABLED',
        'false',
        'RNGestureHandlerPackage.kt: IS_NEW_ARCHITECTURE_ENABLED → false'
      ],
    ]
  );

  patchFile(
    join(
      gestureHandlerDir,
      'android/lib/src/main/java/com/swmansion/gesturehandler/PanGestureHandler.kt'
    ),
    [
      [
        'ViewConfiguration.get(context)',
        'ViewConfiguration.get(context!!)',
        'PanGestureHandler.kt: Fix nullable Context? → context!!'
      ],
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\n✅  Postinstall patches done: ${patchCount} file(s) patched, ${skipCount} skipped.\n`
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. react-native-safe-area-context  — strip RN 0.71+ autolinking fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-safe-area-context (autolinking compat) ===');

const safeAreaDir = findPackageDir('react-native-safe-area-context', null);
if (safeAreaDir) {
  const cfgPath = join(safeAreaDir, 'react-native.config.js');
  const cleanCfg = `// Patched for RN 0.68 compat: removed libraryName & componentDescriptors
module.exports = {
  dependency: {
    platforms: {
      android: {},
      macos: null,
      windows: null,
    },
  },
};\n`;
  writeFileSync(cfgPath, cleanCfg, 'utf8');
  console.log('  [PATCH] react-native-safe-area-context/react-native.config.js stripped');
  patchCount++;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. react-native-screens — strip RN 0.71+ autolinking fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-screens (autolinking compat) ===');

const screensDir = findPackageDir('react-native-screens', null);
if (screensDir) {
  const cfgPath = join(screensDir, 'react-native.config.js');
  const cleanCfg = `// Patched for RN 0.68 compat: removed componentDescriptors & cmakeListsPath
module.exports = {
  dependency: {
    platforms: {
      android: {},
    },
  },
};\n`;
  writeFileSync(cfgPath, cleanCfg, 'utf8');
  console.log('  [PATCH] react-native-screens/react-native.config.js stripped');
  patchCount++;

  // Patch ScreenStack.kt Canvas nullability for Android SDK 33+
  patchFile(
    join(screensDir, 'android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt'),
    [
      [
        'super.drawChild(op.canvas, op.child, op.drawingTime)',
        'super.drawChild(op.canvas!!, op.child, op.drawingTime)',
        'ScreenStack.kt: Fix Canvas nullability (op.canvas!!)'
      ]
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. react-native-svg — strip RN 0.71+ autolinking fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-svg (autolinking compat) ===');

const svgDir = findPackageDir('react-native-svg', null);
if (svgDir) {
  const cfgPath = join(svgDir, 'react-native.config.js');
  const cleanCfg = `// Patched for RN 0.68 compat: removed componentDescriptors & cmakeListsPath
module.exports = {
  dependency: {
    platforms: {
      android: {},
    },
  },
};\n`;
  writeFileSync(cfgPath, cleanCfg, 'utf8');
  console.log('  [PATCH] react-native-svg/react-native.config.js stripped');
  patchCount++;
}

console.log(`\n✅  All patches applied: ${patchCount} total.\n`);

