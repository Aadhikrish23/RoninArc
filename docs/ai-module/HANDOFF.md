# The RoninArc AI module: adding a new domain (e.g. books)

This explains RoninArc's AI assistant and how to give it a new world (books, movies, recipes) by writing a **domain pack**, the way RoninArc's games pack works. The bundle you received contains:

| Folder | What |
|---|---|
| `core/` | The reusable AI module. Copy it into your backend as `src/modules/ai/`. |
| `reference/games-pack/` | RoninArc's games pack: the working example to model yours on. It imports RoninArc's own modules (library, RAWG, Mongo models), so read it; don't compile it. |
| `shared/errors/AppError.ts` | The one file the core imports from outside itself. |
| `shared/types/express.d.ts` | Adds `req.user = { id, name }` to Express's request type (what your auth middleware must set). |
| `reference/ai-core-purity.spec.ts` | RoninArc's test that keeps core and pack apart, to adapt. |
| `PROMPT.md` | A brief to hand to an AI coding agent working in the books app. |

---

## 1. What the assistant does

Someone types "add dune and mark it as reading", "rate project hail mary 9, loved it", "what should I read next?", "undo that". The assistant:

1. **Reads the message.** Fixes slang and typos, and resolves "the second one" or "it".
2. **Handles what it can without the model:** questions answered from the user's data, plain commands, undo. This is fast, works offline, and is cheaper.
3. **Otherwise asks the model for a plan:** a list of *intents* (`AddBook`, `SetStatus`, `RateBook`...) with *targets* (which book) and *parameters* (rating, text...).
4. **Checks the plan against the user's own words:**
   - drops things the message never asked for
   - only acts on items the user named or clearly referred to
   - splits "add A and B" into one step per item
5. **Plans and runs it.** Intents map to capabilities, then to tools. Item names resolve to real records; if a name is ambiguous, it asks which one. Destructive steps ask "are you sure?" first. Then the tools run.
6. **Replies in plain sentences**, offers a sensible next step ("Want me to mark it Finished?"), and remembers the change so "undo" can put it back.

For questions it doesn't plan at all. It **answers** them: a second, plain-text model call, guarded so it can never claim it changed something.

Other things the core handles for you:
- **Conversation state:** what "it" refers to, pending yes/no questions, the last few exchanges.
- **Per-user request queueing:** two requests from one person never interleave.
- **Model fallbacks and time limits** across NVIDIA NIM or Ollama.
- **A startup consistency check** that tools, capabilities and metadata agree.

## 2. Core vs. pack

```
src/modules/ai/
├── (core) AIRuntime.ts, pipeline/, planning/, execution/, conversation/, entity/,
│          context/, providers/, clients/, sdk/, registry/, intent/, domain/ ...
├── domains/
│   └── books/            <- your pack
│       └── index.ts      <- exports booksPack: DomainPack
└── aiController.ts       <- the composition root: setDomainPack(booksPack)
```

**The rule:** core files never import anything under `domains/`. They ask `domainPack()` (from `domain/activeDomain.ts`). Only `aiController.ts` picks the pack. RoninArc has a test that fails the build if a core file breaks this; keep one like it (section 7).

The contract is **`core/domain/DomainPack.ts`**. Read it first: every member is documented there.

## 3. What a books pack provides

Grouped by job. Each item names the games-pack file that does it, so you can see a finished version.

### Wiring (called once at startup)

