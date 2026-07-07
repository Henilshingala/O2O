const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

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
      acc[name] = path.resolve(projectRoot, "node_modules", name);
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
