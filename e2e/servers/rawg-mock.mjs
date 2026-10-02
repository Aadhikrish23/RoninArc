// Minimal stand-in for the RAWG API (only the endpoints rawgService uses), so
// search/add/enrich/AI tests are deterministic and need no network or key.
import http from "node:http";
import { CATALOG, RAWG_FAILURE_QUERY } from "../fixtures/catalog.mjs";

const port = Number(process.env.E2E_RAWG_PORT || 5099);

function toListItem(g) {
  return {
    id: g.id,
    name: g.name,
    background_image: g.image,
    rating: g.rating,
    released: g.released,
    genres: g.genres.map((name) => ({ name })),
    added: 1000,
    ratings_count: 100,
    suggestions_count: 10,
    metacritic: g.metacritic,
  };
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] !== "games") return send(res, 404, { detail: "Not found." });
    if (!url.searchParams.get("key")) return send(res, 401, { error: "The key parameter is not provided" });

    if (parts.length === 1) {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      if (search === RAWG_FAILURE_QUERY) return send(res, 500, { error: "upstream exploded" });
      const results = CATALOG.filter((g) => g.name.toLowerCase().includes(search)).map(toListItem);
      return send(res, 200, { count: results.length, results });
    }

    const game = CATALOG.find((g) => String(g.id) === parts[1]);
    if (!game) return send(res, 404, { detail: "Not found." });

    if (parts[2] === "screenshots") {
      return send(res, 200, { results: [{ image: `${game.image}?shot=1` }] });
    }
    if (parts[2] === "movies") return send(res, 200, { results: [] });

    return send(res, 200, {
      ...toListItem(game),
      description_raw: game.description,
      background_image_additional: game.image,
      website: "https://example.com",
      playtime: 20,
      platforms: [{ platform: { name: "PC" } }],
      developers: [{ name: game.developer }],
      publishers: [{ name: game.developer }],
      tags: [{ name: "Singleplayer" }],
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`[e2e] RAWG mock listening on ${port}`));
