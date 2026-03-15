import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { deductTicket, getTickets } from '../services/ticketService.js';
import { pullCard } from '../services/gachaService.js';

const router = Router();
router.use(authMiddleware);

router.get('/status', (req: AuthRequest, res: Response) => {
  const tickets = getTickets(req.userId!);
  res.json({ tickets });
});

router.post('/pull', (req: AuthRequest, res: Response) => {
  if (!deductTicket(req.userId!)) {
    res.status(400).json({ error: 'No pull tickets available' });
    return;
  }
  const result = pullCard(req.userId!);
  const tickets = getTickets(req.userId!);
  res.json({ ...result, tickets });
});

router.post('/pull/multi', (req: AuthRequest, res: Response) => {
  const count = Math.min(req.body.count || 10, 20);

  const results = [];
  for (let i = 0; i < count; i++) {
    if (!deductTicket(req.userId!)) break;
    results.push(pullCard(req.userId!));
  }

  if (results.length === 0) {
    res.status(400).json({ error: 'No pull tickets available' });
    return;
  }

  const tickets = getTickets(req.userId!);
  res.json({ results, tickets });
});

export default router;
