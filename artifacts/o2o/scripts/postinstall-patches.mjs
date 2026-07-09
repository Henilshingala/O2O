import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const WORKSPACE_ROOT = join(__dirname, '../../..');
const NODE_MODULES = join(WORKSPACE_ROOT, 'node_modules');
const PNPM_STORE = join(NODE_MODULES, '.pnpm');

let patchCount = 0;
let skipCount = 0;

// ─── Patch Applier ───────────────────────────────────────────────────────────
function patchFile(filePath, patches) {
  if (!existsSync(filePath)) {
    return;
  }

  let content = readFileSync(filePath, 'utf8');
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
// Scans the workspace and pnpm store for ALL directories matching the package.
function findPackageDirs(packageName, expectedVersion) {
  const dirs = [];
  // 1. Try flat layout first (npm / Yarn classic / pnpm hoisting)
  const flat = join(NODE_MODULES, packageName);
  try {
    const meta = JSON.parse(readFileSync(join(flat, 'package.json'), 'utf8'));
    if (!expectedVersion || meta.version === expectedVersion) {
      console.log(`  [FOUND] flat: ${flat}`);
      dirs.push(flat);
    }
  } catch { /* not hoisted */ }

  // 2. Scan pnpm virtual store
  let storeDirs;
  try {
    storeDirs = readdirSync(PNPM_STORE);
  } catch {
    console.warn(`  [WARN] pnpm store not found at ${PNPM_STORE}`);
    return dirs;
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
        dirs.push(found);
      }
    } catch { /* wrong dir or not a match */ }
  }

  if (dirs.length === 0) {
    console.warn(`  [WARN] ${packageName}@${expectedVersion} not found anywhere in node_modules`);
  }
  return dirs;
}

