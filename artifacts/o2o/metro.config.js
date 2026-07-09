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
  const candidates = [
    path.join(projectRoot, "node_modules", name),
    path.join(workspaceRoot, "node_modules", name),
    path.join(workspaceRoot, "node_modules", ".pnpm", "node_modules", name),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.realpathSync(p);
    }
  }
  return null;
}

const modulesToResolve = new Set([
  "react",
  "react-native",
  "react-native-reanimated",
  "react-native-gesture-handler",
]);

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        const scopeDir = path.join(dir, entry.name);
        if (fs.existsSync(scopeDir)) {
          const subEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
          for (const subEntry of subEntries) {
            modulesToResolve.add(`${entry.name}/${subEntry.name}`);
          }
        }
      } else {
        modulesToResolve.add(entry.name);
      }
    }
  } catch (e) {
    console.warn(`[metro.config] Failed to scan directory ${dir}:`, e);
  }
}

scan(path.join(projectRoot, "node_modules"));
scan(path.join(workspaceRoot, "node_modules"));
scan(path.join(workspaceRoot, "node_modules", ".pnpm", "node_modules"));

// Build the extraNodeModules map with real physical paths
const extraNodeModules = {};
for (const name of modulesToResolve) {
  if (name.startsWith("@workspace/")) {
    continue;
  }
  const resolved = resolveModule(name);
  if (resolved) {
    extraNodeModules[name] = resolved;
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
