const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Resolve a module to its package directory.
 * Checks project node_modules first, then workspace root node_modules.
 * Uses path.join (cross-platform — works on Windows and Unix).
 */
function resolveModule(name) {
  const localPath = path.join(projectRoot, "node_modules", name);
  const workspacePath = path.join(workspaceRoot, "node_modules", name);
  if (fs.existsSync(localPath)) return localPath;
  if (fs.existsSync(workspacePath)) return workspacePath;
  // Final fallback — let Metro handle it
  return workspacePath;
}

// These modules must resolve to exactly one copy across the entire monorepo.
// Duplicate instances cause runtime crashes:
//   - AsyncStorage duplicate → "Cannot read property 'getItem' of undefined"
//   - React duplicate → hook context mismatches
const DEDUPLICATED_MODULES = [
  "react",
  "react-native",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@react-navigation/native",
  "@tanstack/react-query",
  "react-native-safe-area-context",
  "react-native-screens",
  "@react-native-async-storage/async-storage",
  "socket.io-client",
  "engine.io-client",
];

module.exports = {
  // Explicitly set projectRoot so Metro always resolves entry points from
  // artifacts/o2o/ regardless of the working directory the CLI is invoked
  // from (repo root, CI, Android Studio terminal, etc.).
  // WITHOUT this, Metro defaults to cwd which can be the workspace root,
  // causing "Unable to resolve module ./index" HTTP 500 on first launch.
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.join(projectRoot, "node_modules"),
      path.join(workspaceRoot, "node_modules"),
    ],
    platforms: ["android", "native"],
    unstable_enableSymlinks: true,
    extraNodeModules: DEDUPLICATED_MODULES.reduce((acc, name) => {
      acc[name] = resolveModule(name);
      return acc;
    }, {}),
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};
