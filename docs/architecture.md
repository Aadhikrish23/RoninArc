# RoninArc Architecture

## Overview

RoninArc is a desktop-first game library, launcher, and tracking platform.

Tech Stack:

Frontend:

* React
* TypeScript
* Vite
* Chakra UI

Backend:

* Node.js
* Express
* TypeScript
* MongoDB

Desktop:

* Electron

Authentication:

* JWT Authentication
* AuthContext
* Protected Routes

## Frontend Structure

src/
├── api/
├── components/
├── context/
├── routes/
├── types/

Future Migration:

src/
├── features/
│   ├── auth/
│   ├── library/
│   ├── dashboard/
│   ├── activity/
│   └── sessions/

## Backend Structure

backend/src/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/

## Current Core Features

* Authentication
* Game Library
* RAWG Integration
* Game Launcher
* Theme Support

## Planned Features

* Dashboard Analytics
* Activity Tracking
* Play Sessions
* Reviews
* Collections
* Achievements
* AI Recommendations
