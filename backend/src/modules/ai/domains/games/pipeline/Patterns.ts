import { IntentType } from "../intent/IntentType";

/** "wait no, I said celeste" -- the reply should own the mistake. */
export const CORRECTION = /\b(i said|i meant|wrong (game|one)|didn'?t ask|not that one|wait,? no|that'?s wrong|no,? i)\b/i;

/** A status or rating for a game that isn't in the library means "add it, then do that". */
export const AUTO_ADD_FOR = new Set<string>([IntentType.SetStatus, IntentType.CompleteGame, IntentType.RateGame, IntentType.ReviewGame]);

/** Questions about what the user has recorded; anything else is a general gaming question. */
export const RECORDED_DATA = /\b(rate|rated|rating|ratings|score|status|finish|finished|complete|completed|beat|beaten|playing|paused|dropped|planned|plan to play|backlog|how many|own|owned|have i|in my (library|list)|added|note|notes|collection|collections|top rated|favou?rites?)\b/i;
/**
 * Asking for advice about playing a game ("can i beat malenia at level 2?", "how do i beat ornstein",
 * "tips for the final boss"): always a general question for answer mode, even though "beat" also
 * reads as recorded data and the model sometimes answers it with "I can't check that".
 */
export const GAME_ADVICE =
  /\b(?:can|could|should|would)\s+(?:i|you|someone|a\s+\w+)\s+(?:even\s+|still\s+|actually\s+)?(?:beat|defeat|kill|solo|cheese|finish|complete|clear)\b|\bhow\s+(?:do|can|should|would|to)\s+(?:i\s+|you\s+)?(?:beat|defeat|kill|solo|cheese|get past|deal with)\b|\b(?:tips?|advice|strategy|build)\s+(?:for|against|to beat)\b|\bat\s+(?:level|lvl|rl|sl)\s*\d+/i;
export const LOOKS_LIKE_QUESTION = /\?\s*$|^(what|whats|what's|how|is|are|should|which|why|does|do|can|could|would|who|when|where|any)\b/i;
/** The model's own short replies that are better than a fresh answer: refusals, "didn't catch that". */
export const KEEP_MODEL_REPLY = /\b(can'?t|cannot|didn'?t catch|not sure what|rephrase)\b/i;

/** Intents that act on one game at a time; a multi-game one is split per game. */
export const PER_GAME_INTENTS = new Set<string>([
  IntentType.OrganizeCollection, IntentType.SetStatus, IntentType.CompleteGame, IntentType.RateGame,
  IntentType.ReviewGame, IntentType.DeleteReview, IntentType.RemoveGame, IntentType.AddNote, IntentType.AddGame,
]);

/** Asking for suggestions, and the words that mean "do something" instead. */
export const RECOMMEND_ASK = /\b(recommend|suggest|similar to|something like|anything like|games? like|what should i play|what to play)\b|\b(something|anything|a game)\b[^?.!]*\bweekend\b|\b(something|anything|a game|smth)\s+(chill|relaxing|cozy|cosy|comfy|short|quick|light|easy|calm|mindless)\b|\b(want|need|feel like|in the mood for)\s+(something|anything|a game)\b/i;
export const EXPLICIT_ACTION = /\b(add|put|mark|set|remove|delete|rate|note|pause|drop|launch|yeet|move|take)\b/i;

/** An answer-mode reply saying it changed something ("I've added X", "I marked it ...") -- it can't have. */
export const CLAIMS_ACTION =
  /\bI(?:'ve| have)?\s+(?:just\s+|now\s+|also\s+)?(?:added|removed|marked|rated|created|deleted|updated|included|put|moved|set|changed|renamed|dropped|paused)\b/i;

/** The model offering an add in its own words: "I can add Silksong to your library ..." */
export const OFFER_ADD = /\bI can (?:add|put) ("?[^".?!]{2,60}?"?) (?:to|in|into) your (?:library|backlog)\b/i;

/** Words that ask for the review text itself to change, not just the score. */
export const REWRITES_REVIEW = /\breview\b|\b(change|update|edit|replace|rewrite)\b[^.?!]*\b(comment|text|what i wrote)\b/i;

export const NOT_SURE_WHICH_GAME =
  "I'm not sure which game you mean, so I didn't change anything. Tell me the game's name and I'll do it.";

export const NOT_SURE_WHAT_TO_CHANGE =
  "I'm not sure what you'd like me to change, so I left everything as it is. Could you say it another way?";

/** Status words the model may use as their own intents; all become SetStatus. */
export const STATUS_INTENTS: Partial<Record<string, string>> = {
  [IntentType.StartGame]: "playing",
  [IntentType.PauseGame]: "paused",
  [IntentType.DropGame]: "dropped",
};
