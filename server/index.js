const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { Chess } = require('chess.js');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'chess-arena-secret-key-2024';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ========== CORS MIDDLEWARE ==========
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ========== AUTH ROUTES ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        rating: 1200
      }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rating: user.rating
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ========== USER ROUTES ==========
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        rating: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, rating: true },
      orderBy: { rating: 'desc' },
      take: 20
    });
    res.json(users);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== GAME ROUTES ==========
app.post('/api/game/create', authMiddleware, async (req, res) => {
  try {
    const { timeControl } = req.body;

    const game = await prisma.game.create({
      data: {
        whiteId: req.user.id,
        status: 'waiting',
        timeControl: timeControl || '10+0',
        moves: ''
      },
      include: {
        white: { select: { id: true, username: true, rating: true } }
      }
    });

    res.status(201).json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/game/list', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { status: 'waiting' },
      include: {
        white: { select: { id: true, username: true, rating: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(games);
  } catch (error) {
    console.error('Game list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/game/:id', authMiddleware, async (req, res) => {
  try {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: {
        white: { select: { id: true, username: true, rating: true } },
        black: { select: { id: true, username: true, rating: true } }
      }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Game detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/games', authMiddleware, async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { whiteId: req.user.id },
          { blackId: req.user.id }
        ]
      },
      include: {
        white: { select: { id: true, username: true, rating: true } },
        black: { select: { id: true, username: true, rating: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(games);
  } catch (error) {
    console.error('User games error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== ACTIVE GAMES MAP ==========
const activeGames = new Map();

// ========== SOCKET.IO HANDLER ==========
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join a game room
  socket.on('join-game', async (gameId) => {
    try {
      socket.join(gameId);

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          white: { select: { id: true, username: true, rating: true } },
          black: { select: { id: true, username: true, rating: true } }
        }
      });

      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }

      // Initialize chess instance if not exists
      if (!activeGames.has(gameId)) {
        const chess = new Chess();
        const movesArr = game.moves ? game.moves.split(' ') : [];
        movesArr.forEach(move => {
          try { chess.move(move); } catch (e) { /* skip invalid */ }
        });
        activeGames.set(gameId, chess);
      }

      // Join as black player if waiting
      if (game.status === 'waiting' && game.whiteId !== socket.userId) {
        const updatedGame = await prisma.game.update({
          where: { id: gameId },
          data: { blackId: socket.userId, status: 'playing' },
          include: {
            white: { select: { id: true, username: true, rating: true } },
            black: { select: { id: true, username: true, rating: true } }
          }
        });

        io.to(gameId).emit('game-started', updatedGame);
        io.emit('game-list-updated');
      }

      // Send game state to the joining player
      const chess = activeGames.get(gameId);
      socket.emit('game-state', {
        fen: chess.fen(),
        turn: chess.turn(),
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isGameOver: chess.isGameOver(),
        pgn: chess.pgn()
      });

      // Send opponent info
      const opponentId = game.whiteId === socket.userId ? game.blackId : game.whiteId;
      socket.emit('opponent-info', {
        id: opponentId,
        isWhite: game.whiteId === socket.userId
      });

    } catch (error) {
      console.error('Join game error:', error);
      socket.emit('error', 'Failed to join game');
    }
  });

  // Handle chess move
  socket.on('move', async ({ gameId, from, to, promotion }) => {
    try {
      const chess = activeGames.get(gameId);
      if (!chess) {
        socket.emit('error', 'Game not active');
        return;
      }

      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game) return;

      // Verify it's the player's turn
      const isWhite = game.whiteId === socket.userId;
      if ((isWhite && chess.turn() !== 'w') || (!isWhite && chess.turn() !== 'b')) {
        socket.emit('error', 'Not your turn');
        return;
      }

      const moveResult = chess.move({ from, to, promotion });

      if (moveResult) {
        // Save move to database
        const newMoves = game.moves ? game.moves + ' ' + moveResult.san : moveResult.san;
        await prisma.game.update({
          where: { id: gameId },
          data: { moves: newMoves }
        });

        // Broadcast move to opponent
        socket.to(gameId).emit('move-made', {
          from,
          to,
          promotion,
          san: moveResult.san,
          fen: chess.fen(),
          isCheck: chess.isCheck(),
          isCheckmate: chess.isCheckmate(),
          isDraw: chess.isDraw(),
          isGameOver: chess.isGameOver(),
          pgn: chess.pgn()
        });

        // Handle game over
        if (chess.isGameOver()) {
          let result = '';
          let winnerId = null;

          if (chess.isCheckmate()) {
            winnerId = chess.turn() === 'w' ? game.blackId : game.whiteId;
            result = 'checkmate';
          } else if (chess.isDraw()) {
            result = 'draw';
          } else if (chess.isStalemate()) {
            result = 'stalemate';
          }

          await prisma.game.update({
            where: { id: gameId },
            data: { status: 'completed', result, winnerId }
          });

          // Update ratings
          if (winnerId) {
            const winner = await prisma.user.findUnique({ where: { id: winnerId } });
            const loserId = winnerId === game.whiteId ? game.blackId : game.whiteId;
            const loser = await prisma.user.findUnique({ where: { id: loserId } });

            if (winner && loser) {
              await prisma.user.update({
                where: { id: winnerId },
                data: { rating: winner.rating + 25 }
              });
              await prisma.user.update({
                where: { id: loserId },
                data: { rating: Math.max(0, loser.rating - 25) }
              });
            }
          }

          io.to(gameId).emit('game-over', {
            result,
            winnerId,
            fen: chess.fen(),
            pgn: chess.pgn()
          });

          activeGames.delete(gameId);
        }
      } else {
        socket.emit('error', 'Invalid move');
      }
    } catch (error) {
      console.error('Move error:', error);
      socket.emit('error', 'Move failed');
    }
  });

  // Handle resign
  socket.on('resign', async ({ gameId }) => {
    try {
      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game || game.status !== 'playing') return;

      const winnerId = game.whiteId === socket.userId ? game.blackId : game.whiteId;

      await prisma.game.update({
        where: { id: gameId },
        data: { status: 'completed', result: 'resignation', winnerId }
      });

      const winner = await prisma.user.findUnique({ where: { id: winnerId } });
      const loser = await prisma.user.findUnique({ where: { id: socket.userId } });

      if (winner && loser) {
        await prisma.user.update({
          where: { id: winnerId },
          data: { rating: winner.rating + 25 }
        });
        await prisma.user.update({
          where: { id: socket.userId },
          data: { rating: Math.max(0, loser.rating - 25) }
        });
      }

      io.to(gameId).emit('game-over', {
        result: 'resignation',
        winnerId,
        resignedBy: socket.userId
      });

      activeGames.delete(gameId);
    } catch (error) {
      console.error('Resign error:', error);
    }
  });

  // Handle draw offer
  socket.on('offer-draw', ({ gameId }) => {
    socket.to(gameId).emit('draw-offered', { offeredBy: socket.userId });
  });

  socket.on('accept-draw', async ({ gameId }) => {
    try {
      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game || game.status !== 'playing') return;

      await prisma.game.update({
        where: { id: gameId },
        data: { status: 'completed', result: 'draw' }
      });

      io.to(gameId).emit('game-over', { result: 'draw' });
      activeGames.delete(gameId);
    } catch (error) {
      console.error('Draw error:', error);
    }
  });

  // Handle chat
  socket.on('chat-message', ({ gameId, message }) => {
    io.to(gameId).emit('chat-message', {
      userId: socket.userId,
      username: socket.username,
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Run Prisma migrations on startup
    try {
      await prisma.$executeRaw`SELECT 1`;
      console.log('Database connection verified');
    } catch (dbError) {
      console.error('Database connection failed:', dbError.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
