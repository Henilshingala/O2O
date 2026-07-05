// babel.config.js — React Native 0.68.7 (metro-react-native-babel-preset)
// NOTE: @react-native/babel-preset was introduced in RN 0.73+.
// For RN 0.68.x the correct preset is metro-react-native-babel-preset.
module.exports = {
  presets: ["module:metro-react-native-babel-preset"],
  plugins: [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@": "./",
        },
        extensions: [
          ".ios.js",
          ".android.js",
          ".native.js",
          ".js",
          ".jsx",
          ".ts",
          ".tsx",
          ".json",
        ],
      },
    ],
    [
      "module:react-native-dotenv",
      {
        moduleName: "@env",
        path: ".env",
        safe: false,
        allowUndefined: true,
      },
    ],
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-private-methods",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator",
    // react-native-reanimated/plugin MUST be last
    "react-native-reanimated/plugin",
  ],
};
