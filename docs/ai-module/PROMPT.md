# Brief for the books app's AI agent

Copy everything below the line into your AI coding agent (Claude Code or similar), working in the books app's repository with this bundle unzipped next to it.

---

You're adding a conversational AI assistant to this books app by reusing an existing, proven AI module from another app (RoninArc, a game library). The module is split into a reusable **core** and a **domain pack**. RoninArc's pack is about games; your job is to write the **books pack** and wire the core into this app.

**Read first, in this order:**
1. `ai-module-handoff/HANDOFF.md`: how the module works and what a pack must provide.
2. `ai-module-handoff/core/domain/DomainPack.ts`: the exact contract.
3. `ai-module-handoff/reference/games-pack/index.ts`, then the files it points to. This is the finished games version of everything you'll write. It imports RoninArc's own modules, so read it; don't compile it.

**Then:**

1. **Explore this app first:**
   - its backend framework, auth (how a request knows the user's id), database models for books, shelves/lists, reviews/ratings, notes and reading status
   - any book-metadata API it uses (Open Library, Google Books...)

   Write down how each maps onto the pack's needs before coding. If the backend isn't Node/Express/TypeScript, stop and tell me; the module is TypeScript for Express.
2. **Copy the core** into `src/modules/ai/` (and `shared/errors/AppError.ts`, or point it at this app's error class). Point `aiRoutes.ts` at this app's auth middleware (it must set `req.user.id`). Install `axios`, `express` and `fastest-levenshtein`.
3. **Add a purity test** that fails if any core file imports from `domains/` or from the app's own modules (see HANDOFF section 7). Core files must only ever reach the domain through `domainPack()`.
4. **Decide on the "game" names left in the core** (HANDOFF section 4). Recommendation: do the mechanical rename to `Item` / `itemId` / `itemName` / `currentItem` first, in its own commit, before writing tools.
5. **Write `src/modules/ai/domains/books/`, smallest useful version first:**
   - **Intents:** `AddBook, RemoveBook, SetStatus, RateBook, ReviewBook, DeleteReview, AddNote, SearchLibrary, LibraryQuestion, RecommendBook, CreateShelf, OrganizeShelf, AskQuestion, Help`
   - **Tools:** one per real action, calling this app's existing services (not the database directly when a service exists)
   - **The rest:**
     - capabilities, context providers (the user's books/shelves/reviews), `resolveEntity` (fuzzy title + author match)
     - the tool table (`tools`), `describeResults`, the two prompts, and `phrases`
     - `preRoute` that just calls the model at first
     - simple `correctPlan` / `groundPlan` / `shapePlan`, and `undo` as a no-op

     Then select it in `aiController.ts` with `setDomainPack(booksPack)` and mount `/ai`.
6. **Tests:** run with a mock LLM (books rules in the style of `core/clients/OllamaClient.ts`'s `MOCK_LLM` mode) and a mock metadata API. Write API tests for every intent through `POST /ai/chat`, each checking the database really changed. Also cover:
   - removal asks first
   - an unknown book gets "isn't in your library"
   - a question never changes anything
   - "undo" (once undo exists)
7. **Playtest like a reader:** typos ("finsihed dune"), slang ("TBR", "DNF'd"), "it", two requests in one message, "no I meant…", "what should I read next?". Fix what goes wrong in the pack, add a test for each fix, and repeat a few rounds.

**Rules:**
- **Never change a core file to add books behaviour.** If the core genuinely lacks a hook, add a general one to `DomainPack.ts` (with a sensible default), and tell me.
- **Replies must only describe what the tools actually did.** The assistant must never say it changed something it didn't.
- **No API keys in the repo or in any client build.**
- **Commit in small steps:**
  1. the core copy and the purity test
  2. the rename
  3. the pack skeleton
  4. each group of tools
  5. tests

  Report what you did and what's left after each step.
