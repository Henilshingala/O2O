const path = require("path");
const fs = require("fs");

// Absolute path of this file's directory == the RN project root (artifacts/o2o).
// This must be exported explicitly so Metro always knows where the project lives,
// even when the CLI binary that starts Metro comes from the workspace-root
// node_modules (e.g. @react-native-community/cli v20 hoisted by pnpm).
const projectRoot = __dirname;

// Two levels up: artifacts/o2o  ->  artifacts  ->  repo/workspace root.
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Resolve a module to its package directory.
 * Handles both top-level packages ("react") and scoped packages ("@scope/pkg").
 * Does NOT handle sub-path exports ("react/jsx-runtime") – those are resolved
 * by Metro automatically once the top-level package is deduplicated.
 * Checks project node_modules first, then workspace-root node_modules (pnpm hoist).
 */
function resolveModule(name) {
  const localPath = path.join(projectRoot, "node_modules", name);
  const workspacePath = path.join(workspaceRoot, "node_modules", name);
  if (fs.existsSync(localPath)) return localPath;
  if (fs.existsSync(workspacePath)) return workspacePath;
  // Final fallback — let Metro handle it normally.
  return workspacePath;
}

// Modules that MUST resolve to exactly one copy across the monorepo.
// Duplicate instances cause runtime crashes:
//   - AsyncStorage duplicate  → "Cannot read property 'getItem' of undefined"
//   - React duplicate         → hook context mismatches / "Invalid hook call"
// NOTE: sub-paths like "react/jsx-runtime" are intentionally omitted —
//       they are resolved automatically through the top-level "react" entry.
const DEDUPLICATED_MODULES = [
  "react",
  "react-native",
  "@react-navigation/native",
  "@tanstack/react-query",
  "react-native-safe-area-context",
  "react-native-screens",
  "@react-native-async-storage/async-storage",
  "socket.io-client",
  "engine.io-client",
];

module.exports = {
  // ─── Critical: tell Metro explicitly where the RN project lives ───────────
  // Without this, Metro defaults to the process CWD.  When pnpm's hoisted CLI
  // binary starts Metro from a parent directory, the CWD is the workspace root
  // and Metro tries to load <workspace-root>/index.js instead of this app's
  // index.js, producing HTTP 500 "Unable to resolve module ./index".
  projectRoot,

  // Watch the workspace root so Metro can resolve pnpm-hoisted node_modules.
  watchFolders: [workspaceRoot],

  resolver: {
    // Search order: local first, then workspace root (matches pnpm hoisting).
    nodeModulesPaths: [
      path.join(projectRoot, "node_modules"),
      path.join(workspaceRoot, "node_modules"),
    ],
    platforms: ["android", "native"],
    unstable_enableSymlinks: true,
    // Pin each deduplicated module to a single resolved path so Metro never
    // loads two copies from different node_modules trees.
    extraNodeModules: DEDUPLICATED_MODULES.reduce((acc, name) => {
      acc[name] = resolveModule(name);
      return acc;
    }, {}),
    // TypeScript + React Native extensions in resolution priority order.
    sourceExts: ["ts", "tsx", "js", "jsx", "json", "cjs", "mjs"],
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
