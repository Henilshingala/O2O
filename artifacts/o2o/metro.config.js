const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Modules that must resolve to exactly one copy across the monorepo.
// Having two instances of these causes runtime crashes (e.g. context mismatches,
// "Cannot read property 'getItem' of undefined" from duplicate AsyncStorage, etc.)
const DEDUPLICATED_MODULES = [
  "react",
  "react-native",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@react-navigation/native",
  "@tanstack/react-query",
  "react-native-safe-area-context",
  "react-native-screens",
  // AsyncStorage must be deduplicated — a second instance is unlinked (no native
  // module) and every call on it crashes with "Cannot read property 'getItem' of undefined"
  "@react-native-async-storage/async-storage",
  // socket.io-client must resolve from the app, not from a hoisted copy, so that
  // it picks up the React Native transport (not a browser/Node shim).
  "socket.io-client",
  "engine.io-client",
];

function resolveFromProject(moduleName) {
  try {
    return require.resolve(moduleName, { paths: [projectRoot] });
  } catch {
    return null;
  }
}

module.exports = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
    disableHierarchicalLookup: false,
    platforms: ["android", "native"],
    unstable_enableSymlinks: true,
    extraNodeModules: DEDUPLICATED_MODULES.reduce((acc, name) => {
      const resolved = resolveFromProject(name);
      if (resolved) {
        // Map to the package root (strip the entry point file from the path)
        const pkgRoot = resolved.slice(
          0,
          resolved.lastIndexOf("node_modules/" + name) + "node_modules/".length + name.length
        );
        acc[name] = pkgRoot;
      } else {
        // Fallback: assume it lives in the project node_modules
        acc[name] = path.resolve(projectRoot, "node_modules", name);
      }
      return acc;
    }, {}),
  },
  transformer: {
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
