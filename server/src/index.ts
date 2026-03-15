import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, seedPokemon } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import authRoutes from './routes/auth.js';
import gachaRoutes from './routes/gacha.js';
import collectionRoutes from './routes/collection.js';
import battleRoutes from './routes/battle.js';
import farmRoutes from './routes/farm.js';
import userRoutes from './routes/user.js';
import badgeRoutes from './routes/badge.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize DB
getDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gacha', gachaRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/farm', farmRoutes);
app.use('/api/user', userRoutes);
app.use('/api/badge', badgeRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Admin: 뽑기권 지급 (개발용)
app.post('/api/admin/tickets', (req, res) => {
  const { username, tickets } = req.body;
  if (!username || tickets == null) { res.status(400).json({ error: 'username and tickets required' }); return; }
  const db = getDb();
  const user = db.prepare('SELECT id, pull_tickets FROM users WHERE username = ?').get(username) as any;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  db.prepare('UPDATE users SET pull_tickets = ? WHERE username = ?').run(tickets, username);
  res.json({ username, pullTickets: tickets });
});

// 프로덕션: 클라이언트 빌드 파일 서빙
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function start() {
  await seedPokemon();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
