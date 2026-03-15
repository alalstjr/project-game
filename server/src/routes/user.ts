import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { getTickets } from '../services/ticketService.js';

const router = Router();
router.use(authMiddleware);

router.get('/me', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, created_at, first_login, profile_type, profile_value FROM users WHERE id = ?').get(req.userId!) as any;
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  const tickets = getTickets(req.userId!);
  const totalCards = (db.prepare('SELECT COUNT(*) as cnt FROM user_cards WHERE user_id = ?').get(req.userId!) as any).cnt;
  const uniquePokemon = (db.prepare('SELECT COUNT(DISTINCT pokemon_id) as cnt FROM user_cards WHERE user_id = ?').get(req.userId!) as any).cnt;

  // 프로필 이미지 resolve
  let profileImage: string | null = null;
  if (user.profile_type === 'pokemon') {
    const p = db.prepare('SELECT sprite_url FROM pokemon WHERE id = ?').get(user.profile_value) as any;
    if (p) profileImage = p.sprite_url;
  } else if (user.profile_type === 'badge') {
    profileImage = `badge:${user.profile_value}`;
  }

  res.json({
    ...user,
    pullTickets: tickets,
    totalCards,
    uniquePokemon,
    profileType: user.profile_type,
    profileValue: user.profile_value,
    profileImage,
  });
});

export default router;
