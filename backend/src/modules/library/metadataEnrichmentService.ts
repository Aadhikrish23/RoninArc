import gameLibrarymodel from "./LibraryGame";
import AppError from "../../shared/errors/AppError";
import igdbService, { type GameDetails, type NamedRow } from "../igdb/igdbService";
import { moduleLogger } from "../../shared/logging/logger";

/**
 * Fills in what a game's store doesn't give us (tags, ratings, length, art), a whole library at a
 * time. Imported games arrive with none of it, and recommendations and "which of my games are
 * co-op" have nothing to go on until this has run.
 */
const log = moduleLogger("enrichment");

/** A game IGDB couldn't match is tried again after this, as IGDB adds games all the time. */
const RETRY_FAILED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const norm = (title: string) =>
  String(title ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "Styx: Shards of Darkness - Deluxe Edition" is the game "Styx: Shards of Darkness". */
const EDITION = /\s*[-:–—]?\s*\b(?:(?:game of the year|goty|deluxe|complete|definitive|enhanced|ultimate|gold|special|standard|digital|anniversary|final cut|director'?s cut|midnight)\s+(?:edition|story|cut)|complete story|remastered|the final cut)\s*$/i;
const withoutEdition = (title: string) => title.replace(/[®™©]/g, "").replace(EDITION, "").trim();

const named = (row: NamedRow, title: string) => norm(row.name) === norm(title) || row.alternativeNames.some((alt) => norm(alt) === norm(title));
/** Same-named games ("Doom" 1993 and 2016): the one more people know. Exact title beats alternative name. */
const best = (rows: NamedRow[], title: string) =>
  rows
    .filter((row) => named(row, title))
    .sort((a, b) => Number(norm(b.name) === norm(title)) - Number(norm(a.name) === norm(title)) || b.ratingCount - a.ratingCount)[0];

/**
 * Library games to IGDB ids, in as few calls as possible, and only on an exact name: a wrong match
 * would give a game someone else's tags and art. Order: Steam app id, exact name, alternative name,
 * then one search per leftover.
 */
async function matchGames(games: any[]): Promise<Map<string, number>> {
  const matched = new Map<string, number>();
  const known = (game: any) => matched.has(String(game._id));
  for (const game of games) if (game.igdbId) matched.set(String(game._id), game.igdbId);

  const steam = games.filter((g) => !known(g) && g.providers?.steam?.providerGameId);
  if (steam.length > 0) {
    const ids = await igdbService.idsForSteamApps(steam.map((g) => String(g.providers.steam.providerGameId)));
    for (const game of steam) {
      const id = ids.get(String(game.providers.steam.providerGameId));
      if (id) matched.set(String(game._id), id);
    }
  }

  const passes: { field: "name" | "alternative_names.name"; title: (g: any) => string }[] = [
    { field: "name", title: (g) => g.title },
    { field: "name", title: (g) => withoutEdition(g.title) },
    { field: "alternative_names.name", title: (g) => g.title },
  ];
  for (const pass of passes) {
    const left = games.filter((g) => !known(g));
    if (left.length === 0) break;
    const rows = await igdbService.gamesNamed([...new Set(left.map(pass.title))], pass.field);
    for (const game of left) {
      const hit = best(rows, pass.title(game));
      if (hit) matched.set(String(game._id), hit.id);
    }
  }

  for (const game of games.filter((g) => !known(g))) {
    const rows = await igdbService.searchNamed(withoutEdition(game.title));
    const hit = best(rows, game.title) ?? best(rows, withoutEdition(game.title));
    if (hit) matched.set(String(game._id), hit.id);
  }
  return matched;
}

/** Fills gaps only: what a store or the player gave a game stays. */
function fieldsFor(game: any, details: GameDetails) {
  const set: Record<string, unknown> = {
    igdbId: details.id,
    styleTags: details.tags,
    screenshots: details.screenshots,
    trailers: details.trailers,
    communityRating: details.rating,
    criticScore: details.criticScore,
    website: details.website,
    playtime: details.playtime ?? 0,
    publishers: details.publishers,
    "metadataState.status": "complete",
    "metadataState.lastSuccess": new Date(),
    "metadataState.lastAttempt": new Date(),
  };
  if (!game.developer) set.developers = details.developers;
  // Epic often gives a game's title as its description.
  if (!game.description || norm(game.description) === norm(game.title)) set.description = details.description;
  if (!game.tags?.length) set.tags = details.genres;
  if (details.imageURL) {
    set["artwork.sources.igdb"] = details.imageURL;
    const sources = game.artwork?.sources ?? {};
    if (!sources[game.artwork?.selectedSource]) set["artwork.selectedSource"] = "igdb";
  }
  return set;
}

async function enrich(games: any[]) {
  const matched = await matchGames(games);
  const details = new Map((await igdbService.detailsFor([...matched.values()])).map((d) => [d.id, d]));
  const writes = games.map((game) => {
    const found = details.get(matched.get(String(game._id)) as number);
    return {
      updateOne: {
        filter: { _id: game._id },
        update: found
          ? { $set: fieldsFor(game, found), $unset: { "metadataState.lastError": "" } }
          : { $set: { "metadataState.status": "failed", "metadataState.lastAttempt": new Date(), "metadataState.lastError": "No exact match in the game database" } },
      },
    };
  });
  if (writes.length > 0) await gameLibrarymodel.bulkWrite(writes as any);
  return { games: games.length, matched: details.size };
}

const running = new Set<string>();

/** Games in this library still waiting, or that failed a while ago. */
const waiting = (userId: string) =>
  gameLibrarymodel
    .find({
      userId,
      $or: [
        { "metadataState.status": { $in: ["none", "pending", "enriching", null] } },
        { "metadataState.status": { $exists: false } },
        { "metadataState.status": "failed", "metadataState.lastAttempt": { $lt: new Date(Date.now() - RETRY_FAILED_AFTER_MS) } },
        // Enriched before tags were stored (or from the old database).
        { "metadataState.status": "complete", igdbId: { $in: [null] } },
      ],
    })
    .lean();

class MetadataEnrichmentService {
  /** One game, right now, whatever state it's in. */
  public async enrichGame(userId: string, gameId: string) {
    const game = await gameLibrarymodel.findOne({ _id: gameId, userId }).lean();
    if (!game) throw new AppError("Game not found", 404);
    try {
      await enrich([game]);
    } catch (err: any) {
      // An outage isn't this game's fault: it stays waiting, for next time.
      log.warn({ err: err?.message }, "Couldn't enrich a game");
    }
    return (await gameLibrarymodel.findOne({ _id: gameId, userId }))?.toObject();
  }

  /** Everything waiting in one library. One run per library at a time. Never throws. */
  public async enrichLibrary(userId: string) {
    if (running.has(userId)) return;
    running.add(userId);
    try {
      const games = await waiting(userId);
      if (games.length === 0) return;
      const started = Date.now();
      const result = await enrich(games);
      log.info({ ...result, ms: Date.now() - started }, "Library enriched");
    } catch (err: any) {
      log.warn({ err: err?.message }, "Library enrichment stopped; it'll try again next time");
    } finally {
      running.delete(userId);
    }
  }

  /** At startup: catches up every library on this PC, one after another. */
  public async enrichAllLibraries() {
    const users = await gameLibrarymodel.distinct("userId", { $or: [{ igdbId: null }, { "metadataState.status": { $ne: "complete" } }] });
    for (const userId of users) await this.enrichLibrary(String(userId));
  }
}

export default new MetadataEnrichmentService();
