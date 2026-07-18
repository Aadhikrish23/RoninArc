# Agent Rules

These rules are mandatory.

Violation of any rule means the task is incomplete.

---

## Scope

Only work on files related to the current task.

Do not refactor unrelated code.

Do not rename existing folders.

Do not rename APIs.

Do not rename routes.

Do not replace libraries.

Do not introduce new dependencies unless required.

---

## Coding

Prefer existing project conventions.

Reuse existing components.

Prefer composition.

Avoid duplicate logic.

Keep components under 300 lines.

Extract reusable hooks.

---

## Architecture

AI owns conversations only.

Business features own business state.

Use EventBus for communication.

Do not directly modify another feature's state.

---

## Safety

Never edit backend.

Never change API contracts.

Never change database models.

Never delete existing functionality.

Never remove existing tests.

---

## Git

One logical change per commit.

Small commits.

No unrelated formatting.

No unrelated lint fixes.

---

## Documentation

After completing a task

Update TASKS.md

Mark completed items

Add implementation notes

Do not continue automatically.

Wait for approval before starting the next task.

---

## If blocked

Stop immediately.

Explain the blocker.

Do not invent APIs.

Do not assume missing backend behavior.

Request clarification.