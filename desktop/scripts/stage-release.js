// desktop/scripts/stage-release.js
//
// After `npm run predist && npm run dist`: gathers what a GitHub release needs into
// release/v<version>/ and prints the gh command that publishes it.
//
//   RoninArc-Setup-<version>.exe            the installer the app's updater downloads
//   RoninArc-Setup-<version>.exe.blockmap   lets the next version update by downloading only changes
//   latest.yml                              how installed apps learn there's a new version
//   RoninArc-Setup.exe                      the same installer under a fixed name, for the website's
//                                           .../releases/latest/download/RoninArc-Setup.exe link
//   RoninArc.apk                            the Android app (the website links latest/download too,
//                                           so every release carries it, changed or not)
//
// Usage: npm run stage-release [-- --apk <path to RoninArc.apk>]
// Without --apk, the newest release/v*/RoninArc.apk is reused.

const fs = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(desktopDir, "..");
const version = require(path.join(desktopDir, "package.json")).version;
const dist = path.join(desktopDir, "dist");
const outDir = path.join(repoDir, "release", `v${version}`);

function fail(message) {
  console.error(`stage-release: ${message}`);
  process.exit(1);
}

const installer = path.join(dist, `RoninArc-Setup-${version}.exe`);
const blockmap = `${installer}.blockmap`;
const latestYml = path.join(dist, "latest.yml");
for (const f of [installer, blockmap, latestYml]) {
  if (!fs.existsSync(f)) fail(`${path.relative(repoDir, f)} is missing. Run "npm run predist && npm run dist" first.`);
}
const yml = fs.readFileSync(latestYml, "utf8");
if (!new RegExp(`^version: ${version.replace(/\./g, "\\.")}$`, "m").test(yml)) fail(`dist/latest.yml isn't for ${version}; rebuild.`);

function newestApk() {
  const releaseDir = path.join(repoDir, "release");
  if (!fs.existsSync(releaseDir)) return undefined;
  return fs
    .readdirSync(releaseDir)
    .map((d) => path.join(releaseDir, d, "RoninArc.apk"))
    .filter((f) => fs.existsSync(f) && path.dirname(f) !== outDir)
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

const apkFlag = process.argv.indexOf("--apk");
const apk = apkFlag >= 0 ? path.resolve(process.argv[apkFlag + 1] ?? "") : newestApk();
if (!apk || !fs.existsSync(apk)) fail("no RoninArc.apk found; pass --apk <path>.");

fs.mkdirSync(outDir, { recursive: true });
const copy = (from, name) => {
  fs.copyFileSync(from, path.join(outDir, name));
  return name;
};
const files = [
  copy(installer, path.basename(installer)),
  copy(blockmap, path.basename(blockmap)),
  copy(latestYml, "latest.yml"),
  copy(installer, "RoninArc-Setup.exe"),
  ...(path.resolve(apk) === path.join(outDir, "RoninArc.apk") ? ["RoninArc.apk"] : [copy(apk, "RoninArc.apk")]),
];

const rel = path.relative(repoDir, outDir).replace(/\\/g, "/");
console.log(`Staged ${files.length} files in ${rel}/ (APK from ${path.relative(repoDir, apk)}):`);
for (const f of files) console.log(`  ${f}`);
console.log("\nPublish (from the repo root, after pushing the version commit):");
console.log(
  `  gh release create v${version} --target main --title "RoninArc ${version}" --latest --notes-file <notes.md> ` +
    files.map((f) => `${rel}/${f}`).join(" "),
);
