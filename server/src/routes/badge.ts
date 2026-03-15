import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { BADGES } from '../constants.js';

const router = Router();
router.use(authMiddleware);

// 뱃지 목록 (전체 + 보유 여부)
router.get('/list', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const owned = db.prepare('SELECT badge_id, obtained_at FROM user_badges WHERE user_id = ?')
    .all(req.userId!) as { badge_id: number; obtained_at: string }[];
  const ownedMap = new Map(owned.map(o => [o.badge_id, o.obtained_at]));

  const badges = BADGES.map(b => ({
    id: b.id,
    name: b.name,
    engName: b.engName,
    leader: b.leader,
    type: b.type,
    color: b.color,
    owned: ownedMap.has(b.id),
    obtainedAt: ownedMap.get(b.id) || null,
  }));

  res.json(badges);
});

// 프로필 설정
router.post('/profile', (req: AuthRequest, res: Response) => {
  const { type, value } = req.body; // type: 'pokemon' | 'badge' | null, value: id
  const db = getDb();

  if (type === null || type === undefined) {
    // 프로필 초기화
    db.prepare('UPDATE users SET profile_type = NULL, profile_value = NULL WHERE id = ?').run(req.userId!);
    res.json({ profileType: null, profileValue: null });
    return;
  }

  if (type === 'badge') {
    const badge = db.prepare('SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?').get(req.userId!, value);
    if (!badge) { res.status(400).json({ error: '보유하지 않은 뱃지입니다' }); return; }
  } else if (type === 'pokemon') {
    const card = db.prepare('SELECT id FROM user_cards WHERE user_id = ? AND pokemon_id = ?').get(req.userId!, value);
    if (!card) { res.status(400).json({ error: '보유하지 않은 포켓몬입니다' }); return; }
  } else {
    res.status(400).json({ error: 'type must be "pokemon" or "badge"' });
    return;
  }

  db.prepare('UPDATE users SET profile_type = ?, profile_value = ? WHERE id = ?').run(type, value, req.userId!);
  res.json({ profileType: type, profileValue: value });
});

// 내 프로필 조회
router.get('/profile', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT profile_type, profile_value FROM users WHERE id = ?').get(req.userId!) as any;
  res.json({ profileType: user.profile_type, profileValue: user.profile_value });
});

export default router;
