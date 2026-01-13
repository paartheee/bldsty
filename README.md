# 🎮 Bldsty - Blind Story Game

A hilarious multiplayer party game where players answer questions without seeing what others wrote, creating unexpected and funny stories!

## 🌟 Features

- 🎯 Real-time multiplayer gameplay (4-12 players)
- 🔄 Live synchronization with Socket.IO
- 💬 Content moderation with profanity filter
- 🎨 Beautiful, animated UI with Framer Motion
- 📱 Fully responsive design
- ☁️ Cloud-based with Redis persistence

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Socket.IO, Node.js
- **Database**: Redis Cloud
- **Deployment**: Vercel (frontend) + Railway (backend)
- **State Management**: Zustand
- **Animations**: Framer Motion

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis Cloud account (free tier)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd bldsty-nextjs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Redis URL:
   ```env
   REDIS_URL=redis://default:PASSWORD@your-redis-host:port
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   ALLOWED_ORIGINS=http://localhost:3000
   ```

4. **Run the development servers**

   Open two terminal windows:

   **Terminal 1 - Socket.IO Server:**
   ```bash
   npm run dev:socket
   ```

   **Terminal 2 - Next.js Frontend:**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🎮 How to Play

1. **Create a Room**: Host creates a room and gets a 6-character code
2. **Join**: Friends join using the room code
3. **Answer Questions**: Each player answers one of four questions:
   - Who?
   - With whom?
   - Where?
   - How?
4. **Reveal**: See the hilarious story created from everyone's answers!
5. **Play Again**: Start a new round with shuffled questions

## 📦 Project Structure

```
bldsty-nextjs/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main game page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── GameBoard.tsx     # Game playing interface
│   ├── Lobby.tsx         # Pre-game lobby
│   └── RevealScreen.tsx  # Story reveal screen
├── lib/                   # Core business logic
│   ├── game-engine.ts    # Game logic and state
│   ├── game-store.ts     # Zustand state management
│   ├── redis-client.ts   # Redis operations
│   ├── socket-handler.ts # Socket.IO event handlers
│   └── profanity-filter.ts # Content moderation
├── types/                 # TypeScript type definitions
│   └── game.ts
├── server.ts             # Local dev server (Next.js + Socket.IO)
├── socket-server.ts      # Standalone Socket.IO server (for Railway)
└── DEPLOYMENT.md         # Deployment instructions
```

## 🚢 Deployment

This app uses a hybrid deployment strategy:
- **Frontend (Next.js)**: Deployed to Vercel
- **Backend (Socket.IO)**: Deployed to Railway

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Quick Deploy Commands

**Deploy to Railway (Socket.IO):**
```bash
# Push to GitHub, Railway auto-deploys
git push origin main
```

**Deploy to Vercel (Next.js):**
```bash
vercel --prod
```

## 🔧 Available Scripts

- `npm run dev` - Start Next.js dev server with Socket.IO (local dev)
- `npm run dev:socket` - Start standalone Socket.IO server
- `npm run build` - Build Next.js for production
- `npm run start` - Start production server (local)
- `npm run start:socket` - Start production Socket.IO server
- `npm run lint` - Run ESLint

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_URL` | Redis connection string | ✅ |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL | ✅ |
| `ALLOWED_ORIGINS` | CORS allowed origins | ✅ |
| `NEXT_PUBLIC_APP_URL` | App URL (for production) | ❌ |
| `PORT` | Server port (default: 3001) | ❌ |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - feel free to use this project for learning or fun!

## 🙏 Acknowledgments

- Inspired by classic party games like "Mad Libs"
- Built with modern web technologies
- Community feedback and contributions

## 📧 Support

Having issues? Check out:
- [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
- GitHub Issues for bug reports
- Socket.IO and Next.js documentation

---

**Made with ❤️ for fun game nights with friends!**
