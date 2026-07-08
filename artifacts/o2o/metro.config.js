const path = require("path");
const fs = require("fs");

// Absolute path of this file's directory == the RN project root (artifacts/o2o).
// Must be exported explicitly so Metro always knows where the project lives,
// even when the CLI binary comes from the workspace-root node_modules
// (e.g. @react-native-community/cli v20 hoisted by pnpm), which would otherwise
// make Metro use the workspace root as projectRoot and fail to find index.js.
const projectRoot = __dirname;

// Two levels up: artifacts/o2o  →  artifacts  →  repo / workspace root.
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Resolve a top-level package to its actual directory on disk.
 * Only handles top-level package names (e.g. "react", "@scope/pkg").
 * Does NOT handle sub-path exports ("react/jsx-runtime") — those resolve
 * automatically once the top-level package is pinned.
 *
 * Returns null when the package cannot be found in either node_modules tree,
 * so callers can skip the mapping rather than pointing Metro at a ghost path.
 */
function resolveModule(name) {
  const localPath = path.join(projectRoot, "node_modules", name);
  if (fs.existsSync(localPath)) return localPath;

  const workspacePath = path.join(workspaceRoot, "node_modules", name);
  if (fs.existsSync(workspacePath)) return workspacePath;

  // Package not found in either tree — return null so the caller can skip it.
  return null;
}

// Packages that must resolve to exactly ONE copy across the whole monorepo.
// Listing:  only TRUE singletons whose duplication causes hard runtime crashes.
//   • react              — duplicate instances break all hook rules
//   • react-native       — duplicate native module registry
//   • async-storage      — duplicate NativeModule reference → getItem undefined
//   • @react-navigation  — duplicate NavigationContext → "No navigator" errors
//
// Intentionally NOT listed:
//   • react/jsx-runtime, react/jsx-dev-runtime — sub-paths, not packages;
//     handled automatically once "react" is pinned above
//   • socket.io-client, engine.io-client       — transitives; pnpm does not
//     always hoist them to the workspace root; mapping to a missing path would
//     crash Metro instead of helping
const DEDUPLICATED_MODULES = [
  "react",
  "react-native",
  "@react-navigation/native",
  "@react-native-async-storage/async-storage",
  "react-native-safe-area-context",
  "react-native-screens",
];

// Build the extraNodeModules map, skipping any package that cannot be found
// on disk.  A missing entry is far safer than an entry pointing at a ghost
// path, which would give Metro a directory-not-found error at bundle time.
const extraNodeModules = {};
for (const name of DEDUPLICATED_MODULES) {
  const resolved = resolveModule(name);
  if (resolved) {
    extraNodeModules[name] = resolved;
  } else {
    console.warn(`[metro.config] WARNING: ${name} not found in node_modules — skipping deduplication for this package`);
  }
}

module.exports = {
  // ─── Critical: explicit projectRoot ─────────────────────────────────────
  // Without this, Metro defaults to the process CWD. When pnpm's hoisted CLI
  // binary starts Metro from a parent directory the CWD is the workspace root
  // and Metro looks for <workspace-root>/index.js → HTTP 500.
  projectRoot,

  // Watch the workspace root so Metro can resolve pnpm-hoisted node_modules.
  watchFolders: [workspaceRoot],

  resolver: {
    // Resolution order: local node_modules first, then workspace root (pnpm hoist).
    nodeModulesPaths: [
      path.join(projectRoot, "node_modules"),
      path.join(workspaceRoot, "node_modules"),
    ],
    platforms: ["android", "native"],
    unstable_enableSymlinks: true,
    // Pin each singleton to a single, verified-to-exist path.
    extraNodeModules,
    // TypeScript + React Native file extensions in priority order.
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
