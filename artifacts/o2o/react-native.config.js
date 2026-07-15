/**
 * react-native.config.js
 *
 * Overrides the autolinking config for packages that ship react-native.config.js
 * fields that are only valid in RN >= 0.71 (libraryName, componentDescriptors).
 * RN 0.68's CLI validator rejects those fields and silently SKIPS the whole
 * package, meaning its native code is never linked into the APK.
 *
 * Fix: re-declare each affected package with only the fields RN 0.68 understands.
 */

const fs = require('fs');
const path = require('path');

function resolvePkgRoot(pkgName) {
  try {
    return path.dirname(require.resolve(pkgName + '/package.json'));
  } catch (e) {
    // Fallback if package.json is not exported
    let current = path.dirname(require.resolve(pkgName));
    while (!fs.existsSync(path.join(current, 'package.json'))) {
      const parent = path.dirname(current);
      if (parent === current) throw new Error("Could not find package root for " + pkgName);
      current = parent;
    }
    return current;
  }
}

module.exports = {
  dependencies: {
    'react-native-safe-area-context': {
      platforms: {
        android: {
          // Only fields accepted by RN 0.68 autolinking
          sourceDir: path.join(
            resolvePkgRoot('react-native-safe-area-context'),
            'android',
          ),
          packageImportPath: 'import com.th3rdwave.safeareacontext.SafeAreaContextPackage;',
          packageInstance: 'new SafeAreaContextPackage()',
        },
      },
    },
    'react-native-screens': {
      platforms: {
        android: {
          sourceDir: path.join(
            resolvePkgRoot('react-native-screens'),
            'android',
          ),
          packageImportPath: 'import com.swmansion.rnscreens.RNScreensPackage;',
          packageInstance: 'new RNScreensPackage()',
        },
      },
    },
    'react-native-svg': {
      platforms: {
        android: {
          sourceDir: path.join(
            resolvePkgRoot('react-native-svg'),
            'android',
          ),
          packageImportPath: 'import com.horcrux.svg.SvgPackage;',
          packageInstance: 'new SvgPackage()',
        },
      },
    },
  },
};
