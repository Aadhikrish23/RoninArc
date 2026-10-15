import { AIToolContext } from "../sdk/AIToolContext";
import { Capability } from "../planning/Capability";
import type { LibrarySnapshot } from "../context/LibrarySnapshot";
import type { Exchange } from "../conversation/RecentExchanges";

export interface PromptExtras {
  library?: LibrarySnapshot;
  recentExchanges?: Exchange[];
}

interface FewShotExample {
  id: string;
  capabilityId?: string;
  keywords: string[];
  text: string;
}

export class PromptBuilder {
  private readonly examples: FewShotExample[] = [
    {
      id: "set-status",
      capabilityId: "set-status",
      keywords: [],
      text: `User Request: set rdr2 to paused, taking a break from it
Response JSON:
{
  "intents": [
    {
      "type": "SetStatus",
      "targets": [{ "type": "Game", "name": "Red Dead Redemption 2" }],
      "parameters": [{ "type": "Status", "value": "paused" }]
    }
  ]
}`
    },
    {
      id: "add-then-status",
      capabilityId: "add-game",
      keywords: [],
      text: `User Request: I finished celeste last night (Celeste is not in the library)
Response JSON:
{
  "intents": [
    { "type": "AddGame", "targets": [{ "type": "Library", "name": "Celeste" }], "parameters": [] },
    { "type": "SetStatus", "targets": [{ "type": "Game", "name": "Celeste" }], "parameters": [{ "type": "Status", "value": "completed" }] }
  ]
}`
    },
    {
      id: "rate-with-text",
      capabilityId: "review-game",
      keywords: [],
      text: `User Request: rate hollow knight 9 it was amazing
Response JSON:
{
  "intents": [
    {
      "type": "RateGame",
      "targets": [{ "type": "Game", "name": "Hollow Knight" }],
      "parameters": [{ "type": "Rating", "value": 9 }, { "type": "Text", "value": "it was amazing" }]
    }
  ]
}`
    },
    {
      id: "library-question",
      capabilityId: "library-question",
      keywords: [],
      text: `User Request: what's in my backlog?
Response JSON:
{
  "intents": [
    { "type": "LibraryQuestion", "targets": [], "parameters": [{ "type": "Text", "value": "what's in my backlog?" }] }
  ]
}`
    },
    {
      id: "game-question",
      capabilityId: "library-question",
      keywords: [],
      text: `User Request: what did i rate witcher 3?
Response JSON:
{
  "intents": [
    { "type": "LibraryQuestion", "targets": [], "parameters": [{ "type": "Text", "value": "what did i rate witcher 3?" }] }
  ]
}`
    },
    {
      id: "gibberish",
      keywords: [],
      text: `User Request: asdfgh
Response JSON:
{
  "intents": [
    { "type": "AskQuestion", "targets": [], "parameters": [{ "type": "Text", "value": "I didn't catch that. What would you like to do?" }] }
  ]
}`
    },
    {
      id: "ask-question",
      keywords: [],
      text: `User Request: is elden ring too hard for someone new to soulslikes?
Response JSON:
{
  "intents": [
    {
      "type": "AskQuestion",
      "targets": [],
      "parameters": [{ "type": "Text", "value": "It's challenging, but it's the most beginner-friendly soulslike: you can explore elsewhere when a boss is too hard, summon spirit ashes for help, and level up. Take it slow and it's very doable." }]
    }
  ]
}`
    },
    {
      id: "unsupported",
      keywords: [],
      text: `User Request: can u buy hades 2 for me on steam
Response JSON:
{
  "intents": [
    {
      "type": "AskQuestion",
      "targets": [],
      "parameters": [{ "type": "Text", "value": "I can't buy games for you. I can add Hades II to your library as Plan to Play so you remember it -- just say \\"add Hades II\\"." }]
    }
  ]
}`
    },
    {
      id: "launch",
      capabilityId: "launch-game",
      keywords: ["launch", "start", "run", "play", "open", "again"],
      text: `User Request: Launch Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "LaunchGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "complete",
      capabilityId: "complete-game",
      keywords: ["complete", "finish", "done", "ended", "completed"],
      text: `User Request: Complete Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "CompleteGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Status",
          "value": "completed"
        }
      ]
    }
  ]
}`
    },
    {
      id: "rate",
      capabilityId: "review-game",
      keywords: ["rate", "rating", "score"],
      text: `User Request: Rate Fallout Shelter 9
