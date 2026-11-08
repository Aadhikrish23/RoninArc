/**
 * Play styles the app talks about ("souls-like", "cozy"), and how they're found on IGDB. IGDB has
 * no one list of these: they live across its keywords, themes, game modes and genres.
 */

export interface IgdbTagData {
  keywords?: { slug: string }[];
  themes?: { slug: string }[];
  game_modes?: { slug: string }[];
  genres?: { slug: string }[];
  summary?: string;
  storyline?: string;
}

interface StyleSource {
  keywords?: string[];
  themes?: string[];
  modes?: string[];
  genres?: string[];
  /** Indie games often say it in their description and carry no tag for it. */
  text?: RegExp;
}

/** What counts when tagging a game. Deliberately broad: "what cozy games do I own" should miss little. */
const STYLES: Record<string, StyleSource> = {
  roguelike: { keywords: ["roguelike", "roguelite", "action-roguelite", "action-roguelike", "traditional-roguelike", "roguelike-platform", "roguelike-deckbuilder"], text: /\brogue-?(like|lite)\b/i },
  "souls-like": { keywords: ["soulslike"], text: /\bsouls-?(like|lite)\b/i },
  metroidvania: { keywords: ["metroidvania", "cozy-metroidvania"], text: /\bmetroidvania\b/i },
  cozy: { keywords: ["cozy", "cosy", "cozy-adventure", "relaxing", "wholesome", "life-simulation", "farming", "gardening"], text: /\b(cozy|cosy)\b/i },
  "co-op": { modes: ["co-operative"], keywords: ["online-co-op", "couch-co-op", "local-co-op", "online-coop"] },
  "story-rich": { keywords: ["story-rich", "story-driven", "story-driven-rpg", "narrative", "narrative-driven", "interactive-story", "choices-matter", "choice-matters", "meaningful-choices", "branching-storyline"], themes: ["drama"], genres: ["visual-novel"] },
  horror: { themes: ["horror"], keywords: ["psychological-horror", "survival-horror", "cosmic-horror"] },
  survival: { themes: ["survival"], keywords: ["crafting-survival", "open-world-survival-craft", "survival-sandbox"] },
  stealth: { themes: ["stealth"], keywords: ["shadow-stealth", "active-stealth"] },
  "turn-based": { genres: ["turn-based-strategy-tbs"], keywords: ["turn-based", "turn-based-combat", "turn-based-rpg", "turn-based-tactics", "turn-based-strategy", "tactical-turn-based-combat"] },
  deckbuilding: { keywords: ["deck-building--1", "roguelike-deckbuilder", "deckbuilder", "deckbuilding", "deck-building"], text: /\bdeck-?build/i },
  farming: { keywords: ["farming", "farming-simulator", "gardening"] },
  "open-world": { themes: ["open-world"], keywords: ["open-world-survival-craft"] },
  jrpg: { keywords: ["jrpg"], text: /\bjrpg\b/i },
  // Facts rather than styles, for questions like "which of my games are multiplayer".
  multiplayer: { modes: ["multiplayer", "massively-multiplayer-online-mmo", "battle-royale"] },
  "split-screen": { modes: ["split-screen"], keywords: ["couch-co-op", "local-co-op"] },
  singleplayer: { modes: ["single-player"] },
  difficult: { keywords: ["difficult", "soulslike"] },
};

/**
 * What counts when looking for new games, where the most-rated match comes first. Broad tags fail
 * here: the "horror" theme led with The Last of Us and Half-Life 2, and "farming" with Demon's Souls.
 */
const DISCOVER: Record<string, StyleSource> = {
  roguelike: STYLES.roguelike,
  "souls-like": { keywords: ["soulslike"] },
  metroidvania: { keywords: ["metroidvania", "cozy-metroidvania"] },
  cozy: { keywords: ["cozy", "cosy", "cozy-adventure", "wholesome"] },
  "co-op": { keywords: ["online-co-op", "couch-co-op", "local-co-op", "online-coop", "co-op-horror"] },
  "story-rich": { keywords: ["story-rich", "story-driven", "story-driven-rpg", "interactive-story", "narrative-driven", "choices-matter"] },
  horror: { keywords: ["psychological-horror", "survival-horror", "cosmic-horror", "first-person-horror", "atmospheric-horror", "gothic-horror", "supernatural-horror", "co-op-horror", "body-horror"] },
  survival: { keywords: ["open-world-survival-craft", "crafting-survival", "survival-sandbox", "survival-simulator", "survival-adventure", "survival-rpg", "survival-games", "survival-island"] },
  stealth: { keywords: ["active-stealth", "shadow-stealth", "sneaking-mission", "stealth-camouflage"] },
  "turn-based": { keywords: ["turn-based", "turn-based-tactics", "turn-based-rpg", "turn-based-strategy", "turn-based-combat", "tactical-turn-based-combat"] },
  deckbuilding: { keywords: ["deckbuilder", "deck-building--1", "roguelike-deckbuilder", "deck-building", "deckbuilding"] },
  farming: { keywords: ["farming", "farming-simulator"] },
  "open-world": { themes: ["open-world"] },
  jrpg: { keywords: ["jrpg"] },
};

