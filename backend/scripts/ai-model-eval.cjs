// Scores NVIDIA models on 24 varied messages, using a REAL planner prompt from an app AI log
// (the instructions plus that user's library) with a different "User Request" swapped in.
//
//   node backend/scripts/ai-model-eval.cjs <ai-log-file> <model> [<model> ...]
//
// <ai-log-file> is any file from <app data>/logs/ai/<date>/ (installed app: %APPDATA%\desktop\logs\ai\...).
// Needs NVIDIA_API_KEY (and optionally NVIDIA_BASE_URL) in backend/.env or the environment. It calls NVIDIA
// directly with the backend's settings (temperature 0, no thinking mode) and prints how many of the 24
// messages each model plans correctly. List the models NVIDIA currently serves with: GET <base>/models.
//
// Why this exists: the e2e suite runs a stand-in model, so it cannot judge AI quality. This is how a model
// change is judged before shipping (2026-11-22: lightning-30b 14/24, nemotron-3.5-super-vl-120b 23/24).
const fs = require("node:fs");
const path = require("node:path");

const envFile = path.join(__dirname, "..", ".env");
const fromFile = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) fromFile[m[1]] = m[2].trim();
  }
}
const env = { ...fromFile, ...process.env };
const base = (env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
const key = env.NVIDIA_API_KEY;

const [logFile, ...models] = process.argv.slice(2);
if (!logFile || models.length === 0) {
  console.error("usage: node backend/scripts/ai-model-eval.cjs <ai-log-file> <model> [<model> ...]");
  process.exit(1);
}
if (!key) {
  console.error("NVIDIA_API_KEY is not set (backend/.env or the environment).");
  process.exit(1);
}

const lines = fs.readFileSync(logFile, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l === "Generated Prompt:") + 2;
let end = start;
while (end < lines.length && lines[end] !== '"""') end++;
const template = lines.slice(start, end).join("\n");
const original = (template.match(/User Request:\n([^\n]+)\n/) || [])[1];
if (!original) throw new Error("no 'User Request:' line in that log's prompt");
const withMessage = (message) => template.replace(`User Request:\n${original}\n`, `User Request:\n${message}\n`);

// [message, intents that must appear (type -> minimum count), intents that must NOT appear]
const CASES = [
  ["add all batman's arkham games to the library and create an collection for it and then add them to it", { AddGame: 1, CreateCollection: 1, OrganizeCollection: 1 }, []],
  ["add arkham origins and put every arkham game in a single collection", { AddGame: 1, OrganizeCollection: 1 }, ["SetStatus"]],
  ["create a collection called God of War and add all the God of War games i have to it", { CreateCollection: 1, OrganizeCollection: 1 }, []],
  ["i finished elden ring, 10/10, and add a note: the dlc was brutal", { RateGame: 1, AddNote: 1 }, ["RemoveGame"]],
  ["start hollow knight and launch it", { SetStatus: 1, LaunchGame: 1 }, ["RemoveGame"]],
  ["rate celeste 9 and hades 10", { RateGame: 2 }, ["RemoveGame"]],
  ["pause the witcher 3 and set cyberpunk to playing", { SetStatus: 2 }, ["RemoveGame"]],
  ["make a soulslike collection", { CreateCollection: 1 }, []],
  ["put dark souls 3 and elden ring in the soulslike collection", { OrganizeCollection: 1 }, ["RemoveGame"]],
  ["remove fallout shelter from my library", { RemoveGame: 1 }, []],
  ["what should i play tonight? i have 2 hours", { RecommendGame: 1 }, ["AddGame", "SetStatus", "RemoveGame"]],
  ["is silksong worth it?", { AskQuestion: 1 }, ["AddGame", "SetStatus", "RemoveGame", "RateGame"]],
  ["sync my steam library", { SyncLibrary: 1 }, []],
  ["add portal 2 and doom, mark portal 2 completed with a 10, then start doom", { AddGame: 2, RateGame: 1 }, ["RemoveGame"]],
  ["take hades out of the roguelike collection", { OrganizeCollection: 1 }, ["RemoveGame"]],
  ["delete my review for celeste", { DeleteReview: 1 }, ["RemoveGame"]],
  ["read me my notes for hollow knight", { LibraryQuestion: 1 }, ["AddNote"]],
  ["how many games have i completed?", { LibraryQuestion: 1 }, ["SetStatus", "RemoveGame"]],
  ["create a collection called souls and add elden ring, dark souls 3, sekiro and bloodborne to it", { CreateCollection: 1, OrganizeCollection: 1 }, []],
  ["hello", { AskQuestion: 1 }, ["AddGame", "SetStatus"]],
  ["connect epic", { ConnectAccount: 1 }, []],
  ["drop gta 5 its mid", { SetStatus: 1 }, ["RemoveGame"]],
  ["add hollow knight silksong to my library and mark it as playing", { AddGame: 1 }, ["RemoveGame"]],
  ["make a cozy collection and put stardew valley in it, then rate stardew 9", { CreateCollection: 1, OrganizeCollection: 1, RateGame: 1 }, []],
];

async function call(model, content) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: 0,
        max_tokens: 1024,
        stream: false,
        ...(model.startsWith("nvidia/") ? { chat_template_kwargs: { thinking: false } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { ms, err: `HTTP ${res.status}` };
    const json = await res.json();
    return { ms, text: json.choices?.[0]?.message?.content ?? "" };
  } catch (e) {
    return { ms: Date.now() - t0, err: e.name === "TimeoutError" ? "timeout" : e.message };
  }
}

function intentsOf(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]).intents || [];
  } catch {
    return null;
  }
}

(async () => {
  const summary = [];
  for (const model of models) {
    const results = new Array(CASES.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < CASES.length) {
          const i = next++;
          const [message, need, forbid] = CASES[i];
          const r = await call(model, withMessage(message));
          let ok = false;
          let note = "";
          if (r.err) note = `ERROR ${r.err}`;
          else {
            const intents = intentsOf(r.text);
            if (!intents) note = "NO/BAD JSON";
            else {
              const count = {};
              for (const x of intents) count[x.type] = (count[x.type] || 0) + 1;
              const missing = Object.entries(need).filter(([t, n]) => (count[t] || 0) < n).map(([t, n]) => `${t}x${n}`);
              const bad = forbid.filter((t) => count[t]);
              ok = missing.length === 0 && bad.length === 0;
              if (!ok) note = `${missing.length ? "missing " + missing.join("+") : ""}${bad.length ? " forbidden " + bad.join("+") : ""} :: ${intents.map((x) => x.type).join(",")}`;
            }
          }
          results[i] = { message, ok, note, ms: r.ms };
        }
      }),
    );
    const answered = results.filter((r) => !r.note.startsWith("ERROR"));
    const avg = Math.round(answered.reduce((a, r) => a + r.ms, 0) / Math.max(1, answered.length));
    const line = `${results.filter((r) => r.ok).length}/${CASES.length} correct, avg ${avg} ms`;
    summary.push([model, line]);
    console.log(`\n##### ${model}: ${line}`);
    for (const r of results) if (!r.ok) console.log(`  FAIL "${r.message.slice(0, 70)}"\n       ${r.note}`);
  }
  console.log("\n===== SUMMARY =====");
  for (const [m, v] of summary) console.log(m.padEnd(42), v);
})();
