import axios from "axios";
import AppError from "../../shared/errors/AppError";
import dotenv from "dotenv";
import { playtimeFor } from "./knownLengths";
import { discoverFilter, genreFilter, genresOf, stylesOf, type IgdbTagData } from "./igdbStyles";
import { moduleLogger } from "../../shared/logging/logger";
dotenv.config();

/**
 * The game database. Two ways in: the packaged app and the cloud go through keygate
 * (IGDB_BASE_URL + IGDB_API_KEY, a keygate token), and development can use a Twitch app directly
 * (IGDB_CLIENT_ID + IGDB_CLIENT_SECRET).
 */
const log = moduleLogger("igdb");
const IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";
const UNAVAILABLE_MESSAGE = "The game database isn't responding right now. Your library still works, so try again later.";
const OUTAGE_PAUSE_MS = 30_000;
/** IGDB allows 4 calls a second. */
const CALL_GAP_MS = Number(process.env.IGDB_CALL_GAP_MS ?? 260);
const CALL_TIMEOUT_MS = 12_000;

/** Real games: no fan mods, DLC, or a game's alternate releases. Theme 42 is adult content. */
const REAL_GAMES = "version_parent = null & game_type = (0,8,9,10,11) & themes != (42)";

const TAG_FIELDS = "keywords.slug,themes.slug,game_modes.slug,genres.slug,summary,storyline";
const CARD_FIELDS = `name,first_release_date,total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,cover.image_id,artworks.image_id,screenshots.image_id,${TAG_FIELDS}`;
const DETAIL_FIELDS = `${CARD_FIELDS},videos.video_id,websites.url,websites.type,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,platforms.name`;

const OFFICIAL_WEBSITE = 1;

let pausedUntil = 0;
let queue: Promise<unknown> = Promise.resolve();
let directToken: { token: string; expiresAt: number } | undefined;

/** IGDB itself is down or stalled, rather than refusing this one request. */
function isOutage(err: any): boolean {
  const status = err?.response?.status;
  return (!status && err?.isAxiosError) || status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 527);
}

function unavailable(err: any): AppError {
  if (err instanceof AppError) return err;
  log.warn({ status: err?.response?.status, code: err?.code }, "IGDB request failed");
  if (isOutage(err)) pausedUntil = Date.now() + OUTAGE_PAUSE_MS;
  return new AppError(UNAVAILABLE_MESSAGE, 502);
}

async function requestHeaders(): Promise<Record<string, string>> {
  const key = process.env.IGDB_API_KEY;
  if (key) return { Authorization: `Bearer ${key}` };
  const id = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) throw new AppError("The game database is not configured", 500);
  if (!directToken || directToken.expiresAt - 60_000 < Date.now()) {
    const { data } = await axios.post("https://id.twitch.tv/oauth2/token", null, {
      params: { client_id: id, client_secret: secret, grant_type: "client_credentials" },
      timeout: CALL_TIMEOUT_MS,
    });
    directToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  }
  return { Authorization: `Bearer ${directToken.token}`, "Client-ID": id };
}

async function send<T>(endpoint: string, body: string): Promise<T[]> {
  const url = `${process.env.IGDB_BASE_URL || "https://api.igdb.com/v4"}/${endpoint}`;
  const call = async () => axios.post(url, body, { headers: { ...(await requestHeaders()), "Content-Type": "text/plain", Accept: "application/json" }, timeout: CALL_TIMEOUT_MS });
  try {
    return (await call()).data;
  } catch (err: any) {
    // Over the per-second limit, or a dropped connection: worth one more try.
    if (err?.response?.status !== 429 && err?.response) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return (await call()).data;
  }
}

/** One call at a time, spaced out, so a big import can't trip the limit for everything else. */
function igdb<T = any>(endpoint: string, body: string): Promise<T[]> {
  if (Date.now() < pausedUntil) return Promise.reject(new AppError(UNAVAILABLE_MESSAGE, 502));
  const turn = queue.then(() => send<T>(endpoint, body));
  // The next call waits; this one's answer doesn't.
  queue = turn.catch(() => undefined).then(() => new Promise((resolve) => setTimeout(resolve, CALL_GAP_MS)));
  return turn.catch((err) => {
    throw unavailable(err);
  });
}

const image = (size: string, id: string) => `${IMAGE_BASE}/${size}/${id}.jpg`;

/**
 * Wide art for the app's wide cards. Screenshots first: "artworks" are often just a logo, which
 * crops to nonsense (Elden Ring's card read "EN R"). A portrait cover is the last resort.
 */
function wideImage(g: any): string | undefined {
  const wide = g.screenshots?.[0]?.image_id ?? g.artworks?.[0]?.image_id;
  if (wide) return image("t_screenshot_big", wide);
  return g.cover?.image_id ? image("t_cover_big", g.cover.image_id) : undefined;
}

