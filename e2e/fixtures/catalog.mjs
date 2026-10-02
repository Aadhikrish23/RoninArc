// Shared by the RAWG mock server and the tests, so both agree on what exists.
const img = (slug) => `https://media.example.com/games/${slug}.jpg`;

export const RAWG_FAILURE_QUERY = "rawg-upstream-failure";

export const CATALOG = [
  { id: 3498, name: "Grand Theft Auto V", genres: ["Action"], rating: 4.5, released: "2013-09-17", metacritic: 92, developer: "Rockstar North" },
  { id: 274755, name: "Hades", genres: ["Action", "RPG"], rating: 4.4, released: "2020-09-17", metacritic: 93, developer: "Supergiant Games" },
  { id: 326243, name: "Elden Ring", genres: ["Action", "RPG"], rating: 4.4, released: "2022-02-25", metacritic: 94, developer: "FromSoftware" },
  { id: 9767, name: "Hollow Knight", genres: ["Platformer", "Indie"], rating: 4.4, released: "2017-02-24", metacritic: 87, developer: "Team Cherry" },
  { id: 13537, name: "Fallout Shelter", genres: ["Simulation"], rating: 3.6, released: "2015-06-14", metacritic: 71, developer: "Bethesda" },
  { id: 41494, name: "Cyberpunk 2077", genres: ["Action", "RPG"], rating: 4.1, released: "2020-12-10", metacritic: 86, developer: "CD Projekt Red" },
  { id: 10754, name: "Stardew Valley", genres: ["Simulation", "Indie"], rating: 4.4, released: "2016-02-26", metacritic: 89, developer: "ConcernedApe" },
  { id: 28, name: "Celeste", genres: ["Platformer", "Indie"], rating: 4.3, released: "2018-01-25", metacritic: 92, developer: "Maddy Makes Games" },
  { id: 58175, name: "Hitman", genres: ["Action", "Stealth"], rating: 4.0, released: "2016-03-11", metacritic: 84, developer: "IO Interactive" },
].map((g) => ({ ...g, image: img(g.id), description: `${g.name} is a game used by the RoninArc e2e suite.` }));

export const byName = (name) => {
  const game = CATALOG.find((g) => g.name === name);
  if (!game) throw new Error(`No catalog game named ${name}`);
  return game;
};
