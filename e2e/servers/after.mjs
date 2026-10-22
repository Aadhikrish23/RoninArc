// `node after.mjs <url> <command...>`: waits until <url> answers, then runs the command.
// The cloud backend reuses the build the local backend's server step makes, so it starts after it.
import { spawn } from "node:child_process";

const [url, ...command] = process.argv.slice(2);
const deadline = Date.now() + 240_000;
for (;;) {
  try {
    const res = await fetch(url);
    if (res.ok) break;
  } catch {
    // not up yet
  }
  if (Date.now() > deadline) {
    console.error(`timed out waiting for ${url}`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
const child = spawn(command[0], command.slice(1), { stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
