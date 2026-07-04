# Codeforces Arena 🏆

**Codeforces Arena** is a real-time multiplayer platform designed for competitive programmers. It allows users to create custom game rooms, set problem rating constraints, and race against their friends to solve Codeforces problems. 

Instead of practicing alone, Codeforces Arena turns algorithmic problem-solving into a fast-paced multiplayer game!

## 🚀 Features

- **Real-Time Multiplayer:** Create or join public/private arenas. Leaderboards, game states, and chat are synced in real-time across all connected clients.
- **Custom Rating Constraints:** The host can specify the exact minimum and maximum rating for the problems they want to practice, ensuring the problems fit the skill level of the players.
- **Automated Verification Engine:** An asynchronous backend worker validates submissions directly against the Codeforces API, avoiding rate limits while seamlessly updating the live leaderboard.
- **Secure Codeforces Linking:** A built-in 2-step verification system securely links Codeforces handles to player accounts, preventing impersonation.
- **Spectator Mode:** Users can jump into live matches to watch their friends compete and chat with them without participating.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React.js + Vite
- **Styling:** TailwindCSS + Vanilla CSS (Glassmorphism design)
- **Animations:** Framer Motion
- **Real-Time:** Socket.io-client
- **Authentication:** Supabase Auth

### Backend
- **Environment:** Node.js + Express
- **Real-Time:** Socket.io
- **Worker Queue:** BullMQ + Redis (Handles Codeforces API validation)
- **Database:** Supabase (PostgreSQL)

## 🏎️ How It Works

1. **Authentication:** Users sign up and securely link their Codeforces handle by changing their profile name to a temporary verification token.
2. **Room Creation:** A user creates an arena and selects a rating range (e.g., 1000 - 1500) and duration.
3. **Problem Selection:** The backend automatically queries the database of Codeforces problems, filters out problems that participants have already solved, and randomly selects fresh problems in the specified rating range.
4. **Gameplay:** The timer starts. As users solve problems on Codeforces, they click "Verify Solve". 
5. **Background Workers:** The backend BullMQ worker pings the Codeforces API to verify the `OK` verdict. Upon success, the live leaderboard updates and plays sound effects for all participants!

## ⚙️ Running Locally

### Prerequisites
- Node.js (v18+)
- Redis Server (Local or Upstash)
- Supabase Project

### 1. Clone the repository
```bash
git clone https://github.com/Rahilj45/codeforces-arena.git
cd codeforces-arena
```

### 2. Setup Backend
```bash
cd cf-arena-backend
npm install
```
Create a `.env` file in the `cf-arena-backend` directory with the following variables:
```
PORT=3000
REDIS_URL=your_redis_connection_url
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```
Start the backend server:
```bash
npm start
```

### 3. Setup Frontend
```bash
cd ../cf-arena-frontend
npm install
```
Create a `.env` file in the `cf-arena-frontend` directory with the following variables:
```
VITE_BACKEND_URL=http://localhost:3000
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
Start the frontend development server:
```bash
npm run dev
```

## 📜 License
This project is licensed under the MIT License.