/** A score from one or two reviews isn't a critical consensus (Cassette Beasts had "100"). */
const MIN_CRITIC_REVIEWS = 3;
const criticScore = (g: any) => (g.aggregated_rating && (g.aggregated_rating_count ?? 0) >= MIN_CRITIC_REVIEWS ? Math.round(g.aggregated_rating) : null);

const releaseDate = (g: any) => (g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null);

/** Ratings run 0-100 on IGDB; the app shows them out of 5. */
const communityRating = (g: any) => (g.total_rating ? Math.round((g.total_rating / 20) * 100) / 100 : 0);

function toCard(g: any, hours?: number) {
  return {
    id: g.id as number,
    name: g.name as string,
    imageURL: wideImage(g),
    rating: communityRating(g),
    released: releaseDate(g),
    genres: genresOf(g as IgdbTagData),
    tags: stylesOf(g as IgdbTagData),
    added: (g.total_rating_count ?? 0) as number,
    ratingsCount: (g.total_rating_count ?? 0) as number,
    criticScore: criticScore(g),
    avgHours: playtimeFor(g.name, hours),
  };
}

export type GameCard = ReturnType<typeof toCard>;

/** How long each game takes to finish, in hours, where IGDB knows. */
async function hoursFor(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await igdb("game_time_to_beats", `fields game_id,normally; where game_id = (${ids.join(",")}); limit 500;`);
  return new Map(rows.filter((r: any) => r.normally).map((r: any) => [r.game_id as number, Math.round(r.normally / 3600)]));
}

async function toCards(rows: any[]): Promise<GameCard[]> {
  const hours = await hoursFor(rows.map((r) => r.id)).catch(() => new Map<number, number>());
  return rows.map((r) => toCard(r, hours.get(r.id)));
}