// ─── Declarative Package Patcher ──────────────────────────────────────────────
function patchPackage(packageName, expectedVersion, filesToPatch) {
  console.log(`\n=== Patching ${packageName} ===`);
  const dirs = findPackageDirs(packageName, expectedVersion);
  for (const dir of dirs) {
    for (const [relativePath, patches] of Object.entries(filesToPatch)) {
      const filePath = join(dir, relativePath);
      patchFile(filePath, patches);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. @react-native-async-storage/async-storage@1.18.2
// ─────────────────────────────────────────────────────────────────────────────
patchPackage('@react-native-async-storage/async-storage', '1.18.2', {
  'android/src/main/java/com/reactnativecommunity/asyncstorage/AsyncStorageModule.java': [
    [
      'BuildConfig.AsyncStorage_useDedicatedExecutor',
      'false',
      'AsyncStorageModule.java: BuildConfig.AsyncStorage_useDedicatedExecutor → false'
    ],
    [
      'BuildConfig.AsyncStorage_useNextStorage',
      'false',
      'AsyncStorageModule.java: BuildConfig.AsyncStorage_useNextStorage → false'
    ]
  ],
  'android/src/main/java/com/reactnativecommunity/asyncstorage/AsyncStoragePackage.java': [
    [
      'BuildConfig.AsyncStorage_useNextStorage',
      'false',
      'AsyncStoragePackage.java: BuildConfig.AsyncStorage_useNextStorage → false'
    ]
  ],
  'android/src/main/java/com/reactnativecommunity/asyncstorage/ReactDatabaseSupplier.java': [
    [
      /BuildConfig\.AsyncStorage_db_size/g,
      '6',
      'ReactDatabaseSupplier.java: BuildConfig.AsyncStorage_db_size → 6'
    ]
  ],
  'lib/commonjs/RCTAsyncStorage.js': [
    [
      `let RCTAsyncStorage = _reactNative.TurboModuleRegistry ? _reactNative.TurboModuleRegistry.get('PlatformLocalStorage') || // Support for external modules, like react-native-windows\n_reactNative.TurboModuleRegistry.get('RNC_AsyncSQLiteDBStorage') || _reactNative.TurboModuleRegistry.get('RNCAsyncStorage') : _reactNative.NativeModules['PlatformLocalStorage'] || // Support for external modules, like react-native-windows\n_reactNative.NativeModules['RNC_AsyncSQLiteDBStorage'] || _reactNative.NativeModules['RNCAsyncStorage'];`,
      `// RN 0.68 Old Architecture: NativeModules first, TurboModuleRegistry fallback\nlet RCTAsyncStorage = _reactNative.NativeModules['PlatformLocalStorage'] ||\n  _reactNative.NativeModules['RNC_AsyncSQLiteDBStorage'] ||\n  _reactNative.NativeModules['RNCAsyncStorage'];\nif (!RCTAsyncStorage && _reactNative.TurboModuleRegistry) {\n  RCTAsyncStorage = _reactNative.TurboModuleRegistry.get('PlatformLocalStorage') ||\n    _reactNative.TurboModuleRegistry.get('RNC_AsyncSQLiteDBStorage') ||\n    _reactNative.TurboModuleRegistry.get('RNCAsyncStorage');\n}`,
      'RCTAsyncStorage.js: NativeModules-first lookup for Old Architecture RN 0.68'
    ]
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. react-native-gesture-handler@2.4.2
// ─────────────────────────────────────────────────────────────────────────────
patchPackage('react-native-gesture-handler', '2.4.2', {
  'android/src/main/java/com/swmansion/gesturehandler/RNGestureHandlerPackage.kt': [
    [
      'import com.swmansion.gesturehandler.BuildConfig\n',
      '',
      'RNGestureHandlerPackage.kt: Remove BuildConfig import'
    ],
    [
      'BuildConfig.IS_NEW_ARCHITECTURE_ENABLED',
      'false',
      'RNGestureHandlerPackage.kt: IS_NEW_ARCHITECTURE_ENABLED → false'
    ]
  ],
  'android/lib/src/main/java/com/swmansion/gesturehandler/PanGestureHandler.kt': [
    [
      'ViewConfiguration.get(context)',
      'ViewConfiguration.get(context!!)',
      'PanGestureHandler.kt: Fix nullable Context? → context!!'
    ]
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. react-native-safe-area-context  — strip RN 0.71+ autolinking fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-safe-area-context (autolinking compat) ===');
const safeAreaDirs = findPackageDirs('react-native-safe-area-context', null);
for (const dir of safeAreaDirs) {
  const cfgPath = join(dir, 'react-native.config.js');
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
const screensDirs = findPackageDirs('react-native-screens', null);
for (const dir of screensDirs) {
  const cfgPath = join(dir, 'react-native.config.js');
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

  patchFile(join(dir, 'android/src/main/java/com/swmansion/rnscreens/ScreenStack.kt'), [
    [
      'super.drawChild(op.canvas, op.child, op.drawingTime)',
      'super.drawChild(op.canvas!!, op.child, op.drawingTime)',
      'ScreenStack.kt: Fix Canvas nullability (op.canvas!!)'
    ]
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. react-native-svg — strip RN 0.71+ autolinking fields
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Patching react-native-svg (autolinking compat) ===');
const svgDirs = findPackageDirs('react-native-svg', null);
for (const dir of svgDirs) {
  const cfgPath = join(dir, 'react-native.config.js');
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
// 6. react — useSyncExternalStore polyfill
// ─────────────────────────────────────────────────────────────────────────────
const targetDev = `function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {\n  var dispatcher = resolveDispatcher();\n  return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);\n}`;
const replacementDev = `function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {\n  var value = getSnapshot();\n  var state = useState({inst: {value: value, getSnapshot: getSnapshot}});\n  var inst = state[0].inst;\n  var forceUpdate = state[1];\n  useLayoutEffect(function() {\n    inst.value = value;\n    inst.getSnapshot = getSnapshot;\n    var nextValue = inst.getSnapshot();\n    if (inst.value !== nextValue) {\n      forceUpdate({inst: inst});\n    }\n  }, [subscribe, value, getSnapshot]);\n  useEffect(function() {\n    var nextValue = inst.getSnapshot();\n    if (inst.value !== nextValue) {\n      forceUpdate({inst: inst});\n    }\n    return subscribe(function() {\n      var nextValue2 = inst.getSnapshot();\n      if (inst.value !== nextValue2) {\n        forceUpdate({inst: inst});\n      }\n    });\n  }, [subscribe]);\n  return value;\n}`;

const targetProd = `exports.useSyncExternalStore=function(a,b,e){return U.current.useSyncExternalStore(a,b,e)}`;
const replacementProd = `exports.useSyncExternalStore=function(subscribe,getSnapshot){var value=getSnapshot();var state=U.current.useState({inst:{value:value,getSnapshot:getSnapshot}});var inst=state[0].inst;var forceUpdate=state[1];U.current.useLayoutEffect(function(){inst.value=value;inst.getSnapshot=getSnapshot;if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}},[subscribe,value,getSnapshot]);U.current.useEffect(function(){if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}return subscribe(function(){if(inst.value!==inst.getSnapshot()){forceUpdate({inst:inst})}})},[subscribe]);return value}`;

patchPackage('react', null, {
  'cjs/react.development.js': [
    [
      targetDev,
      replacementDev,
      'react.development.js: useSyncExternalStore → polyfill'
    ],
    [
      targetDev.replace(/\n/g, '\r\n'),
      replacementDev.replace(/\n/g, '\r\n'),
      'react.development.js: useSyncExternalStore → polyfill (CRLF)'
    ]
  ],
  'cjs/react.production.min.js': [
    [
      targetProd,
      replacementProd,
      'react.production.min.js: useSyncExternalStore → polyfill'
    ]
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. @react-navigation/native-stack
// ─────────────────────────────────────────────────────────────────────────────
const targetTsx = `  const usesNewAndroidHeaderHeightImplementation =\n    'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags &&\n    compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;
const replacementTsx = `  const usesNewAndroidHeaderHeightImplementation =\n    compatibilityFlags && typeof compatibilityFlags === 'object' && 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags &&\n    compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;

const importTsx = `  useAnimatedValue,\n  View,\n} from 'react-native';`;
const replacementImportTsx = `  useAnimatedValue as _useAnimatedValue,\n  View,\n} from 'react-native';\n\nconst useAnimatedValue = _useAnimatedValue || function (initialValue: number) {\n  const ref = React.useRef<Animated.Value | null>(null);\n  if (ref.current === null) {\n    ref.current = new Animated.Value(initialValue);\n  }\n  return ref.current;\n};`;

const screensImportTsx = `  compatibilityFlags,\n  type ScreenProps,\n  ScreenStack,\n  ScreenStackItem,\n} from 'react-native-screens';`;
const replacementScreensImportTsx = `  compatibilityFlags,\n  type ScreenProps,\n  ScreenStack,\n  ScreenStackItem as _ScreenStackItem,\n  Screen,\n} from 'react-native-screens';\n\nconst ScreenStackItem = _ScreenStackItem || (Screen as any);`;

const targetJs = `  const usesNewAndroidHeaderHeightImplementation = 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags && compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;
const replacementJs = `  const usesNewAndroidHeaderHeightImplementation = compatibilityFlags && typeof compatibilityFlags === 'object' && 'usesNewAndroidHeaderHeightImplementation' in compatibilityFlags && compatibilityFlags['usesNewAndroidHeaderHeightImplementation'] === true;`;

const importJs = `import { Animated, Platform, StatusBar, StyleSheet, useAnimatedValue, View } from 'react-native';`;
const replacementImportJs = `import { Animated, Platform, StatusBar, StyleSheet, useAnimatedValue as _useAnimatedValue, View } from 'react-native';\nconst useAnimatedValue = _useAnimatedValue || function (initialValue) { const ref = React.useRef(null); if (ref.current === null) { ref.current = new Animated.Value(initialValue); } return ref.current; };`;

const screensImportJs = `import { compatibilityFlags, ScreenStack, ScreenStackItem } from 'react-native-screens';`;
const replacementScreensImportJs = `import { compatibilityFlags, ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || Screen;`;

patchPackage('@react-navigation/native-stack', null, {
  'src/views/NativeStackView.native.tsx': [
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
  ],
  'lib/module/views/NativeStackView.native.js': [
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
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. @react-navigation/bottom-tabs
// ─────────────────────────────────────────────────────────────────────────────
const importTsxTabs = `  useAnimatedValue,\n  View,\n} from 'react-native';`;
const replacementImportTsxTabs = `  useAnimatedValue as _useAnimatedValue,\n  View,\n} from 'react-native';\n\nconst useAnimatedValue = _useAnimatedValue || function (initialValue: number) {\n  const ref = React.useRef<Animated.Value | null>(null);\n  if (ref.current === null) {\n    ref.current = new Animated.Value(initialValue);\n  }\n  return ref.current;\n};`;

const screensImportTsxTabs = `import { ScreenStack, ScreenStackItem } from 'react-native-screens';`;
const replacementScreensImportTsxTabs = `import { ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || (Screen as any);`;

const importJsTabs = `import { Animated, Platform, StyleSheet, useAnimatedValue, View } from 'react-native';`;
const replacementImportJsTabs = `import { Animated, Platform, StyleSheet, useAnimatedValue as _useAnimatedValue, View } from 'react-native';\nconst useAnimatedValue = _useAnimatedValue || function (initialValue) { const ref = React.useRef(null); if (ref.current === null) { ref.current = new Animated.Value(initialValue); } return ref.current; };`;

const screensImportJsTabs = `import { ScreenStack, ScreenStackItem } from 'react-native-screens';`;
const replacementScreensImportJsTabs = `import { ScreenStack, ScreenStackItem as _ScreenStackItem, Screen } from 'react-native-screens';\nconst ScreenStackItem = _ScreenStackItem || Screen;`;

patchPackage('@react-navigation/bottom-tabs', null, {
  'src/unstable/NativeScreen/NativeScreen.tsx': [
    [
      importTsxTabs,
      replacementImportTsxTabs,
      'NativeScreen.tsx: fallback for useAnimatedValue'
    ],
    [
      importTsxTabs.replace(/\n/g, '\r\n'),
      replacementImportTsxTabs.replace(/\n/g, '\r\n'),
      'NativeScreen.tsx: fallback for useAnimatedValue (CRLF)'
    ],
    [
      screensImportTsxTabs,
      replacementScreensImportTsxTabs,
      'NativeScreen.tsx: fallback for ScreenStackItem'
    ],
    [
      screensImportTsxTabs.replace(/\n/g, '\r\n'),
      replacementScreensImportTsxTabs.replace(/\n/g, '\r\n'),
      'NativeScreen.tsx: fallback for ScreenStackItem (CRLF)'
    ]
  ],
  'lib/module/unstable/NativeScreen/NativeScreen.js': [
    [
      importJsTabs,
      replacementImportJsTabs,
      'NativeScreen.js: fallback for useAnimatedValue'
    ],
    [
      screensImportJsTabs,
      replacementScreensImportJsTabs,
      'NativeScreen.js: fallback for ScreenStackItem'
    ]
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. react-native
// ─────────────────────────────────────────────────────────────────────────────
const flatListConstructorOld = `  constructor(props: Props<ItemT>) {
    super(props);
    this._checkProps(this.props);
    if (this.props.viewabilityConfigCallbackPairs) {
      this._virtualizedListPairs =
        this.props.viewabilityConfigCallbackPairs.map(pair => ({
          viewabilityConfig: pair.viewabilityConfig,
          onViewableItemsChanged: this._createOnViewableItemsChanged(
            pair.onViewableItemsChanged,
          ),
        }));
    } else if (this.props.onViewableItemsChanged) {
      this._virtualizedListPairs.push({
        /* $FlowFixMe[incompatible-call] (>=0.63.0 site=react_native_fb) This
         * comment suppresses an error found when Flow v0.63 was deployed. To
         * see the error delete this comment and run Flow. */
        viewabilityConfig: this.props.viewabilityConfig,
        onViewableItemsChanged: this._createOnViewableItemsChanged(
          this.props.onViewableItemsChanged,
        ),
      });
    }
  }`;
const flatListConstructorNew = `  constructor(props: Props<ItemT>) {
    super(props);
    this._checkProps(props);
    if (props.viewabilityConfigCallbackPairs) {
      this._virtualizedListPairs =
        props.viewabilityConfigCallbackPairs.map(pair => ({
          viewabilityConfig: pair.viewabilityConfig,
          onViewableItemsChanged: this._createOnViewableItemsChanged(
            pair.onViewableItemsChanged,
          ),
        }));
    } else if (props.onViewableItemsChanged) {
      this._virtualizedListPairs.push({
        /* $FlowFixMe[incompatible-call] (>=0.63.0 site=react_native_fb) This
         * comment suppresses an error found when Flow v0.63 was deployed. To
         * see the error delete this comment and run Flow. */
        viewabilityConfig: props.viewabilityConfig,
        onViewableItemsChanged: this._createOnViewableItemsChanged(
          props.onViewableItemsChanged,
        ),
      });
    }
  }`;

const virtualizedListConstructorOld = `  constructor(props: Props) {
    super(props);
    invariant(
      // $FlowFixMe[prop-missing]
      !this.props.onScroll || !this.props.onScroll.__isNative,
      'Components based on VirtualizedList must be wrapped with Animated.createAnimatedComponent ' +
        'to support native onScroll events with useNativeDriver',
    );
    invariant(
      windowSizeOrDefault(this.props.windowSize) > 0,
      'VirtualizedList: The windowSize prop must be present and set to a value greater than 0.',
    );`;

const virtualizedListConstructorNew = `  constructor(props: Props) {
    super(props);
    invariant(
      // $FlowFixMe[prop-missing]
      !props.onScroll || !props.onScroll.__isNative,
      'Components based on VirtualizedList must be wrapped with Animated.createAnimatedComponent ' +
        'to support native onScroll events with useNativeDriver',
    );
    invariant(
      windowSizeOrDefault(props.windowSize) > 0,
      'VirtualizedList: The windowSize prop must be present and set to a value greater than 0.',
    );`;

patchPackage('react-native', null, {
  'Libraries/Lists/FlatList.js': [
    [
      flatListConstructorOld,
      flatListConstructorNew,
      'FlatList.js: Use constructor props instead of this.props'
    ],
    [
      flatListConstructorOld.replace(/\n/g, '\r\n'),
      flatListConstructorNew.replace(/\n/g, '\r\n'),
      'FlatList.js: Use constructor props instead of this.props (CRLF)'
    ],
    [
      `    } = props;\n    const numColumns = numColumnsOrDefault(this.props.numColumns);`,
      `    } = props;\n    const numColumns = numColumnsOrDefault(props.numColumns);`,
      'FlatList.js: Use _checkProps parameter props instead of this.props'
    ],
    [
      `    } = props;\r\n    const numColumns = numColumnsOrDefault(this.props.numColumns);\r`,
      `    } = props;\r\n    const numColumns = numColumnsOrDefault(props.numColumns);\r`,
      'FlatList.js: Use _checkProps parameter props instead of this.props (CRLF)'
    ]
  ],
  'Libraries/Lists/VirtualizedList.js': [
    [
      virtualizedListConstructorOld,
      virtualizedListConstructorNew,
      'VirtualizedList.js: Use constructor props instead of this.props'
    ],
    [
      virtualizedListConstructorOld.replace(/\n/g, '\r\n'),
      virtualizedListConstructorNew.replace(/\n/g, '\r\n'),
      'VirtualizedList.js: Use constructor props instead of this.props (CRLF)'
    ]
  ]
});

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\n✅  All patches applied: ${patchCount} total, ${skipCount} skipped.\n`
);
