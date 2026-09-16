# 🎙️ Unified Audio Platform



> **A real‑time, unified audio platform for vocal artists to record, mix, and collaborate on voice drafts in private social rooms, featuring a multiplayer spin‑wheel arena!**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

---

## 📖 About The Project

The platform was born from the frustration of juggling separate tools for **recording**, **editing**, **sharing**, and **collaborating** on vocal takes. Instead of exporting a WAV file, uploading it to a cloud drive, and then waiting for a teammate to download it, developers wanted a **single, web‑based environment** where:

*   Artists could **record** directly from the browser using the Web Audio API.
*   Producers could **apply DSP effects** in real time.
*   Teams could **share drafts instantly** inside a live, **private** audio room.
*   Collaboration could be **fun** – hence the multiplayer spin‑wheel game that keeps the vibe lively.

The platform delivers all of that and more, fully in the browser, with a sleek dark‑mode UI.

---

## ✨ Feature Overview

| Category | Feature | Details |
|---|---|---|
| **Audio Studio** | Web‑Audio‑API recording | `navigator.mediaDevices.getUserMedia` + `AudioContext` |
| | Real‑time DSP effects | Reverb, Auto‑Tune (sim), Megaphone, Cyberpunk, Echo |
| | Waveform visualizer | Canvas‑based analyser visualizer |
| | Draft library | Save, rename, delete, play back locally |
| **Social Rooms** | Private rooms with 6‑char code | Enforced on both client and server |
| | Live participant list | Socket.io `room_members_updated` events |
| | Synchronized draft broadcasting | `draft_shared` event triggers simultaneous playback |
| **Spin Wheel Arena** | Multiplayer elimination game | Server‑authoritative `spinEngine.js` runs the loop |
| | Configurable player count (3‑20) | Minimum required to start |
| | Virtual reward system | Winner gets 500 points stored in MongoDB |
| **UX & Design** | Premium dark theme | CSS Variables, glassmorphism, micro‑animations |
| | Responsive layout | Works on desktop and tablets |

---

## 🏗️ Architecture & Tech Stack

### Frontend
* **Framework:** React + Vite (fast HMR, native ES modules)
* **Audio:** Native Web Audio API (`AudioContext`, `GainNode`, `BiquadFilterNode`, `ConvolverNode`, `DelayNode`)
* **Networking:** `socket.io-client` for bidirectional real‑time events, `fetch`/`axios` for REST
* **Styling:** Vanilla CSS with design tokens (colors, spacing, radii) and glassmorphism effects
* **Icons:** Lucide React

### Backend
* **Runtime:** Node.js + Express
* **Realtime:** `socket.io` (rooms, presence, spin‑wheel engine)
* **Database:** Mongoose + MongoDB (in‑memory server for dev, ready for Atlas in prod)
* **File uploads:** `multer` stores WAV files under `/uploads`
* **Testing:** Jest + Supertest – covers API, WebSocket, and game logic

---

## 📦 Project Structure (high‑level)

```
Project/
├─ backend/                # Node/Express server
│   ├─ src/
│   │   ├─ app.js          # Express app
│   │   ├─ server.js       # HTTP + Socket.io server
│   │   ├─ models/         # Mongoose schemas (User, Room, Draft, SpinGame)
│   │   ├─ services/       # spinEngine.js – authoritative game loop
│   │   ├─ socket/         # roomSocket.js – socket event handling
│   │   └─ routes/         # REST endpoints
│   └─ tests/               # Jest test suite
├─ frontend/               # React UI
│   ├─ src/
│   │   ├─ components/    # AudioStudio, DraftList, LiveRoom, SpinWheel, etc.
│   │   ├─ audio/         # AudioEngine.js, WavEncoder.js
│   │   ├─ services/      # api.js (REST) & socket.js (WebSocket wrapper)
│   │   └─ App.jsx        # Root component with dark‑mode handling
│   └─ index.css            # Global CSS design system
├─ docker-compose.yml       # Optional Docker dev environment
└─ README.md                # This file
```

---

## 📂 Detailed API Reference