const clean = (text: string) => text.replace(/[®™©"\\]/g, "").replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();

const SEARCH_PAGE = 20;

/**
 * IGDB's search doesn't forgive typos ("skyrimm" and "silksnog" find nothing), so `precise: false`
 * asks for titles containing the start of each long word, for the title matcher to rank.
 */
async function searchGames(query: string, page = 1, precise = true): Promise<GameCard[]> {
  const term = clean(query);
  if (!term) return [];
  if (precise) {
    return (await igdb("games", `search "${term}"; fields ${CARD_FIELDS}; where ${REAL_GAMES}; limit ${SEARCH_PAGE}; offset ${(page - 1) * SEARCH_PAGE};`)).map((row) => toCard(row));
  }
  const starts = term.split(" ").filter((word) => word.length >= 5).map((word) => word.slice(0, Math.ceil(word.length * 0.6)));
  if (starts.length === 0) return [];
  const where = starts.map((start) => `name ~ *"${start}"*`).join(" | ");
  return (await igdb("games", `fields ${CARD_FIELDS}; where ${REAL_GAMES} & (${where}) & total_rating_count != null; sort total_rating_count desc; limit ${SEARCH_PAGE};`)).map((row) => toCard(row));
}

const searchBestMatch = (query: string, _pageSize?: number) => searchGames(query, 1);

/** The most-rated games in any of these genres (or overall), or with any of these styles. */
async function discover(genres: string[], size = 40, styles: string[] = []): Promise<GameCard[]> {
  const byStyle = styles.map(discoverFilter).filter((f): f is string => !!f);
  const byGenre = genres.map(genreFilter).filter((f): f is string => !!f);
  const filters = byStyle.length > 0 ? byStyle : byGenre;
  const where = filters.length > 0 ? ` & (${filters.join(" | ")})` : "";
  return toCards(await igdb("games", `fields ${CARD_FIELDS}; where ${REAL_GAMES}${where} & total_rating_count != null; sort total_rating_count desc; limit ${size};`));
}

/** IGDB's own "games like this one". */
async function similarGames(id: number): Promise<GameCard[]> {
  const [game] = await igdb("games", `fields similar_games; where id = ${id};`);
  const ids: number[] = game?.similar_games ?? [];
  if (ids.length === 0) return [];
  const rows = await igdb("games", `fields ${CARD_FIELDS}; where id = (${ids.join(",")}) & ${REAL_GAMES}; limit 50;`);
  // Keep IGDB's order, closest first.
  return toCards(rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
}

function toDetails(g: any, hours?: number) {
  const companies = g.involved_companies ?? [];
  const names = (role: "developer" | "publisher") => companies.filter((c: any) => c[role] && c.company?.name).map((c: any) => c.company.name as string);
  return {
    ...toCard(g, hours),
    description: (g.summary ?? "") as string,
    imageAlt: g.cover?.image_id ? image("t_cover_big", g.cover.image_id) : undefined,
    screenshots: (g.screenshots ?? []).map((s: any) => image("t_screenshot_big", s.image_id)) as string[],
    trailers: (g.videos ?? []).map((v: any) => `https://www.youtube.com/watch?v=${v.video_id}`) as string[],
    website: ((g.websites ?? []).find((w: any) => w.type === OFFICIAL_WEBSITE)?.url ?? "") as string,
    playtime: playtimeFor(g.name, hours),
    platforms: (g.platforms ?? []).map((p: any) => p.name as string) as string[],
    developers: names("developer") as string[],
    publishers: names("publisher") as string[],
  };
}

export type GameDetails = ReturnType<typeof toDetails>;

async function getGameDetails(id: string | number): Promise<GameDetails> {
  if (!/^\d+$/.test(String(id))) throw new AppError("Game not found", 404);
  const [game] = await igdb("games", `fields ${DETAIL_FIELDS}; where id = ${id};`);
  if (!game) throw new AppError("Game not found", 404);
  const hours = await hoursFor([game.id]).catch(() => new Map<number, number>());
  return toDetails(game, hours.get(game.id));
}

export interface GameFacts {
  tags: string[];
  playtime: number;
  name?: string;
  released?: string | null;
  genres?: string[];
  developers?: string[];
}

/** Facts for a question about one game. Never throws: facts are a nicety. */
async function getGameFacts(id: string | number): Promise<GameFacts> {
  try {
    const details = await getGameDetails(id);
    return { tags: details.tags, playtime: details.playtime ?? 0, name: details.name, released: details.released, genres: details.genres, developers: details.developers };
  } catch {
    return { tags: [], playtime: 0 };
  }
}

const getGameTagSlugs = async (id: string | number) => (await getGameFacts(id)).tags;

/* ------------------------------------------------------------------ */
/* Bulk lookups, for filling in a whole library in a few calls          */
/* ------------------------------------------------------------------ */

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Everything to store about these games. 500 rows a call, so a big library takes one or two. */
async function detailsFor(ids: number[]): Promise<GameDetails[]> {
  const out: GameDetails[] = [];
  for (const batch of chunks([...new Set(ids)], 200)) {
    const rows = await igdb("games", `fields ${DETAIL_FIELDS}; where id = (${batch.join(",")}); limit 500;`);
    const hours = await hoursFor(rows.map((r) => r.id)).catch(() => new Map<number, number>());
    out.push(...rows.map((r) => toDetails(r, hours.get(r.id))));
  }
  return out;
}

/** Steam app id -> IGDB id. */
async function idsForSteamApps(appIds: string[]): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  for (const batch of chunks(appIds, 100)) {
    const rows = await igdb("external_games", `fields uid,game; where external_game_source = 1 & uid = (${batch.map((id) => `"${clean(id)}"`).join(",")}); limit 500;`);
    for (const row of rows) found.set(String(row.uid), row.game);
  }
  return found;
}

export interface NamedRow {
  id: number;
  name: string;
  alternativeNames: string[];
  ratingCount: number;
}

const toNamedRow = (r: any): NamedRow => ({ id: r.id, name: r.name, alternativeNames: (r.alternative_names ?? []).map((a: any) => a.name), ratingCount: r.total_rating_count ?? 0 });
const NAMED_FIELDS = "name,total_rating_count,alternative_names.name";

/**
 * When matching a game someone already owns, bundles and collections count too ("Snakebird Complete"),
 * and an exact title is safe where a search suggestion wouldn't be.
 */
const OWNABLE = "version_parent = null & themes != (42)";

/** Games with exactly one of these names (ignoring case), 40 names a call. */
async function gamesNamed(titles: string[], field: "name" | "alternative_names.name"): Promise<NamedRow[]> {
  const rows: NamedRow[] = [];
  for (const batch of chunks(titles.map(clean).filter(Boolean), 40)) {
    const where = batch.map((title) => `${field} ~ "${title}"`).join(" | ");
    rows.push(...(await igdb("games", `fields ${NAMED_FIELDS}; where (${where}) & ${OWNABLE}; limit 500;`)).map(toNamedRow));
  }
  return rows;
}

/** Search results for one title, for the names the bulk lookups can't find. */
const searchNamed = async (title: string): Promise<NamedRow[]> => {
  const term = clean(title);
  return term ? (await igdb("games", `search "${term}"; fields ${NAMED_FIELDS}; where ${OWNABLE}; limit 10;`)).map(toNamedRow) : [];
};

export default {
  searchGames,
  searchBestMatch,
  discover,
  similarGames,
  getGameDetails,
  getGameFacts,
  getGameTagSlugs,
  detailsFor,
  idsForSteamApps,
  gamesNamed,
  searchNamed,
};
