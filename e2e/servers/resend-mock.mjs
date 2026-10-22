// Stand-in for the Resend email API: keeps what the cloud "sends" so tests can open the reset link.
import http from "node:http";

const port = Number(process.env.E2E_RESEND_PORT || 5097);
const sent = [];

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "POST" && url.pathname === "/emails") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
          res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ message: "Missing API key" }));
          return;
        }
        const email = JSON.parse(body || "{}");
        sent.push({ ...email, receivedAt: new Date().toISOString() });
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: `email_${sent.length}` }));
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/__emails") {
      const to = url.searchParams.get("to");
      const list = to ? sent.filter((e) => (e.to || []).includes(to)) : sent;
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(list));
      return;
    }
    if (url.pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    res.writeHead(404).end();
  })
  .listen(port, () => console.log(`resend mock on ${port}`));
