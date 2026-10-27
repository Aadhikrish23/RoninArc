// The release APK, the same way every time:
//   node scripts/build-release.cjs [cloudUrl]
// - Regenerates android/ with RoninArc Cloud's address baked in.
// - Builds with the settings that work on a PC short of memory (one worker, two ABIs, no lint pass).
// - Signs with the release key in keystore/ (gitignored; back it up: every later update must be
//   signed with the same key, or Android refuses to install it over the old app).
// Output: android/app/build/outputs/apk/release/app-release.apk
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// (Windows' 260-character path limit is handled by plugins/withShortCxxDir.js.)
const root = path.join(__dirname, "..");
const cloudUrl = process.argv[2] || process.env.RONINARC_CLOUD_URL || "https://roninarc-cloud.onrender.com";
const signing = JSON.parse(fs.readFileSync(path.join(root, "keystore", "release.json"), "utf8"));
const storeFile = path.join(root, "keystore", signing.storeFile);

const javaHome = process.env.JAVA_HOME || "C:\\Program Files\\Android\\Android Studio\\jbr";
const env = {
  ...process.env,
  RONINARC_CLOUD_URL: cloudUrl,
  JAVA_HOME: javaHome,
  ANDROID_HOME: process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk"),
  PATH: `${path.join(javaHome, "bin")}${path.delimiter}${process.env.PATH}`,
};

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.filter((a) => !a.includes("password")).join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`Building for RoninArc Cloud at ${cloudUrl}`);
run("npx", ["expo", "prebuild", "--platform", "android", "--clean", "--no-install"], root);
run(
  process.platform === "win32" ? `"${path.join(root, "android", "gradlew.bat")}"` : "./gradlew",
  [
    "assembleRelease",
    "--no-daemon",
    "--console=plain",
    "--max-workers=1",
    "-PreactNativeArchitectures=arm64-v8a,x86_64",
    `"-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=384m"`,
    "-Pkotlin.compiler.execution.strategy=in-process",
    "-x", "lintVitalAnalyzeRelease", "-x", "lintVitalReportRelease", "-x", "lintVitalRelease",
    // Android Gradle Plugin's own signing overrides (what Android Studio uses), so the generated
    // android/ folder never needs hand edits.
    `"-Pandroid.injected.signing.store.file=${storeFile}"`,
    `"-Pandroid.injected.signing.store.password=${signing.password}"`,
    `-Pandroid.injected.signing.key.alias=${signing.alias}`,
    `"-Pandroid.injected.signing.key.password=${signing.password}"`,
  ],
  path.join(root, "android"),
);
const apk = path.join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
console.log(`\nAPK: ${apk} (${Math.round(fs.statSync(apk).size / 1024 / 1024)} MB)`);
