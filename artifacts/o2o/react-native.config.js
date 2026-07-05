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

module.exports = {
  dependencies: {
    'react-native-safe-area-context': {
      platforms: {
        android: {
          // Only fields accepted by RN 0.68 autolinking
          sourceDir: require('path').join(
            require.resolve('react-native-safe-area-context/package.json'),
            '../android',
          ),
          packageImportPath: 'import com.th3rdwave.safeareacontext.SafeAreaContextPackage;',
          packageInstance: 'new SafeAreaContextPackage()',
        },
      },
    },
    'react-native-screens': {
      platforms: {
        android: {
          sourceDir: require('path').join(
            require.resolve('react-native-screens/package.json'),
            '../android',
          ),
          packageImportPath: 'import com.swmansion.rnscreens.RNScreensPackage;',
          packageInstance: 'new RNScreensPackage()',
        },
      },
    },
    'react-native-svg': {
      platforms: {
        android: {
          sourceDir: require('path').join(
            require.resolve('react-native-svg/package.json'),
            '../android',
          ),
          packageImportPath: 'import com.horcrux.svg.SvgPackage;',
          packageInstance: 'new SvgPackage()',
        },
      },
    },
  },
};
