import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { getOpponents, executeBattle, executeTestBattle, getBattleHistory, getRanking, getDeck, setDeck } from '../services/battleService.js';
import { getTickets } from '../services/ticketService.js';

const router = Router();
router.use(authMiddleware);

// 덱 조회
router.get('/deck', (req: AuthRequest, res: Response) => {
  const deck = getDeck(req.userId!);
  res.json(deck);
});

// 덱 설정
router.post('/deck', (req: AuthRequest, res: Response) => {
  const { deckType, cardIds } = req.body;
  if (!deckType || !Array.isArray(cardIds)) {
    res.status(400).json({ error: 'deckType and cardIds[] required' });
    return;
  }
  if (deckType !== 'attack' && deckType !== 'defense') {
    res.status(400).json({ error: 'deckType must be "attack" or "defense"' });
    return;
  }
  try {
    setDeck(req.userId!, deckType, cardIds);
    const deck = getDeck(req.userId!);
    res.json(deck);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/opponents', (req: AuthRequest, res: Response) => {
  const opponents = getOpponents(req.userId!);
  res.json(opponents);
});

router.post('/challenge', (req: AuthRequest, res: Response) => {
  const { defenderId } = req.body;
  if (!defenderId) {
    res.status(400).json({ error: 'defenderId required' });
    return;
  }
  try {
    const result = executeBattle(req.userId!, defenderId);
    const tickets = getTickets(req.userId!);
    res.json({ ...result, tickets });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/test-challenge', (req: AuthRequest, res: Response) => {
  try {
    const result = executeTestBattle(req.userId!);
    const tickets = getTickets(req.userId!);
    res.json({ ...result, tickets });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/ranking', (_req: AuthRequest, res: Response) => {
  res.json(getRanking());
});

router.get('/history', (req: AuthRequest, res: Response) => {
  res.json(getBattleHistory(req.userId!));
});

export default router;