### REST Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/drafts` | List all saved drafts |
| `POST` | `/api/drafts` | Upload a new draft (multipart/form‑data) |
| `DELETE` | `/api/drafts/:id` | Delete a draft |
| `POST` | `/api/rooms` | Create a private room (returns 6‑char code) |
| `POST` | `/api/rooms/join` | Join an existing room with a code |
| `GET` | `/api/rooms` | List discoverable active rooms (no join info) |

### WebSocket Events (`/` namespace)
| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `join_room` | Client → Server | `{roomCode, username}` | Request to join a private room |
| `room_state` | Server → Client | Full room state (members, draft queue) |
| `user_joined` / `user_left` | Server → Client | `{username}` | Presence updates |
| `share_draft` | Client → Server | `{draftId}` | Host shares a draft to the room |
| `draft_shared` | Server → Client | `{draftUrl, timestamp}` | Synchronized playback trigger |
| `start_spin` | Host → Server | – | Begin spin‑wheel elimination |
| `spin_started` | Server → Clients | – | Notify all participants the game began |
| `user_eliminated` | Server → Clients | `{username}` | Broadcast each elimination |
| `winner_announced` | Server → Clients | `{username}` | Announce the final winner |

---

## 📸 Screenshots (placeholder images)

<div align="center">
  <img src="https://via.placeholder.com/800x450/0F172A/0284C7?text=Studio+View" alt="Studio View" style="margin: 10px;" />
  <img src="https://via.placeholder.com/800x450/0F172A/0284C7?text=Lobby+View" alt="Lobby View" style="margin: 10px;" />
  <img src="https://via.placeholder.com/800x450/0F172A/0284C7?text=Spin+Wheel+Arena" alt="Spin Wheel" style="margin: 10px;" />
</div>

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* **Node.js** v16+ (includes npm)
* **Git** (for version control)

### 1️⃣ Backend Setup
```bash
cd backend
npm install
npm start   # runs on http://localhost:5000
```
> The server uses an **in‑memory MongoDB** instance, so no external DB is required for development.

### 2️⃣ Frontend Setup
```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```
Open the URL in a modern browser (Chrome/Edge/Firefox) and you’ll see the dark‑mode lobby ready for you.

---

## 🧪 Running Tests

```bash
cd backend
npm test   # Jest + Supertest suite
```
All tests should pass (`25/25` currently). The suite validates API contracts, WebSocket flows, room lifecycle, and the spin‑wheel elimination algorithm.

---

## 📦 Deployment Guide

The platform can be deployed as two separate services (backend & frontend) or as a single Docker‑Compose stack.

### Docker Compose (quick start)
```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```
Run `docker-compose up --build -d`. The frontend will proxy API calls to the backend container automatically.

### Vercel / Netlify (frontend only)
* Push the `frontend/` directory to a Vercel project – the `vite.config.js` is already configured for static export.
* Set an environment variable `VITE_API_URL` pointing to your deployed backend URL.

### Render / Railway (backend)
* Create a new **Node.js** service, point it at the `backend/` folder, and expose port `5000`.
* Add a **MongoDB Atlas** connection string as `MONGODB_URI` (replace the in‑memory DB).

---

## 🤝 Contributing

Contributions are welcome! Follow these steps:

1. **Fork** the repository.
2. **Clone** your fork locally.
3. Create a new branch: `git checkout -b feature/your-feature-name`.
4. Make your changes, ensuring the linting and tests still pass.
5. Commit with a clear message and push: `git push origin feature/your-feature-name`.
6. Open a **Pull Request** against the `main` branch.

Please adhere to the **code of conduct** (no harassment, respectful communication) and write **unit tests** for any new functionality.

---

## 📜 License

This project is released under the **MIT License** – see the `LICENSE` file for details.

---

## 🗺️ Roadmap

- **Mobile‑first UI** – adapt the studio for iOS/Android browsers.
- **OAuth Integration** – allow Google/GitHub login for persistent user profiles.
- **Persisted Drafts** – store drafts in MongoDB instead of local file system.
- **Live Audio Mixing** – enable multiple participants to mix tracks together in real time.
- **Leaderboard & Achievements** – gamify the spin‑wheel with persistent rankings.

---

<div align="center">
  <p>Built with ❤️ for vocal artists, producers, and developers who love real‑time collaboration.</p>
</div>