| Member | Books version | Games reference |
|---|---|---|
| `id` | `"books"` | `index.ts` |
| `intentTypes` | Every intent the model may return, e.g. `AddBook, RemoveBook, SetStatus, RateBook, ReviewBook, DeleteReview, AddNote, SearchLibrary, LibraryQuestion, RecommendBook, CreateShelf, OrganizeShelf, AskQuestion, Help`. Keep `AskQuestion` and `Help`: the core handles those itself. | `intent/IntentType.ts` |
| `createToolRegistry()` | Registers your tools (classes extending `core/sdk/BaseTool`). One tool = one real action against your database or API. | `registry/ToolRegistrar.ts`, `actions/**` |
| `registerCapabilities()` | Capabilities: `{ id, name, description, intentType, requirements: [{ contextCategory }] }`. The planner sees names and descriptions. | `planning/CapabilityRegistrar.ts` |
| `registerContextProviders(registry)` | What the model may read about the user: their books, shelves, reviews. Each provider implements `core/context/ContextProvider`. | `context/*ContextProvider.ts` |
| `resolveEntity(userId, query, {isBulk})` | Turns "dune" or "hail mary" into one of the user's records, or candidates to ask about. Fuzzy title matching, aliases ("lotr"), series ("all Dune books"). | `entity/EntityResolver.ts` |
| `tools` | The tool table: `metadata` (each tool's parameters), `capabilityTools` (capability → tool), `multiToolCapabilities` + `chooseTool` (a capability that picks its tool per request, e.g. rate vs. delete review), `buildInput` (a step's targets/params → the tool's input), `textParamKeyByTool`, `noReferenceFallbackTools`. | `execution/GameTools.ts` |

### Reading the message

| Member | Books version | Games reference |
|---|---|---|
| `normalizeMessage` | Slang and typos ("finsihed" → "finished", "tbr" → "to be read"), and "the second one" right after a list. | `conversation/FollowUps.ts` (`normalizeSlang`, `resolveOrdinals`) |
| `withPageContext` | A question about "this one" on a book's page names that book. | `withPageGame` |
| `preRoute` | The no-model fast path: library questions ("how many did I read this year?"), plain commands ("add X", "rate X 8"), undo, collection commands. Return `{kind:"reply"}` when handled, else call the model: `{kind:"plan", plan: await model.planWithRetry(...)}`. **Start small:** just call the model; add fast paths as testing shows what people type. | `pipeline/PreRoute.ts`, `conversation/DirectAnswers.ts`, `DirectActions.ts` |
| `correctPlan` | Drop intents the message didn't ask for (a status change nobody mentioned). Returns how many were dropped. | `pipeline/PlanCorrections.ts`, `StatusEvidence.ts` |
| `normalizePlan` | Domain clean-up, e.g. `StartBook` → `SetStatus: reading`. | `PlanShaping.normalizeStatusIntents` |
| `groundPlan` | Only act on books the user named or clearly referred to. | `pipeline/PlanGrounding.ts`, `conversation/TargetGrounding.ts` |
| `shapePlan` | One intent per book, "add + set to-read" is one step, a recommendation ask isn't an "add". | `PlanShaping.shapePlan` |
| `runsFirst(intent)` | `AddBook` runs before the rest ("add X and rate it 9"). | `index.ts` |

### After a plan runs

| Member | Books version | Games reference |
|---|---|---|
| `undo` | Snapshot what a plan will change; remember it; "undo" puts it back. Can start as a no-op: `snapshotBefore: async () => undefined`. | `pipeline/UndoLog.ts` |
| `followUpOffer` | "Want me to mark it Finished?" after a 9/10 rating. Optional: return `undefined`. | `DirectActions.followUpOffer` |
| `confirmBeforeRunning` | A yes/no card before destructive steps (removing a book deletes its notes). | `pipeline/GameReplies.askBeforeRemoving` |
| `finishReply` | Last touch on every reply. Turns "I can add X if you like" into a pending yes/no. | `GameReplies.ts` |
| `describeResults` | Tool results → sentences ("I've added Dune to your library as To Read."). | `response/AIResponseBuilder.ts` |

### The model and words

| Member | Books version | Games reference |
|---|---|---|
| `prompts.plan` | The planner prompt: rules plus few-shot examples, in books language. **Most of the quality lives here.** | `prompts/PromptBuilder.ts` |
| `prompts.answer` | The plain-text answer prompt (the user's library + recent conversation + facts). | `prompts/AnswerPromptBuilder.ts` |
| `prepareQuestion` | Expand shorthand, look up facts (author, year, page count) so the model doesn't guess. | `conversation/Shorthand.ts`, `GameFacts.ts` |
| `phrases` | Greetings, "not sure which book", "X isn't in your library", and the regexes the core uses (`claimsAction`, `looksLikeQuestion`...). | `index.ts` → `phrases` |

## 4. Names in the core that still say "game"

The core still carries a few names from its origin:

| Name | Where | Meaning |
|---|---|---|
| `IntentTargetType.Game` | `intent/IntentTargetType.ts` | "the domain's main item". Entity resolution runs for targets of this type. |
| `gameId`, `gameName` tool parameters | `execution/ToolParameterResolver.ts`, `planning/PlanningEngine.ts`, `execution/ExecutionAdapter.ts`, `clarification/ClarificationTemplateRegistry.ts` | the main item's id, and its name for add-style tools |
| `session.references.currentGame` | `conversation/*` | "the item we're talking about" (what "it" means) |
| `ContextCategory.Library / Reviews / Collections / PlaySessions` | `context/ContextCategory.ts` | generic enough; use the ones that fit |
| `canLaunchGames`, `launch_game` client action | `sdk/AIToolContext.ts` | unused by books; leave it |

**Option A (fastest):** use them as they are. Books are targets of type `"Game"`, and book tools take `gameId` / `gameName`. It works today; it just reads oddly.

**Option B (cleaner, recommended before writing many tools):** one mechanical rename across `core/`:
- `IntentTargetType.Game` → `IntentTargetType.Item` (value `"Item"`)
- `gameId` / `gameName` → `itemId` / `itemName`
- `currentGame` → `currentItem`

Then teach your planner prompt the `"Item"` target type. Run your tests after.

## 5. Plugging it into your backend

1. **Copy the code.** `core/` goes to `src/modules/ai/`, `shared/errors/AppError.ts` to `src/shared/errors/`, and `shared/types/express.d.ts` to `src/shared/types/`. With just these, a stub pack and a stub auth middleware, the core compiles on its own (checked with TypeScript strict). Or point the core's two imports of it at your own error class (`runtime/errors/AIRuntimeError.ts`, `aiRoutes.ts`).
2. **Dependencies:** `npm i axios express fastest-levenshtein`, with TypeScript strict mode.
3. **Auth:** `aiRoutes.ts` imports `../auth/authMiddleware`. Point it at yours. It must set `req.user = { id, name }`, and everything is scoped by that `id`.
4. **Your pack:** create `src/modules/ai/domains/books/index.ts` exporting `booksPack: DomainPack`.
5. **Composition root:** in `aiController.ts`, replace the games import with `setDomainPack(booksPack)`, `booksPack.createToolRegistry()` and `booksPack.registerCapabilities()`.
6. **Mount the routes:** `app.use("/ai", aiRoutes)` gives you `POST /ai/chat` `{ message }` → `{ success, status, message, clarificationRequest? }` and `POST /ai/reset`.
7. **Environment:**

```
AI_PROVIDER=nvidia                     # or ollama
NVIDIA_API_KEY=...  NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1   # or a keygate proxy URL
NVIDIA_FALLBACK_MODELS=nvidia/nemotron-3-super-120b-a12b,openai/gpt-oss-20b
NVIDIA_TIMEOUT=30000  NVIDIA_ANSWER_TIMEOUT=20000
# Ollama instead: OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT
```

**API keys in a client-side app:** if the backend runs on users' machines, don't ship your keys. Use keygate (the same author's multi-project key proxy): the app sends a per-install token and keygate adds the real key. Add a `books` project to `keygate.config.ts`.

## 6. Status codes the client should handle

`/ai/chat` replies with `status`:
- `SUCCESS`
- `PARTIAL`: part of a two-part message ran
- `CLARIFICATION_REQUIRED`: ask the user; `clarificationRequest.candidates` are buttons
- `CONFIRMATION_REQUIRED`: a yes/no card; send the chosen label back as the next message
- `CANCELLED`
- `LIMITED`: the daily allowance is used up
- `FAILED`

When the model is unreachable or too slow, it returns HTTP 503 with a friendly message.

## 7. How RoninArc got it good (do the same)

1. **Purity test.** It fails if any file outside `domains/` imports from `domains/` or from your app's modules. RoninArc's version is `e2e/tests/api/ai-core-purity.spec.ts`: about 40 lines that scan imports.
2. **API tests with a mock model.** Run the backend with a mock LLM (RoninArc's `clients/OllamaClient.ts` has a `MOCK_LLM=true` mode with *game* rules; write books rules in the same style) and a mock metadata API (for books: Open Library or Google Books). Test every intent through `POST /ai/chat`, then check the database actually changed.
3. **Playtest rounds.** This is what took RoninArc from rough to good: 24 rounds. Have someone (or an AI agent acting as a casual user) chat the way real people do, with typos, slang, "it", two requests in one message, corrections ("no I meant…"), and "undo". Log what it got wrong. Fix it in the pack, usually in `preRoute`, `correctPlan`, `groundPlan` or the prompt. Add a test for each fix. Repeat.
4. **Golden rule:** the assistant must never claim it did something it didn't. Every reply about a change should come from `describeResults` (real tool results), not from the model's text.

## 8. Books-specific starting points

- **Statuses:** `to-read`, `reading`, `paused`, `finished`, `dnf`. People say "TBR", "currently reading", "gave up on", "DNF'd".
- **Main tools:**
  - `add_book` (search Open Library or Google Books, then add the best title + author match)
  - `remove_book`, `update_status`
  - `create_review` / `delete_review` (rating 1-10 or 1-5: pick one and say it in the prompt)
  - `add_note`
  - `create_shelf`, `add_to_shelf`, `remove_from_shelf`
  - `search_library`, `library_question`, `recommend_books`
- **Entity resolution:** titles plus authors ("the new Sanderson"), series ("Dune 2" = Dune Messiah), editions and translations, subtitles ("Project Hail Mary: A Novel").
- **Questions worth answering without the model:** "how many did I finish this year?", "what am I reading?", "what's on my TBR?", "what did I rate X?", "who wrote X?" (from your metadata).
