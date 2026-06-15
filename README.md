# RoninArc — Forge Your Game Path

RoninArc is a desktop-first game library, launcher, and tracking platform built with **React**, **TypeScript**, **Node.js**, **MongoDB**, **Electron**, and the **RAWG API**.

It allows users to discover games, build a personal game library, track progress, review games, manage launch paths, and launch installed PC games directly from a unified interface.

The backend is deployed on Render and the desktop application is packaged as a Windows installer.

---

# 🚀 Features

## 🔐 Authentication

- User Signup & Login
- JWT Authentication
- Remember Me Support
- AuthContext State Management
- Protected Routes
- Persistent Sessions

---

## 🎮 Game Library

- Add games from RAWG
- Store game metadata
- Track game progress
- Status Management:
  - Plan to Play
  - Playing
  - Completed
  - Dropped
- Update game information
- Delete games
- Search and filter library

---

## 🔎 RAWG Integration

- Search games from RAWG API
- Import game information
- Import images and genres
- Quick add to library

---

## ⚡ Desktop Game Launcher

- Save executable paths
- Launch installed PC games
- Supports:
  - `.exe`
  - `.lnk`
- Electron desktop integration
- One-click launching

---

## 📝 Reviews System

- Rate games from 1–10
- Optional review notes
- Edit existing reviews
- Delete reviews
- One review per game
- Persistent review storage

---

## 📊 Dashboard Analytics

### Library Analytics

- Total Games
- Currently Playing
- Completed Games
- Featured Game
- Continue Playing
- Recently Added

### Review Analytics

- Reviews Written
- Average Rating
- Highest Rated Game

---

## 🎨 UI / UX

- Chakra UI Design System
- Responsive Layout
- Dark Theme Support
- Light Theme Support
- Toast Notifications
- Modular Feature Architecture

---

# 🧩 Tech Stack

## Frontend

- React
- TypeScript
- Vite
- Chakra UI
- Axios
- React Router

## Backend

- Node.js
- Express
- TypeScript
- MongoDB Atlas
- Mongoose
- JWT Authentication

## Desktop

- Electron
- Electron Builder

## External APIs

- RAWG Game Database API

## Deployment

- Render
- MongoDB Atlas

---

# 📁 Project Structure

```text
RoninArc/
│
├── backend/
│
├── frontend/
│
├── desktop/
│
├── docs/
│   ├── api.md
│   ├── architecture.md
│   └── roadmap.md
│
└── README.md
```

---

# 🏗 Architecture

## Backend

```text
backend/src/

├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── app.ts
└── server.ts
```

### Request Flow

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Model
```

---

## Frontend

```text
frontend/src/

├── api/
├── components/
├── context/
├── features/
│
├── routes/
├── types/
└── main.tsx
```

### Current Feature Modules

```text
features/

├── library/
│   ├── api/
│   ├── components/
│   └── hooks/
│
└── reviews/
    ├── api/
    ├── components/
    └── types/
```

---

# 🔧 Local Development

## Backend

```bash
cd backend
npm install
npm run dev
```

Environment Variables:

```env
LOCAL_URL_Mongo=<mongodb_uri>
JWT_SECRET=<jwt_secret>
RAWG_API_KEY=<rawg_api_key>
```

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Desktop Application

```bash
cd desktop
npm install
npm start
```

---

# 📦 Production Build

Download the latest Windows installer:

https://drive.google.com/file/d/1z4RMcp3RiyEDz8LnnZSuhtDDtqx52AmD/view?usp=sharing

---

# 🔗 API Overview

## Authentication

```http
POST /auth/signup
POST /auth/login
```

## Library

```http
GET    /library
POST   /library/add
GET    /library/:gameid
PATCH  /library/:gameid
DELETE /library/:gameid
GET    /library/filter/search
```

## Dashboard

```http
GET /dashboard/stats
```

## Reviews

```http
GET    /review/:gameId
PUT    /review/:gameId
DELETE /review/:gameId
```

## RAWG

```http
GET /rawg/search
```

---

# 🛣 Roadmap

## ✅ Completed

### Phase 1 — Stabilization

- AuthContext
- useAuth Hook
- Protected Routes
- Route Cleanup
- Architecture Refactor

### Phase 2 — Dashboard

- Real Dashboard Statistics
- Featured Game
- Continue Playing
- Recently Added
- Review Analytics

### Phase 3 — Reviews

- Review CRUD
- Rating System
- Dashboard Integration

---

## 🚧 In Progress

### Phase 4 — Collections

- Favorites
- Custom Collections
- Collection Management

---

## 📅 Planned

### Phase 5 — Play Sessions

- Session Tracking
- Playtime Analytics
- Recently Played
- Most Played Games

### Phase 6 — Advanced Features

- Notes
- Achievements
- Activity Feed
- Enhanced Analytics

### Phase 7 — Integrations

- Steam Import
- Epic Games Import
- GOG Import
- AI Recommendations

---

# 👤 Author

**Aadhi Narayanan**

---

# 📌 Project Vision

RoninArc began as a personal game launcher and library manager.

The long-term vision is to evolve it into a complete gaming companion that combines:

- Library Management
- Progress Tracking
- Reviews
- Collections
- Play Analytics
- Game Discovery

while also serving as a standalone product and a future module within the broader Hina ecosystem.