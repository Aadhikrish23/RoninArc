// Windows caps paths at 260 characters unless long paths are switched on, and from SDK 58 the
// app's native build nests past that under E:\RoninArc\mobile\android\app\.cxx\... (the APK build
// failed in safe-area-context's codegen with "ninja: error: mkdir(...): No such file or directory").
// Moving folders alone can't fix it: CMake copies the source's full location into the object path
// (".../E_/RoninArc/mobile/node_modules/react-native-safe-area-context/android/build/generated/..."),
// 280+ characters even from C:\. So on Windows this (1) moves the app's CMake working folder to a
// short one, C:\rnx by default (RONINARC_CXX_DIR to change it), and (2) sets CMAKE_OBJECT_PATH_MAX,
// which makes CMake shorten any object path that would be longer (with a hash). CMake does that by
// default on Windows, but not when the target is Android. Other platforms are untouched.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// withShortCxxDir";

module.exports = function withShortCxxDir(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^android \{\n/m,
      `android {
    ${MARKER}: keep native build paths under Windows' 260-character limit.
    if (System.getProperty("os.name").toLowerCase().contains("windows")) {
        externalNativeBuild { cmake { buildStagingDirectory = file(System.getenv("RONINARC_CXX_DIR") ?: "C:/rnx") } }
        defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } } }
    }
`,
    );
    return cfg;
  });
};
