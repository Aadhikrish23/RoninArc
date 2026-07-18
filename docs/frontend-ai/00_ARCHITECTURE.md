# RoninArc AI Frontend Architecture

## Goal

Transform RoninArc into an AI-first desktop application where every backend AI capability is accessible through a polished frontend.

The AI should feel like the primary interface to the application rather than an additional feature.

---

## Principles

1. AI owns conversations only.
2. Existing feature modules own business data.
3. Communication happens through events.
4. Never directly mutate another feature's state.
5. UI should update optimistically.
6. Backend remains the source of truth.
7. Components must remain small and composable.

---

# Feature Structure

features/

    ai/

        api/

        components/

        context/

        hooks/

        pages/

        services/

        types/

        utils/

---

# Shared Infrastructure

shared/

    events/

        EventBus.ts

    notifications/

    optimistic/

    realtime/

---

# Event Flow

User

↓

AI

↓

Backend

↓

AI Event Bus

↓

Library

Collections

Reviews

Dashboard

Launcher

Notifications

---

# Events

conversation.created

conversation.updated

message.created

tool.started

tool.completed

tool.failed

library.updated

collection.created

collection.updated

review.created

review.updated

launcher.started

dashboard.updated

notification.created

---

# Component Ownership

AI owns

- conversations
- chat UI
- tool timeline
- clarification cards
- typing state

Library owns

- games

Collections own

- collections

Reviews own

- reviews

Dashboard owns

- statistics

Launcher owns

- running state

---

# Forbidden

Never import Library state directly into AI.

Never modify Review state directly.

Never call setState across features.

Everything must communicate through EventBus.

---

# Future Ready

Architecture should support

Streaming

Voice

Multiple AI providers

Plugin tools

Hina integration

without requiring architectural changes.