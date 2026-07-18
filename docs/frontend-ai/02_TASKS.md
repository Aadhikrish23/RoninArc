# AI Frontend Tasks

## Sprint 1

[x] Create AI feature folder

[x] Create routing

[x] Create AIContext

[x] Create AI API service

[x] Create conversation model

[x] Register provider

---

## Sprint 2

[ ] Chat page

[ ] Sidebar

[ ] Message bubbles

[ ] Markdown

[ ] Typing indicator

[ ] Input

[ ] Conversation history

[ ] Persistence

---

## Sprint 3

[ ] Tool Timeline

[ ] Tool Cards

[ ] Clarification UI

[ ] Retry

[ ] Error UI

---

## Sprint 4

[ ] EventBus

[ ] Library integration

[ ] Review integration

[ ] Collection integration

[ ] Launcher integration

[ ] Dashboard integration

---

## Sprint 5

[ ] Notifications

[ ] Optimistic updates

[ ] Loading states

[ ] Empty states

[ ] AI Settings

[ ] Final QA

---

## Implementation Notes

### Sprint 1
- **Create AI feature folder**: Created the core folder structure under `frontend/src/features/ai/` matching the architecture documentation. Since the folders are currently empty, created a `.gitkeep` file in each directory (`api/`, `components/`, `context/`, `hooks/`, `pages/`, `services/`, `types/`, and `utils/`) to ensure the directory structure is tracked and committed in Git.
- **Create routing**: Designed and created a highly aesthetic `AIPage` component in `frontend/src/features/ai/pages/AIPage.tsx`, registered the `/ai` route in `AppRouter.tsx` under the protected route group, and added a custom, styled "AI Assistant" button with a sparkles icon in the `Navbar.tsx` for easy navigation. All files compile and lint cleanly.
- **Create conversation model**: Defined clean TypeScript interfaces for the UI message structure (`Message`), as well as matching structures for backend conversation turns, sessions, and clarification models in `frontend/src/features/ai/types/conversation.ts`.
- **Create AI API service**: Created `frontend/src/features/ai/api/aiApi.ts` using the project's default `axiosInstance`, handling request body packaging and response interface mapping for post-chat message operations.
- **Create AIContext**: Built `frontend/src/features/ai/context/AIContext.tsx` declaring active message states, typing states, optimistic message additions, API call integrations, error handlers, and conversational state resets.
- **Register provider**: Registered `AIProvider` wrapper inside `frontend/src/app/providers/AppProviders.tsx` making the AI context globally available to all child components.