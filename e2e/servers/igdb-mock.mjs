// Stand-in for the IGDB API (only what igdbService asks for), so search/add/enrich/AI tests are
// deterministic and need no network or key. Understands just enough of its query language.
import http from "node:http";
import { CATALOG, IGDB_FAILURE_GENRE_SLUG, IGDB_FAILURE_QUERY, IGDB_OUTAGE_QUERY, toIgdbGame } from "../fixtures/catalog.mjs";

const port = Number(process.env.E2E_IGDB_PORT || 5099);

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const quoted = (text) => [...text.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const slugs = (list) => (list ?? []).map((item) => item.slug);

/** Each `field = (...)` / `field ~ "..."` in the where clause that isn't the "real games" boilerplate. */
function matchesWhere(game, where) {
  const ids = where.match(/\bid = \(?([\d, ]+)\)?/);
  if (ids && !ids[1].split(",").map(Number).includes(game.id)) return false;

  const alternatives = [...where.matchAll(/\b(keywords|themes|game_modes|genres)\.slug = \(([^)]*)\)/g)].map((m) => [m[1], quoted(m[2])]);
  if (alternatives.length > 0 && !alternatives.some(([field, wanted]) => slugs(game[field]).some((slug) => wanted.includes(slug)))) return false;

  const contains = [...where.matchAll(/\bname ~ \*"([^"]*)"\*/g)].map((m) => m[1].toLowerCase());
  if (contains.length > 0 && !contains.some((part) => game.name.toLowerCase().includes(part))) return false;

  const names = [...where.matchAll(/\bname ~ "([^"]*)"/g)].map((m) => m[1].toLowerCase());
  const alternate = [...where.matchAll(/alternative_names\.name ~ "([^"]*)"/g)].map((m) => m[1].toLowerCase());
  if (alternate.length > 0) return (game.alternative_names ?? []).some((a) => alternate.includes(a.name.toLowerCase()));
  if (names.length > 0 && !names.includes(game.name.toLowerCase())) return false;
  return true;
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const endpoint = new URL(req.url, `http://localhost:${port}`).pathname.replace(/^\/+/, "");
      if (req.method !== "POST") return send(res, 404, { message: "Not found" });
      if (!req.headers.authorization) return send(res, 401, { message: "Authorization Failure" });

      const games = CATALOG.map(toIgdbGame);
      if (endpoint === "game_time_to_beats") {
        const ids = (body.match(/game_id = \(([\d, ]+)\)/)?.[1] ?? "").split(",").map(Number);
        return send(res, 200, games.filter((g) => ids.includes(g.id)).map((g) => ({ game_id: g.id, normally: 20 * 3600 })));
      }
      if (endpoint === "external_games") {
        const uids = quoted(body);
        return send(res, 200, games.filter((g) => g.steamAppId && uids.includes(String(g.steamAppId))).map((g) => ({ uid: String(g.steamAppId), game: g.id })));
      }
      if (endpoint !== "games") return send(res, 404, { message: "Not found" });

      const search = body.match(/search "([^"]*)"/)?.[1]?.toLowerCase();
      if (search === IGDB_FAILURE_QUERY) return send(res, 500, { message: "upstream exploded" });
      if (search === IGDB_OUTAGE_QUERY) return send(res, 522, { message: "origin unreachable" });
      if (body.includes(`"${IGDB_FAILURE_GENRE_SLUG}"`)) return send(res, 500, { message: "upstream exploded" });

      const where = body.match(/where ([^;]*);/)?.[1] ?? "";
      let rows = games.filter((g) => matchesWhere(g, where));
      if (search !== undefined) rows = rows.filter((g) => g.name.toLowerCase().includes(search) || search.split(/\s+/).every((w) => g.name.toLowerCase().includes(w)));
      const limit = Number(body.match(/limit (\d+)/)?.[1] ?? 10);
      const offset = Number(body.match(/offset (\d+)/)?.[1] ?? 0);
      return send(res, 200, rows.slice(offset, offset + limit));
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`[e2e] IGDB mock listening on ${port}`));
