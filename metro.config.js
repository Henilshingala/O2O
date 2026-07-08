/**
 * metro.config.js  (repository root)
 *
 * Delegation config — forwards to the React Native app configuration at
 * artifacts/o2o/metro.config.js so that Metro works correctly when
 * `react-native start` is invoked from the repository root instead of from
 * within artifacts/o2o/.
 *
 * The real configuration (projectRoot, watchFolders, resolver, transformer)
 * is maintained in artifacts/o2o/metro.config.js.  __dirname inside that
 * module always resolves to artifacts/o2o/ regardless of where it is
 * required from, so all relative path calculations remain correct.
 */
module.exports = require('./artifacts/o2o/metro.config.js');