Response JSON:
{
  "intents": [
    {
      "type": "RateGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Rating",
          "value": 9
        }
      ]
    }
  ]
}`
    },
    {
      id: "review",
      capabilityId: "review-game",
      keywords: ["review", "opinion", "stars"],
      text: `User Request: Review Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "ReviewGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "add-game",
      capabilityId: "add-game",
      keywords: ["add", "install", "get", "download"],
      text: `User Request: Add Hollow Knight to my library
Response JSON:
{
  "intents": [
    {
      "type": "AddGame",
      "targets": [
        {
          "type": "Library",
          "name": "Hollow Knight"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "remove-game",
      capabilityId: "remove-game",
      keywords: ["remove", "delete", "uninstall"],
      text: `User Request: Remove Hollow Knight from my library
Response JSON:
{
  "intents": [
    {
      "type": "RemoveGame",
      "targets": [
        {
          "type": "Game",
          "name": "Hollow Knight"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "search-library",
      capabilityId: "search-library",
      keywords: ["search", "find"],
      text: `User Request: Search my library for RPGs
Response JSON:
{
  "intents": [
    {
      "type": "SearchLibrary",
      "targets": [],
      "parameters": [
        {
          "type": "Text",
          "value": "RPG"
        }
      ]
    }
  ]
}`
    },
    {
      id: "add-note",
      capabilityId: "add-note",
      keywords: ["note", "remember", "jot", "memo"],
      text: `User Request: Note that the boss fight needs a fire resistance build for Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "AddNote",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Text",
          "value": "The boss fight needs a fire resistance build"
        }
      ]
    }
  ]
}`
    },
    {
      id: "recommend-games",
      capabilityId: "recommend-games",
      keywords: ["recommend", "suggest", "what should i play", "what to play", "next"],
      text: `User Request: Recommend me something like Hollow Knight to play next
Response JSON:
{
  "intents": [
    {
      "type": "RecommendGame",
      "targets": [],
      "parameters": [
        {
          "type": "Text",
          "value": "like Hollow Knight"
        }
      ]
    }
  ]
}`
    },
    {
      id: "delete-review",
      capabilityId: "review-game",
      keywords: ["delete", "remove review", "erase review"],
      text: `User Request: Delete my review for Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "DeleteReview",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "create-collection",
      capabilityId: "collection",
      keywords: ["create", "collection", "group"],
      text: `User Request: Create RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "CreateCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "bulk-add",
      capabilityId: "collection",
      keywords: ["add", "all", "collection"],
      text: `User Request: Add all Batman games to Batman Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "Batman Collection"
        },
        {
          "type": "Game",
          "name": "all Batman games"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "bulk-remove",
      capabilityId: "collection",
      keywords: ["remove", "all", "collection"],
      text: `User Request: Remove all Batman games from Batman Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "Batman Collection"
        },
        {
          "type": "Game",
          "name": "all Batman games"
        }
      ],
      "parameters": [
        {
          "type": "Boolean",
          "value": false
        }
      ]
    }
  ]
}`
    },
    {
      id: "connect",
      keywords: ["connect", "disconnect", "sync", "epic", "steam", "gog", "ea", "ubisoft", "xbox"],
      text: `User Request: Connect Epic
