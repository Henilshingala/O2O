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

  // RN 0.68 Old Architecture fix: TurboModuleRegistry.get('RNCAsyncStorage') returns
  // null because it's a plain NativeModule, not a TurboModule. Patch the JS to check
  // NativeModules FIRST so AsyncStorage is never undefined at runtime.
  const rctAsyncStoragePath = join(asyncStorageDir, 'lib/commonjs/RCTAsyncStorage.js');
  patchFile(rctAsyncStoragePath, [
    [
      `let RCTAsyncStorage = _reactNative.TurboModuleRegistry ? _reactNative.TurboModuleRegistry.get('PlatformLocalStorage') || // Support for external modules, like react-native-windows\n_reactNative.TurboModuleRegistry.get('RNC_AsyncSQLiteDBStorage') || _reactNative.TurboModuleRegistry.get('RNCAsyncStorage') : _reactNative.NativeModules['PlatformLocalStorage'] || // Support for external modules, like react-native-windows\n_reactNative.NativeModules['RNC_AsyncSQLiteDBStorage'] || _reactNative.NativeModules['RNCAsyncStorage'];`,
      `// RN 0.68 Old Architecture: NativeModules first, TurboModuleRegistry fallback\nlet RCTAsyncStorage = _reactNative.NativeModules['PlatformLocalStorage'] ||\n  _reactNative.NativeModules['RNC_AsyncSQLiteDBStorage'] ||\n  _reactNative.NativeModules['RNCAsyncStorage'];\nif (!RCTAsyncStorage && _reactNative.TurboModuleRegistry) {\n  RCTAsyncStorage = _reactNative.TurboModuleRegistry.get('PlatformLocalStorage') ||\n    _reactNative.TurboModuleRegistry.get('RNC_AsyncSQLiteDBStorage') ||\n    _reactNative.TurboModuleRegistry.get('RNCAsyncStorage');\n}`,
      'RCTAsyncStorage.js: NativeModules-first lookup for Old Architecture RN 0.68'
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. react — patch useSyncExternalStore polyfill directly into react development & production modules
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react (useSyncExternalStore compatibility polyfill) ===');

const reactDir = findPackageDir('react', null);
if (reactDir) {
  const devPath = join(reactDir, 'cjs/react.development.js');
  const prodPath = join(reactDir, 'cjs/react.production.min.js');

  const targetDev = `function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {\n  var dispatcher = resolveDispatcher();\n  return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);\n}`;
  const replacementDev = `function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {\n  var value = getSnapshot();\n  var state = useState({inst: {value: value, getSnapshot: getSnapshot}});\n  var inst = state[0].inst;\n  var forceUpdate = state[1];\n  useLayoutEffect(function() {\n    inst.value = value;\n    inst.getSnapshot = getSnapshot;\n    var nextValue = inst.getSnapshot();\n    if (inst.value !== nextValue) {\n      forceUpdate({inst: inst});\n    }\n  }, [subscribe, value, getSnapshot]);\n  useEffect(function() {\n    var nextValue = inst.getSnapshot();\n    if (inst.value !== nextValue) {\n      forceUpdate({inst: inst});\n    }\n    return subscribe(function() {\n      var nextValue2 = inst.getSnapshot();\n      if (inst.value !== nextValue2) {\n        forceUpdate({inst: inst});\n      }\n    });\n  }, [subscribe]);\n  return value;\n}`;

  patchFile(devPath, [
    [
      targetDev,
      replacementDev,
      'react.development.js: useSyncExternalStore → polyfill'
    ],
    [
      targetDev.replace(/\\n/g, '\\r\\n'),
      replacementDev.replace(/\\n/g, '\\r\\n'),
      'react.development.js: useSyncExternalStore → polyfill (CRLF)'
    ]
  ]);

  const targetProd = `exports.useSyncExternalStore=function(a,b,e){return U.current.useSyncExternalStore(a,b,e)}`;
  const replacementProd = `exports.useSyncExternalStore=function(subscribe,getSnapshot){var value=getSnapshot();var state=U.current.useState({inst:{value:value,getSnapshot:getSnapshot}});var inst=state[0].inst;var forceUpdate=state[1];U.current.useLayoutEffect(function(){inst.value=value;inst.getSnapshot=getSnapshot;if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}},[subscribe,value,getSnapshot]);U.current.useEffect(function(){if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}return subscribe(function(){if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}})},[subscribe]);return value}`;

  patchFile(prodPath, [
    [
      targetProd,
      replacementProd,
      'react.production.min.js: useSyncExternalStore → polyfill'
    ]
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. @react-navigation/native-stack — compatibilityFlags, useAnimatedValue, and ScreenStackItem fallbacks
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching @react-navigation/native-stack (compatibilityFlags, useAnimatedValue, ScreenStackItem) ===');

const nativeStackDir = findPackageDir('@react-navigation/native-stack', null);
if (nativeStackDir) {
  const tsxPath = join(nativeStackDir, 'src/views/NativeStackView.native.tsx');
  const jsPath = join(nativeStackDir, 'lib/module/views/NativeStackView.native.js');

  const targetTsx = `  const usesNewAndroidHeaderHeightImplementation =\n    'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags &&\n    compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;
  const replacementTsx = `  const usesNewAndroidHeaderHeightImplementation =\n    compatibilityFlags && typeof compatibilityFlags === 'object' && 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags &&\n    compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;

  const importTsx = `  useAnimatedValue,\n  View,\n} from 'react-native';`;
  const replacementImportTsx = `  useAnimatedValue as _useAnimatedValue,\n  View,\n} from 'react-native';\n\nconst useAnimatedValue = _useAnimatedValue || function (initialValue: number) {\n  const ref = React.useRef<Animated.Value | null>(null);\n  if (ref.current === null) {\n    ref.current = new Animated.Value(initialValue);\n  }\n  return ref.current;\n};`;

  const screensImportTsx = `  compatibilityFlags,\n  type ScreenProps,\n  ScreenStack,\n  ScreenStackItem,\n} from 'react-native-screens';`;
  const replacementScreensImportTsx = `  compatibilityFlags,\n  type ScreenProps,\n  ScreenStack,\n  ScreenStackItem as _ScreenStackItem,\n  Screen,\n} from 'react-native-screens';\n\nconst ScreenStackItem = _ScreenStackItem || (Screen as any);`;

  patchFile(tsxPath, [
    [
      targetTsx,
      replacementTsx,
      'NativeStackView.native.tsx: safety check for compatibilityFlags'
    ],
    [
      targetTsx.replace(/\n/g, '\r\n'),
      replacementTsx.replace(/\n/g, '\r\n'),
      'NativeStackView.native.tsx: safety check for compatibilityFlags (CRLF)'
    ],
    [
      importTsx,
      replacementImportTsx,
      'NativeStackView.native.tsx: fallback for useAnimatedValue'
    ],
    [
      importTsx.replace(/\n/g, '\r\n'),
      replacementImportTsx.replace(/\n/g, '\r\n'),
      'NativeStackView.native.tsx: fallback for useAnimatedValue (CRLF)'
    ],
    [
      screensImportTsx,
      replacementScreensImportTsx,
      'NativeStackView.native.tsx: fallback for ScreenStackItem'
    ],
    [
      screensImportTsx.replace(/\n/g, '\r\n'),
      replacementScreensImportTsx.replace(/\n/g, '\r\n'),
      'NativeStackView.native.tsx: fallback for ScreenStackItem (CRLF)'
    ]
  ]);

  const targetJs = `  const usesNewAndroidHeaderHeightImplementation = 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags && compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;
  const replacementJs = `  const usesNewAndroidHeaderHeightImplementation = compatibilityFlags && typeof compatibilityFlags === 'object' && 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags && compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;

  const importJs = `import { Animated, Platform, StatusBar, StyleSheet, useAnimatedValue, View } from 'react-native';`;
  const replacementImportJs = `import { Animated, Platform, StatusBar, StyleSheet, useAnimatedValue as _useAnimatedValue, View } from 'react-native';\nconst useAnimatedValue = _useAnimatedValue || function (initialValue) { const ref = React.useRef(null); if (ref.current === null) { ref.current = new Animated.Value(initialValue); } return ref.current; };`;

  const screensImportJs = `import { compatibilityFlags, ScreenStack, ScreenStackItem } from 'react-native-screens';`;
  const replacementScreensImportJs = `import { compatibilityFlags, ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || Screen;`;

  patchFile(jsPath, [
    [
      targetJs,
      replacementJs,
      'NativeStackView.native.js: safety check for compatibilityFlags'
    ],
    [
      importJs,
      replacementImportJs,
      'NativeStackView.native.js: fallback for useAnimatedValue'
    ],
    [
      screensImportJs,
      replacementScreensImportJs,
      'NativeStackView.native.js: fallback for ScreenStackItem'
    ]
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. @react-navigation/bottom-tabs — useAnimatedValue and ScreenStackItem fallbacks
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching @react-navigation/bottom-tabs (useAnimatedValue & ScreenStackItem fallbacks) ===');

const bottomTabsDir = findPackageDir('@react-navigation/bottom-tabs', null);
if (bottomTabsDir) {
  const tsxPath = join(bottomTabsDir, 'src/unstable/NativeScreen/NativeScreen.tsx');
  const jsPath = join(bottomTabsDir, 'lib/module/unstable/NativeScreen/NativeScreen.js');

  const importTsx = `  useAnimatedValue,\n  View,\n} from 'react-native';`;
  const replacementImportTsx = `  useAnimatedValue as _useAnimatedValue,\n  View,\n} from 'react-native';\n\nconst useAnimatedValue = _useAnimatedValue || function (initialValue: number) {\n  const ref = React.useRef<Animated.Value | null>(null);\n  if (ref.current === null) {\n    ref.current = new Animated.Value(initialValue);\n  }\n  return ref.current;\n};`;

  const screensImportTsx = `import { ScreenStack, ScreenStackItem } from 'react-native-screens';`;
  const replacementScreensImportTsx = `import { ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || (Screen as any);`;

  patchFile(tsxPath, [
    [
      importTsx,
      replacementImportTsx,
      'NativeScreen.tsx: fallback for useAnimatedValue'
    ],
    [
      importTsx.replace(/\n/g, '\r\n'),
      replacementImportTsx.replace(/\n/g, '\r\n'),
      'NativeScreen.tsx: fallback for useAnimatedValue (CRLF)'
    ],
    [
      screensImportTsx,
      replacementScreensImportTsx,
      'NativeScreen.tsx: fallback for ScreenStackItem'
    ],
    [
      screensImportTsx.replace(/\n/g, '\r\n'),
      replacementScreensImportTsx.replace(/\n/g, '\r\n'),
      'NativeScreen.tsx: fallback for ScreenStackItem (CRLF)'
    ]
  ]);

  const importJs = `import { Animated, Platform, StyleSheet, useAnimatedValue, View } from 'react-native';`;
  const replacementImportJs = `import { Animated, Platform, StyleSheet, useAnimatedValue as _useAnimatedValue, View } from 'react-native';\nconst useAnimatedValue = _useAnimatedValue || function (initialValue) { const ref = React.useRef(null); if (ref.current === null) { ref.current = new Animated.Value(initialValue); } return ref.current; };`;

  const screensImportJs = `import { ScreenStack, ScreenStackItem } from 'react-native-screens';`;
  const replacementScreensImportJs = `import { ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || Screen;`;

  patchFile(jsPath, [
    [
      importJs,
      replacementImportJs,
      'NativeScreen.js: fallback for useAnimatedValue'
    ],
    [
      screensImportJs,
      replacementScreensImportJs,
      'NativeScreen.js: fallback for ScreenStackItem'
    ]
  ]);
}

console.log(`\n✅  All patches applied: ${patchCount} total.\n`);

