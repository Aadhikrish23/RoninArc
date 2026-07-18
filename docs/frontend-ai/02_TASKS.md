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

[x] Chat page

[x] Sidebar

[x] Message bubbles

[x] Markdown

[x] Typing indicator

[x] Input

[x] Conversation history

[x] Persistence

---

## Sprint 3

[x] Tool Timeline

[x] Tool Cards

[x] Clarification UI

[x] Retry

[x] Error UI

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

### Sprint 2
- **Chat page**: Rewrote `frontend/src/features/ai/pages/AIPage.tsx` to serve as the unified chat UI grid integrating the responsive sidebar, message list with auto-scroll anchor, custom typing dots, and the send action triggers.
- **Sidebar**: Created `frontend/src/features/ai/components/ChatSidebar.tsx` displaying the active conversation turn stats, new discussion creation triggers, history resets, and navigation shortcuts.
- **Message bubbles**: Developed `frontend/src/features/ai/components/MessageBubbles.tsx` displaying stylized user (purple bubble, aligned right) and assistant (grey bubble with sparkles avatar, aligned left) messages.
- **Markdown**: Created `frontend/src/features/ai/components/MarkdownRenderer.tsx` parsing headers, bullet points, inline code, bold weights, paragraphs, and multi-line syntax-highlighted code blocks dynamically.
- **Typing indicator**: Built `frontend/src/features/ai/components/TypingIndicator.tsx` using a three-dot bouncing keyframe pure-CSS animation.
- **Input**: Developed `frontend/src/features/ai/components/ChatInput.tsx` providing a multi-line input container that triggers submission on `Enter` without `Shift` and automatically disables while the assistant is processing.
- **Conversation history**: Configured local state lists in `AIContext.tsx` maintaining the array of turns and status metadata for the active discussion.
- **Persistence**: Implemented local storage caching logic in `AIContext.tsx` keyed dynamically by the logged-in user ID, converting timestamps and preserving state across tab refreshes automatically.

### Sprint 3
- **Tool Timeline & Tool Cards**: Created `frontend/src/features/ai/components/ToolTimeline.tsx` displaying the exact execution layers (Session loading, Memory access, Intent planning, Action execution) and metrics.
- **Clarification UI & Clarification cards**: Created `frontend/src/features/ai/components/ClarificationCard.tsx` showing the reason/question for requested clarifications and rendering a responsive grid of candidates as clickable options that automatically post selections back to the AI.
- **Error UI**: Created `frontend/src/features/ai/components/ErrorCard.tsx` to handle failures gracefully in a stylized red card format.
- **Retry**: Implemented a global `retry` method in `AIContext.tsx` and mapped it to the `Retry Action` buttons in `ErrorCard` to automatically trigger re-execution of the last failed message query. All layouts integrate cleanly in `MessageBubbles.tsx` and compile without type errors.