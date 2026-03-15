import { Router, Request, Response } from 'express';
import { getDb } from '../database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 2 || password.length < 4) {
    res.status(400).json({ error: 'Username (2+ chars) and password (4+ chars) required' });
    return;
  }

  const db = getDb();
  try {
    const hash = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, hash);
    const token = signToken(result.lastInsertRowid as number, username);
    res.json({ token, user: { id: result.lastInsertRowid, username, pullTickets: 300 } });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user || !comparePassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id, username);
  res.json({
    token,
    user: { id: user.id, username: user.username, pullTickets: user.pull_tickets },
  });
});

export default router;
