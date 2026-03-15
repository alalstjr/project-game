import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { getFarmStatus, deployToFarm, collectFromSlot, collectAll, removeFromFarm } from '../services/farmService.js';

const router = Router();
router.use(authMiddleware);

// 농장 상태 조회
router.get('/status', (req: AuthRequest, res: Response) => {
  const status = getFarmStatus(req.userId!);
  res.json(status);
});

// 포켓몬 배치
router.post('/deploy', (req: AuthRequest, res: Response) => {
  const { slot, cardId } = req.body;
  if (!slot || !cardId) {
    res.status(400).json({ error: 'slot and cardId required' });
    return;
  }
  try {
    deployToFarm(req.userId!, slot, cardId);
    const status = getFarmStatus(req.userId!);
    res.json(status);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 특정 슬롯 수확
router.post('/collect', (req: AuthRequest, res: Response) => {
  const { slot } = req.body;
  if (!slot) {
    res.status(400).json({ error: 'slot required' });
    return;
  }
  try {
    const result = collectFromSlot(req.userId!, slot);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 전체 수확
router.post('/collect-all', (req: AuthRequest, res: Response) => {
  try {
    const result = collectAll(req.userId!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 포켓몬 회수 (슬롯에서 제거)
router.post('/remove', (req: AuthRequest, res: Response) => {
  const { slot } = req.body;
  if (!slot) {
    res.status(400).json({ error: 'slot required' });
    return;
  }
  try {
    const result = removeFromFarm(req.userId!, slot);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
