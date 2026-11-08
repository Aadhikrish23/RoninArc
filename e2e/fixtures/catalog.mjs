// Shared by the IGDB mock server and the tests, so both agree on what exists.
const IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";
const img = (id) => `${IMAGE_BASE}/t_screenshot_big/shot${id}.jpg`;

export const IGDB_FAILURE_QUERY = "igdb-upstream-failure";
export const IGDB_OUTAGE_QUERY = "igdb-outage";
// Discovery requests for this genre fail upstream, to exercise the offline path.
export const IGDB_FAILURE_GENRE = "Card";
export const IGDB_FAILURE_GENRE_SLUG = "card-and-board-game";

const GENRES = { rpg: "role-playing-rpg", simulation: "simulator", platformer: "platform", sports: "sport", card: "card-and-board-game" };
const THEMES = new Set(["action", "stealth", "horror", "survival", "open-world"]);
const TAGS = {
  "co-op": { modes: ["co-operative"], keywords: ["online-co-op"] },
  singleplayer: { modes: ["single-player"] },
  multiplayer: { modes: ["multiplayer"] },
  "split-screen": { modes: ["split-screen"] },
  "souls-like": { keywords: ["soulslike"] },
  difficult: { keywords: ["difficult"] },
  cozy: { keywords: ["cozy"] },
  roguelike: { keywords: ["roguelike"] },
  metroidvania: { keywords: ["metroidvania"] },
};
const objects = (list) => list.map((slug) => ({ slug }));

/** A catalog game as IGDB would return it. */
export function toIgdbGame(g) {
  const names = g.genres.map((name) => name.toLowerCase());
  const tags = (g.tags ?? ["Singleplayer"]).map((name) => TAGS[name.toLowerCase()] ?? { keywords: [name.toLowerCase()] });
  return {
    id: g.id,
    name: g.name,
    steamAppId: g.steamAppId,
    summary: g.description,
    first_release_date: Math.floor(Date.parse(g.released) / 1000),
    total_rating: g.rating * 20,
    total_rating_count: 1000,
    aggregated_rating: g.criticScore,
    aggregated_rating_count: 10,
    artworks: [{ image_id: `art${g.id}` }],
    screenshots: [{ image_id: `shot${g.id}` }],
    cover: { image_id: `cover${g.id}` },
    genres: objects(names.filter((name) => !THEMES.has(name)).map((name) => GENRES[name] ?? name)),
    themes: objects(names.filter((name) => THEMES.has(name))),
    game_modes: objects(tags.flatMap((tag) => tag.modes ?? [])),
    keywords: objects(tags.flatMap((tag) => tag.keywords ?? [])),
    websites: [{ type: 1, url: "https://example.com" }],
    involved_companies: [{ developer: true, publisher: true, company: { name: g.developer } }],
    platforms: [{ name: "PC" }],
    videos: [],
    similar_games: g.similar ?? [],
  };
}

export const CATALOG = [
  { id: 3498, name: "Grand Theft Auto V", genres: ["Action"], rating: 4.5, released: "2013-09-17", criticScore: 92, developer: "Rockstar North", tags: ["Singleplayer", "Multiplayer", "Co-op"] },
  { id: 274755, name: "Hades", genres: ["Action", "RPG"], rating: 4.4, released: "2020-09-17", criticScore: 93, developer: "Supergiant Games", similar: [28] },
  { id: 326243, name: "Elden Ring", genres: ["Action", "RPG"], rating: 4.4, released: "2022-02-25", criticScore: 94, developer: "FromSoftware", tags: ["Singleplayer", "Co-op", "Souls-like", "Difficult"] },
  { id: 9767, name: "Hollow Knight", genres: ["Platformer", "Indie"], rating: 4.4, released: "2017-02-24", criticScore: 87, developer: "Team Cherry" },
  { id: 13537, name: "Fallout Shelter", genres: ["Simulation"], rating: 3.6, released: "2015-06-14", criticScore: 71, developer: "Bethesda" },
  { id: 41494, name: "Cyberpunk 2077", genres: ["Action", "RPG"], rating: 4.1, released: "2020-12-10", criticScore: 86, developer: "CD Projekt Red" },
  { id: 10754, name: "Stardew Valley", genres: ["Simulation", "Indie"], rating: 4.4, released: "2016-02-26", criticScore: 89, developer: "ConcernedApe", tags: ["Singleplayer", "Co-op", "Cozy"] },
  { id: 28, name: "Celeste", genres: ["Platformer", "Indie"], rating: 4.3, released: "2018-01-25", criticScore: 92, developer: "Maddy Makes Games" },
  { id: 58175, name: "Hitman", genres: ["Action", "Stealth"], rating: 4.0, released: "2016-03-11", criticScore: 84, developer: "IO Interactive" },
].map((g) => ({ ...g, image: img(g.id), description: `${g.name} is a game used by the RoninArc e2e suite.` }));

export const byName = (name) => {
  const game = CATALOG.find((g) => g.name === name);
  if (!game) throw new Error(`No catalog game named ${name}`);
  return game;
};