Response JSON:
{
  "intents": [
    {
      "type": "ConnectAccount",
      "targets": [
        {
          "type": "Provider",
          "name": "epic"
        }
      ],
      "parameters": [
        {
          "type": "Provider",
          "value": "epic"
        }
      ]
    }
  ]
}`
    },
    {
      id: "add-to-collection",
      capabilityId: "collection",
      keywords: ["add", "collection", "group"],
      text: `User Request: Add Fallout Shelter to RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        },
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "remove-from-collection",
      capabilityId: "collection",
      keywords: ["remove", "delete", "collection", "group"],
      text: `User Request: Remove Fallout Shelter from RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        },
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Boolean",
          "value": false
        }
      ]
    }
  ]
}`
    }
  ];

  /**
   * The prompt that turns one user message into intents. Every capability and
   * example is always included: picking them by keyword (an earlier version)
   * matched "ea" inside "dead" and left the model guessing, which once turned
   * "change red dead redemption 2 status to paused" into a removal.
   */
  build(
    request: string,
    context: AIToolContext,
    capabilities: Capability[],
    extras: PromptExtras = {},
  ): string {
    const capabilityDetails = capabilities
      .map((cap) => `- Goal: ${cap.name}\n  Description: ${cap.description}`)
      .join("\n\n");

    const fewShotExamplesText = this.examples.map((ex) => ex.text).join("\n\n");

    const library = extras.library;
    const libraryText = library
      ? [
          `The user has ${library.totalGames} game(s). Newest first (title — status):`,
          ...(library.games.length > 0 ? library.games.map((g) => `- ${g.title} — ${g.status}`) : ["- (empty)"]),
          library.totalGames > library.games.length ? `- …and ${library.totalGames - library.games.length} older games` : "",
          `Collections: ${library.collections.length > 0 ? library.collections.join(", ") : "(none)"}`,
        ].filter(Boolean).join("\n")
      : "(not available)";

    const exchanges = extras.recentExchanges ?? [];
    const conversationText = exchanges.length > 0
      ? exchanges.map((e) => `User: ${e.user}\nAssistant: ${e.assistant}`).join("\n")
      : "(this is the first message)";

    return `You are RoninArc AI, the assistant inside a PC game library app. You help the user manage their games, statuses, ratings, notes, collections and recommendations, and you answer gaming questions briefly.

Available Capabilities:
${capabilityDetails}

How to map requests:
- Status changes use intent "SetStatus" with a "Status" parameter whose value is exactly one of: plan, playing, paused, completed, dropped, none. "taking a break", "pause", "on hold" -> paused. "started", "playing again", "back to playing" -> playing. "finished", "beat", "done with" -> completed (or intent "CompleteGame"). "gave up", "drop" -> dropped. "want to play", "later", "backlog it" -> plan.
- NEVER use "RemoveGame" unless the user explicitly asks to remove or delete a game from their library. Changing a status is never a removal.
- "Add Game" uses intent "AddGame"; its target type MUST be "Library" with the game's full official title (expand abbreviations: "rdr 2" -> "Red Dead Redemption 2", "ds3" -> "Dark Souls III").
- If the user says they finished, are playing, or paused a game that is NOT in their library, return two intents in this order: "AddGame" for it, then "SetStatus" with the status.
- A plain "add X" is ONE "AddGame" intent and nothing else: new games start as Plan to Play. Only add a "SetStatus" when the user actually states a status in this message.
- If one message asks for several things, return one intent per thing, in the order the user said them. Several games for the same action ("add A and B to X") means one intent per game.
- "and X too", "X as well", "same for X" repeat the previous action from the recent conversation for X (e.g. if the last thing was adding to the "Soulslikes" collection, add X to "Soulslikes").
- Collections: "take X out of / remove X from <collection>" is "OrganizeCollection" with a "Boolean" false parameter; adding is "OrganizeCollection" with no Boolean. "this collection" / "in there" / "it" means the collection the conversation is about. Removing from a collection never removes the game from the library.
- If the user rates or reviews a game and says they finished or beat it, also add "SetStatus" completed.
- "Review Game": use "RateGame" with a "Rating" parameter (1-10) when a number is given; put the user's own opinion words from THIS message in a "Text" parameter on the same intent. If they wrote no opinion, leave "Text" out. Never copy text from the examples. Use "ReviewGame" for a text review without a number, "DeleteReview" to delete a review.
- "Remove Game" maps to "RemoveGame" with a Game target that is in the user's library.
- "Add Note" maps to "AddNote" with a Game target and a "Text" parameter holding the note.
- "Manage Collection" maps to "CreateCollection" (Collection target) or "OrganizeCollection" (Collection target plus Game targets; add a "Boolean" false parameter to remove from the collection). "in there" / "to it" means the collection the conversation was just about.
- "Search Library" maps to "SearchLibrary" with a "Text" parameter, for finding games by title, tag or genre.
- "Library Question" maps to "LibraryQuestion" with the user's question in a "Text" parameter: anything asking about their own library, e.g. what's in my backlog, how many games do I have, what am I playing, what have I finished, what did I add recently, my top rated games, AND questions about what the user has recorded for one game ("what did I rate Witcher 3?", "is Celeste finished?"). Questions about the game itself (difficulty, length, story, classes, tips) are "AskQuestion", not "LibraryQuestion". A question NEVER becomes RateGame, SetStatus or any other change.
- If one message asks for a change AND asks a question, return both: the change intent(s) and a "LibraryQuestion" (or "AskQuestion") for the question.
- If the message is gibberish, a keyboard mash, or you can't tell what the user wants, return ONLY an "AskQuestion" whose "Text" asks them to rephrase. Never guess a game or an action.
- Only target games the user named in this message, or clearly referred to ("it", "that one") from the recent conversation. Never pick a game just because it is in the library or was added recently.
- "Recommend Games" maps to "RecommendGame" for "what should I play / recommend / suggest". Put every hint and constraint in one "Text" parameter (e.g. "like Hades, short, 2 hours tonight"). Use no targets.
- "Launch Game" maps to "LaunchGame" only when the user wants to start playing a game now. "pause X" is a status change, not a launch.
- General gaming questions and small talk (e.g. "is elden ring hard for beginners?") use intent "AskQuestion" with a "Text" parameter containing YOUR answer: two or three friendly, factual sentences. Be accurate; if you're not sure of a number (like hours to beat), give a cautious range and say it varies. You can't check live prices, sales or store pages; say so when asked.
- Requests the app cannot do (buying or paying for games, downloading or installing, refunds, talking to other people, anything outside the user's library) use intent "AskQuestion" with a "Text" parameter that says briefly that you can't do that and offers the closest thing you can do (e.g. "I can't buy games, but I can add Hades II to your library as Plan to Play if you like."). Never turn "buy" into "AddGame".
- Use "Help" only when the user asks what you can do.

Naming games and collections:
- When the user refers to a game in their library, use its exact title from the library list below, even if they abbreviate it ("ds3", "rdr2", "botw") or misspell it.
- Pronouns like "it", "that one", "the game" mean the game the recent conversation was about (usually the one named or added most recently), NOT some other game. Write the actual title as the target name, never "it".
- "the last game I added" is the first game in the library list (it is newest first).

User's library:
${libraryText}

Recent conversation:
${conversationText}

User Request:
${request}

Instruction:
Return ONLY a valid JSON object with the structure below. No markdown fences, no explanations, no text before or after.

Allowed Enum Values:
- intent type: CompleteGame, SetStatus, LaunchGame, RateGame, ReviewGame, DeleteReview, AddGame, RemoveGame, SearchLibrary, LibraryQuestion, AddNote, RecommendGame, CreateCollection, OrganizeCollection, SyncLibrary, ConnectAccount, DisconnectAccount, AskQuestion, Help
- target type: Game, Collection, Provider, Library, Review
- parameter type: Rating, Status, Platform, Provider, Date, Boolean, Text

Strict Constraints:
1. Output ONLY valid JSON starting with { and ending with }.
2. Never output markdown code fences.
3. Never output values outside the allowed enums, and never combine enum values.
4. Preserve user supplied values (ratings, note text) exactly.
5. If the request does not name a game or collection and the conversation doesn't make one clear, omit that target -- never invent a name, and never use an action word ("Launch", "Rate") or a category word ("Game", "Collection") as a name.

JSON Structure:
{
  "intents": [
    {
      "type": "<one of the allowed intent types>",
      "targets": [
        { "type": "<one of the allowed target types>", "name": "<exact title or name>" }
      ],
      "parameters": [
        { "type": "<one of the allowed parameter types>", "value": <string or number or boolean> }
      ]
    }
  ]
}

Few-shot Examples:

${fewShotExamplesText}`;
  }
}

export default new PromptBuilder();
