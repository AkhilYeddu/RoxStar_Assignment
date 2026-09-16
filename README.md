# RoxxStar 🎙️🎸

> A real-time, unified audio platform for vocal artists to record, mix, and collaborate on voice drafts in private social rooms, featuring a multiplayer spin wheel arena!

![RoxxStar Banner](https://via.placeholder.com/1200x400/0F172A/0284C7?text=RoxxStar+Audio+Platform)

## 🌟 Features

*   **Audio Studio & DSP Engine**: Record raw voice takes and apply real-time DSP effects (Studio Reverb, Auto-Tune simulation, Megaphone, Cyberpunk, and Echo).
*   **Draft Management System**: Name, preview, share, and delete your audio drafts locally or broadcast them to live rooms.
*   **Real-time Social Rooms**: Create or join private, authoritative live audio rooms via Socket.IO.
*   **Synchronized Audio Broadcasts**: When a draft is shared to a room, playback is synchronized for all connected users.
*   **Multiplayer Spin Wheel Arena**: A real-time competitive elimination game inside social rooms for 3-20 players, built with an authoritative backend engine to award virtual points to the winner!
*   **Premium Dark Aesthetic**: A sleek, dynamic dark-mode interface built with modern UI principles.

## 🚀 Tech Stack

### Frontend
*   **React + Vite**: Fast, modern frontend architecture.
*   **Web Audio API**: Powerful in-browser audio recording, playback, and real-time DSP effects manipulation.
*   **Socket.IO Client**: Real-time bidirectional event-based communication.
*   **Lucide React**: Clean, lightweight iconography.

### Backend
*   **Node.js & Express**: Scalable backend API structure.
*   **Socket.IO Server**: Managing namespaces, room states, presence, and authoritative game loops.
*   **Mongoose (MongoDB)**: Data modeling for users, rooms, drafts, and spin game audits (currently using `mongodb-memory-server` for zero-config local testing).

## 💻 Getting Started (Local Development)

### Prerequisites
*   Node.js (v16+ recommended)
*   npm

### 1. Backend Setup
Navigate to the backend directory, install dependencies, and start the server. The backend uses an in-memory MongoDB instance by default.

```bash
cd backend
npm install
npm start
```
The backend runs on **http://localhost:5000**.

### 2. Frontend Setup
Open a new terminal, navigate to the frontend directory, install dependencies, and start the Vite development server.

```bash
cd frontend
npm install
npm run dev
```
The frontend runs on **http://localhost:5173**.

## 🧪 Testing

The backend includes a comprehensive suite of Jest tests covering APIs, WebSocket connections, and authoritative game engines.

```bash
cd backend
npm test
```

## 🔐 Room Privacy & Connectivity
All rooms created in the lobby are private by default. A 6-character unique code is generated for each room. To join a room, users must explicitly use the "Join by Room Code" form.

## 📄 License
This project is for educational and portfolio purposes.
