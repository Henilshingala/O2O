// metro.config.js — React Native 0.68.7 + pnpm workspace monorepo
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
// Two levels up from artifacts/o2o → O2O workspace root
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * nodeModulesPaths is critical in a pnpm monorepo:
 *   - workspaceRoot/node_modules contains hoisted packages (metro-*, babel-*)
 *   - projectRoot/node_modules contains app-specific packages
 *
 * Without workspaceRoot, Metro cannot resolve metro-react-native-babel-transformer
 * or metro-react-native-babel-preset, causing HTTP 500.
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
    // Do NOT disable hierarchical lookup — needed for platform-specific resolution
    disableHierarchicalLookup: false,
    // Explicit platform list for Android-only build
    platforms: ["android", "native"],
    // pnpm uses symlinks — ensure they are followed
    unstable_enableSymlinks: true,
  },
  transformer: {
    // Explicitly point to the workspace-level transformer so Metro can find it
    babelTransformerPath: require.resolve(
      path.join(workspaceRoot, "node_modules/metro-react-native-babel-transformer")
    ),
    minifierPath: 'metro-minify-terser',
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
