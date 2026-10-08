// Stand-in Sentry ingest: records the envelopes the backend (@sentry/node) and
// browser (@sentry/react) SDKs send, so tests can assert errors were reported.
import http from "node:http";
import zlib from "node:zlib";

const port = Number(process.env.E2E_SENTRY_PORT || 5098);
const events = [];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function parseEnvelope(text, project) {
  const lines = text.split("\n").filter(Boolean);
  // line 0 = envelope header, then (item header, payload) pairs
  for (let i = 1; i + 1 < lines.length; i += 2) {
    try {
      const header = JSON.parse(lines[i]);
      if (header.type !== "event") continue;
      const event = JSON.parse(lines[i + 1]);
      const exception = event.exception?.values?.[0];
      events.push({
        project,
        message: exception?.value ?? event.message ?? "",
        type: exception?.type,
        tags: event.tags ?? {},
        platform: event.platform,
        environment: event.environment,
        hasStack: Boolean(exception?.stacktrace?.frames?.length),
        request: event.request ?? null,
      });
    } catch {
      // ignore malformed items
    }
  }
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/__events") {
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      return res.end(JSON.stringify(events));
    }

    const match = /^\/api\/(\d+)\/envelope\/?$/.exec(url.pathname);
    if (req.method === "POST" && match) {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        let body = Buffer.concat(chunks);
        if (req.headers["content-encoding"] === "gzip") body = zlib.gunzipSync(body);
        parseEnvelope(body.toString("utf8"), match[1]);
        res.writeHead(200, { "Content-Type": "application/json", ...cors });
        res.end("{}");
      });
      return;
    }

    res.writeHead(404, cors);
    res.end();
  })
  .listen(port, "127.0.0.1", () => console.log(`[e2e] Sentry mock listening on ${port}`));
