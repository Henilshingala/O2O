// metro.config.js — React Native 0.68.7 + pnpm workspace monorepo
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
// Two levels up from artifacts/o2o → O2O workspace root
const workspaceRoot = path.resolve(projectRoot, "../..");

// Packages that MUST resolve to the app-level copy to prevent duplicate instances.
// In a pnpm monorepo the workspace root may have react@19 (for admin-panel) while
// the mobile app uses react@18. If @tanstack/react-query (hoisted to root) imports
// from react@19 and RN renders with react@18, useSyncExternalStore comes back as
// undefined → "undefined is not a function" crash in DataProvider.
const DEDUPLICATED_MODULES = [
  "react",
  "react-native",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@react-navigation/native",
  "@tanstack/react-query",
  "react-native-safe-area-context",
  "react-native-screens",
];

function resolveFromProject(moduleName) {
  try {
    return require.resolve(moduleName, { paths: [projectRoot] });
  } catch {
    return null;
  }
}

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
    // Force singleton modules to always resolve from the app's own node_modules.
    // This prevents pnpm hoisting from silently loading react@19 for packages
    // installed at the workspace root (e.g. @tanstack/react-query).
    resolveRequest: (context, moduleName, platform) => {
      const base = moduleName.split("/")[0];
      const scopedBase =
        moduleName.startsWith("@") ? moduleName.split("/").slice(0, 2).join("/") : base;
      if (DEDUPLICATED_MODULES.includes(moduleName) || DEDUPLICATED_MODULES.includes(scopedBase)) {
        const filePath = resolveFromProject(moduleName);
        if (filePath) {
          return { filePath, type: "sourceFile" };
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
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
