/**
 * react-native.config.js
 *
 * Overrides the autolinking config for packages that ship react-native.config.js
 * fields that are only valid in RN >= 0.71 (libraryName, componentDescriptors).
 * RN 0.68's CLI validator rejects those fields and silently SKIPS the whole
 * package, meaning its native code is never linked into the APK.
 *
 */

const fs = require('fs');
const path = require('path');

function resolvePkgRoot(pkgName) {
  try {
    return path.dirname(require.resolve(pkgName + '/package.json'));
  } catch (e) {
    let current = path.dirname(require.resolve(pkgName));
    while (!fs.existsSync(path.join(current, 'package.json'))) {
      const parent = path.dirname(current);
      if (parent === current) return null; // Gracefully return null if not found
      current = parent;
    }
    return current;
  }
}

const config = {
  dependencies: {},
};

// Map of overrides for React Native 0.68 autolinking
const overrides = {
  'react-native-safe-area-context': {
    packageImportPath: 'import com.th3rdwave.safeareacontext.SafeAreaContextPackage;',
    packageInstance: 'new SafeAreaContextPackage()',
  },
  'react-native-screens': {
    packageImportPath: 'import com.swmansion.rnscreens.RNScreensPackage;',
    packageInstance: 'new RNScreensPackage()',
  },
  'react-native-svg': {
    packageImportPath: 'import com.horcrux.svg.SvgPackage;',
    packageInstance: 'new SvgPackage()',
  },
};

for (const [pkgName, pkgConfig] of Object.entries(overrides)) {
  try {
    const pkgRoot = resolvePkgRoot(pkgName);
    if (pkgRoot) {
      config.dependencies[pkgName] = {
        platforms: {
          android: {
            sourceDir: path.join(pkgRoot, 'android'),
            ...pkgConfig,
          },
        },
      };
    }
  } catch (e) {
    // Ignore missing packages gracefully
  }
}

module.exports = config;