/**
 * The tag alone lets in well-rated games that aren't really that: Arkham City and Dark Souls II as
 * metroidvanias, Rust as cozy, Far Cry 2 as a roguelike.
 */
const DISCOVER_ALSO: Record<string, string> = {
  metroidvania: `genres.slug = ("platform")`,
  cozy: `themes.slug != ("horror","survival","warfare") & game_modes.slug != ("massively-multiplayer-online-mmo")`,
  roguelike: `themes.slug != ("open-world")`,
};

/** IGDB's genres and modes under the genre names the app shows and builds taste profiles from. */
const GENRE_NAMES: Record<string, string> = {
  adventure: "Adventure",
  indie: "Indie",
  "role-playing-rpg": "RPG",
  strategy: "Strategy",
  puzzle: "Puzzle",
  simulator: "Simulation",
  shooter: "Shooter",
  arcade: "Arcade",
  platform: "Platformer",
  "turn-based-strategy-tbs": "Strategy",
  tactical: "Strategy",
  "real-time-strategy-rts": "Strategy",
  "hack-and-slash-beat-em-up": "Action",
  "card-and-board-game": "Card",
  racing: "Racing",
  sport: "Sports",
  fighting: "Fighting",
  "visual-novel": "Adventure",
  "point-and-click": "Adventure",
  music: "Arcade",
  moba: "Strategy",
};

/** The reverse, for finding new games in a genre the user likes. */
const GENRE_FILTERS: Record<string, string> = {
  Action: `themes.slug = ("action")`,
  Adventure: `genres.slug = ("adventure","point-and-click","visual-novel")`,
  Indie: `genres.slug = ("indie")`,
  RPG: `genres.slug = ("role-playing-rpg")`,
  Strategy: `genres.slug = ("strategy","turn-based-strategy-tbs","tactical","real-time-strategy-rts")`,
  Puzzle: `genres.slug = ("puzzle")`,
  Simulation: `genres.slug = ("simulator")`,
  Shooter: `genres.slug = ("shooter")`,
  Arcade: `genres.slug = ("arcade","music")`,
  Platformer: `genres.slug = ("platform")`,
  Card: `genres.slug = ("card-and-board-game")`,
  Racing: `genres.slug = ("racing")`,
  Sports: `genres.slug = ("sport")`,
  Fighting: `genres.slug = ("fighting")`,
  Family: `themes.slug = ("kids")`,
  "Massively Multiplayer": `game_modes.slug = ("massively-multiplayer-online-mmo")`,
};

export const KNOWN_GENRES = Object.keys(GENRE_FILTERS);

const slugs = (list?: { slug: string }[]) => (list ?? []).map((item) => item.slug);

function matches(game: IgdbTagData, style: StyleSource): boolean {
  const has = (wanted: string[] | undefined, own: string[]) => (wanted ?? []).some((slug) => own.includes(slug));
  return (
    has(style.keywords, slugs(game.keywords)) ||
    has(style.themes, slugs(game.themes)) ||
    has(style.modes, slugs(game.game_modes)) ||
    has(style.genres, slugs(game.genres)) ||
    (!!style.text && style.text.test(`${game.summary ?? ""} ${game.storyline ?? ""}`))
  );
}

/** The styles a game has. "roguelite" is the same set as "roguelike": players use the two loosely. */
export function stylesOf(game: IgdbTagData): string[] {
  const styles = Object.keys(STYLES).filter((name) => matches(game, STYLES[name]));
  return styles.includes("roguelike") ? [...styles, "roguelite"] : styles;
}

/** A game's genres, under the names the app uses. */
export function genresOf(game: IgdbTagData): string[] {
  const names = new Set(slugs(game.genres).map((slug) => GENRE_NAMES[slug]).filter(Boolean));
  if (slugs(game.themes).includes("action")) names.add("Action");
  if (slugs(game.themes).includes("kids")) names.add("Family");
  if (slugs(game.game_modes).includes("massively-multiplayer-online-mmo")) names.add("Massively Multiplayer");
  return [...names];
}

const quoted = (list: string[]) => list.map((item) => `"${item}"`).join(",");

/** An IGDB filter for new games with this style, or nothing for a style it can't look up. */
export function discoverFilter(style: string): string | undefined {
  const source = DISCOVER[style === "roguelite" ? "roguelike" : style];
  if (!source) return undefined;
  const parts = [
    ...(source.keywords?.length ? [`keywords.slug = (${quoted(source.keywords)})`] : []),
    ...(source.themes?.length ? [`themes.slug = (${quoted(source.themes)})`] : []),
  ];
  if (parts.length === 0) return undefined;
  const also = DISCOVER_ALSO[style === "roguelite" ? "roguelike" : style];
  return `((${parts.join(" | ")})${also ? ` & ${also}` : ""})`;
}

export const genreFilter = (genre: string): string | undefined => (Object.prototype.hasOwnProperty.call(GENRE_FILTERS, genre) ? GENRE_FILTERS[genre] : undefined);
