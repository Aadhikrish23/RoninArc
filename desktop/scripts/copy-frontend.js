// Copies the freshly-built frontend (../frontend/dist, built by predist
// just before this runs) into desktop/frontend/, which is what
// package.json's "files" glob actually packages. desktop/frontend/ is
// gitignored and fully regenerated here every time -- it must never be
// hand-edited or committed to (see .gitignore's note on why).

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "frontend", "dist");
const DEST = path.join(__dirname, "..", "frontend");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`[copy-frontend] ${SRC} does not exist -- did the frontend build run first?`);
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
copyRecursive(SRC, DEST);
console.log(`[copy-frontend] Copied ${SRC} -> ${DEST}`);
