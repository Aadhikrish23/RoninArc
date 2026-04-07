# RoninArc — Forge Your Game Path  
A full-fledged cross-platform **Game Launcher** built with **React + TypeScript**, **Node.js**, **MongoDB**, **Electron**, and **RAWG API**.

RoninArc allows users to search for games online, build a personal game library, categorize them, store executable paths, and **launch installed PC games directly** from the launcher.

Backend is deployed on Render and the desktop app is packaged as a Windows installer (.exe).

---

## 🚀 Features

### 🔐 Authentication
- Signup & Login with JWT  
- “Remember Me” support  
- Client-side token storage  

### 🎮 Game Library
- Add games with title, description, image, tags  
- RAWG search integration  
- Status management: **Plan → Playing → Completed → Dropped**  
- Update/Delete game entries  
- Toast notifications for every action  

### ⚡ Game Launcher (Electron)
- Add local `exePath` for installed games  
- Directly launch `.exe` or `.lnk` shortcuts  
- Deployed backend works out-of-the-box  
- Standalone installer (.exe) provided  

### 🖥 UI / UX
- Clean Chakra UI design  
- Dark/Light theme toggle  
- Toast messages for all actions  
- Dashboard preview (static values)  
- Settings: Logout + Theme  

---

## 🧩 Tech Stack

### Frontend
- React  
- TypeScript  
- Chakra UI  
- Axios  

### Backend
- Node.js  
- Express  
- JWT Authentication  
- MongoDB Atlas  
- Mongoose  

### Desktop App
- Electron  
- electron-builder  

### External API
- RAWG games database  

### Deployment
- Render (Backend)  
- MongoDB Atlas (Database)  

---

## 📁 Folder Structure
```
RoninArc/
   backend/
   frontend/
   desktop/
   README.md
```

---

## 🔧 How to Run the Backend Locally

```
cd backend
npm install
npm run dev
```

Environment variables:
```
MONGO_URI=<your_mongo_uri>
JWT_SECRET=<your_jwt_secret>
RAWG_API_KEY=<your_rawg_api_key>
```

---

## 🔧 How to Run the Frontend Locally

```
cd frontend
npm install
npm run dev
```

---

## 🖥 Running the Desktop App (Development)

```
cd desktop
npm install
npm start
```

---

## 📦 Production Build (Windows Installer)
Download the Windows installer from:  
[👉 **<Drive Link to EXE>**](https://drive.google.com/file/d/1z4RMcp3RiyEDz8LnnZSuhtDDtqx52AmD/view?usp=sharing)

The app works immediately — no backend setup needed.

---

## 🔗 API Endpoints (Summary)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`

### Library
- `GET /api/library`
- `POST /api/library`
- `PUT /api/library/:id`
- `DELETE /api/library/:id`

---

## 📝 Roadmap (Next Versions)

### Phase 2
- Dynamic Dashboard analytics  
- Recently played section  
- Change password + delete account  
- Game time tracking  
- Steam/Epic auto-detection (manifest parsing)  
- Improved UI animations  
- Landing website for RoninArc  

### Phase 3 (Mobile App)
- React Native companion app  
- Track mobile/console games (RAWG)  
- Sync library across devices  
- Stats visualization  
- AI-powered recommendations  

---

## 📌 Notes
This submission focuses on delivering a **production-ready core product**:
- Authentication  
- Game library  
- RAWG integration  
- Desktop game launcher  
- Stable deployed backend  
- Installer package  

Dashboard numbers are static as a preview module; dynamic analytics are part of Phase 2 development.

---

## 👤 Author  
**Aadhi Narayanan**
