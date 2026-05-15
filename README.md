# ♟️ ChessArena — Real-time Multiplayer Chess

> Portfolio-level multiplayer chess web application with real-time gameplay, ELO ratings, room-based play, and random matchmaking.

## 🚀 Quick Start (Local Development)

```bash
# 1. Dependencies ইনস্টল করো
bun install

# 2. .env তৈরি করো
cp .env.example .env

# 3. Database setup
bunx prisma generate
bunx prisma db push

# 4. Chess server চালু করো (Terminal 1)
cd mini-services/chess-server && bun install && bun run dev

# 5. Main app চালু করো (Terminal 2)
bun run dev

# 6. ব্রাউজারে যাও
http://localhost:3000
```

## 🌐 Live Deployment (cPanel + Render.com)

**ডিপ্লয়মেন্ট গাইড এখানে:** [`DEPLOYMENT.md`](./DEPLOYMENT.md)

### সংক্ষিপ্ত:
| কোন অংশ | কোথায় | খরচ |
|---------|-------|------|
| Frontend | cPanel (static files) | ফ্রি |
| Backend API | Render.com | ফ্রি |
| Socket Server | Render.com | ফ্রি |
| MySQL DB | cPanel | ফ্রি |

### প্রজেক্ট স্ট্রাকচার:
```
chess-arena/
├── src/                    # Frontend (Next.js) → cPanel এ upload
├── server/                 # Backend API (Express) → Render.com এ deploy
├── mini-services/
│   └── chess-server/       # Socket.io Server → Render.com এ deploy
├── prisma/schema.prisma    # Database schema (local dev)
├── DEPLOYMENT.md           # ★ সম্পূর্ণ ডিপ্লয়মেন্ট গাইড (বাংলা)
└── README.md               # এই ফাইল
```

## ✨ Features
- JWT Authentication with bcrypt
- Room-based play (create & join with 6-char ID)
- Random matchmaking queue
- Server-authoritative chess (chess.js validation)
- Game timer with low-time warnings
- ELO rating system (K=32)
- In-game chat, resign, draw offers
- Leaderboard & game history

## 🛠️ Tech Stack
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand
- **Backend:** Express.js, Socket.io, chess.js
- **Database:** MySQL (cPanel) / SQLite (local dev) via Prisma ORM
- **Auth:** jose (JWT), bcryptjs

## 📁 API Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/games` | User's game history |
| GET | `/api/games/:id` | Game details |
| POST | `/api/games/end` | Record game + ELO update |
| GET | `/api/leaderboard` | Top 20 players |

## 📡 Socket Events
| Client → Server | Server → Client |
|----------------|----------------|
| `auth:join-queue` | `queue:joined` |
| `auth:create-room` | `room:created` |
| `auth:join-room` | `room:joined` |
| `game:move` | `game:move` |
| `game:resign` | `game:ended` |
| `game:offer-draw` | `game:draw-offered` |
| `game:chat` | `game:chat` |

## 📝 License
MIT — Free for personal and educational use.
