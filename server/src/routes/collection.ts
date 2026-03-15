import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { DUPES_TO_NEXT_LEVEL, MAX_LEVEL, LEVEL_MULTIPLIER } from '../constants.js';

const router = Router();
router.use(authMiddleware);

router.get('/cards', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const cards = db.prepare(`
    SELECT uc.*, p.name, p.sprite_url, p.artwork_url, p.type1, p.type2
    FROM user_cards uc
    JOIN pokemon p ON p.id = uc.pokemon_id
    WHERE uc.user_id = ?
    ORDER BY uc.pokemon_id, CASE uc.grade
      WHEN 'SSS' THEN 1 WHEN 'SS' THEN 2 WHEN 'S' THEN 3
      WHEN 'A' THEN 4 WHEN 'B' THEN 5 WHEN 'C' THEN 6
      WHEN 'D' THEN 7 WHEN 'E' THEN 8
    END
  `).all(req.userId!) as any[];

  res.json(cards.map(c => ({
    id: c.id,
    userId: c.user_id,
    pokemonId: c.pokemon_id,
    grade: c.grade,
    level: c.level,
    atk: c.atk,
    def: c.def,
    hp: c.hp,
    dupeCount: c.dupe_count,
    obtainedAt: c.obtained_at,
    pokemon: {
      id: c.pokemon_id,
      name: c.name,
      spriteUrl: c.sprite_url,
      artworkUrl: c.artwork_url,
      type1: c.type1,
      type2: c.type2,
    },
  })));
});

router.get('/pokedex', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const allPokemon = db.prepare('SELECT * FROM pokemon ORDER BY id').all() as any[];
  const collected = db.prepare(
    'SELECT DISTINCT pokemon_id FROM user_cards WHERE user_id = ?'
  ).all(req.userId!) as { pokemon_id: number }[];
  const collectedSet = new Set(collected.map(c => c.pokemon_id));

  res.json(allPokemon.map(p => ({
    id: p.id,
    name: p.name,
    spriteUrl: p.sprite_url,
    artworkUrl: p.artwork_url,
    type1: p.type1,
    type2: p.type2,
    collected: collectedSet.has(p.id),
  })));
});

router.get('/cards/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const card = db.prepare(`
    SELECT uc.*, p.name, p.sprite_url, p.artwork_url, p.type1, p.type2
    FROM user_cards uc
    JOIN pokemon p ON p.id = uc.pokemon_id
    WHERE uc.id = ? AND uc.user_id = ?
  `).get(req.params.id, req.userId!) as any;

  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const dupesNeeded = card.level < MAX_LEVEL ? DUPES_TO_NEXT_LEVEL[card.level - 1] : 0;
  const currentDupesForLevel = card.dupe_count - getCumulativeDupes(card.level - 1);

  res.json({
    id: card.id,
    userId: card.user_id,
    pokemonId: card.pokemon_id,
    grade: card.grade,
    level: card.level,
    atk: card.atk,
    def: card.def,
    hp: card.hp,
    dupeCount: card.dupe_count,
    obtainedAt: card.obtained_at,
    dupesNeeded,
    currentDupesForLevel,
    canEnhance: card.level < MAX_LEVEL && currentDupesForLevel >= dupesNeeded,
    pokemon: {
      id: card.pokemon_id,
      name: card.name,
      spriteUrl: card.sprite_url,
      artworkUrl: card.artwork_url,
      type1: card.type1,
      type2: card.type2,
    },
  });
});

router.post('/cards/:id/enhance', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const card = db.prepare('SELECT * FROM user_cards WHERE id = ? AND user_id = ?').get(req.params.id, req.userId!) as any;
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }
  if (card.level >= MAX_LEVEL) { res.status(400).json({ error: 'Already max level' }); return; }

  const dupesNeeded = DUPES_TO_NEXT_LEVEL[card.level - 1];
  const currentDupesForLevel = card.dupe_count - getCumulativeDupes(card.level - 1);

  if (currentDupesForLevel < dupesNeeded) {
    res.status(400).json({ error: `Need ${dupesNeeded - currentDupesForLevel} more duplicates` });
    return;
  }

  const newLevel = card.level + 1;
  const mult = LEVEL_MULTIPLIER(newLevel) / LEVEL_MULTIPLIER(card.level);
  const newAtk = Math.floor(card.atk * mult);
  const newDef = Math.floor(card.def * mult);
  const newHp = Math.floor(card.hp * mult);

  db.prepare('UPDATE user_cards SET level = ?, atk = ?, def = ?, hp = ? WHERE id = ?')
    .run(newLevel, newAtk, newDef, newHp, card.id);

  res.json({ success: true, level: newLevel, atk: newAtk, def: newDef, hp: newHp });
});

// 일괄 강화
router.post('/cards/enhance-all', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const cards = db.prepare('SELECT * FROM user_cards WHERE user_id = ?').all(req.userId!) as any[];

  let enhancedCount = 0;
  const results: any[] = [];

  const enhance = db.transaction(() => {
    for (const card of cards) {
      if (card.level >= MAX_LEVEL) continue;

      let currentLevel = card.level;
      let currentAtk = card.atk;
      let currentDef = card.def;
      let currentHp = card.hp;
      let upgraded = false;

      while (currentLevel < MAX_LEVEL) {
        const dupesNeeded = DUPES_TO_NEXT_LEVEL[currentLevel - 1];
        const currentDupesForLevel = card.dupe_count - getCumulativeDupes(currentLevel - 1);
        if (currentDupesForLevel < dupesNeeded) break;

        const newLevel = currentLevel + 1;
        const mult = LEVEL_MULTIPLIER(newLevel) / LEVEL_MULTIPLIER(currentLevel);
        currentAtk = Math.floor(currentAtk * mult);
        currentDef = Math.floor(currentDef * mult);
        currentHp = Math.floor(currentHp * mult);
        currentLevel = newLevel;
        upgraded = true;
      }

      if (upgraded) {
        db.prepare('UPDATE user_cards SET level = ?, atk = ?, def = ?, hp = ? WHERE id = ?')
          .run(currentLevel, currentAtk, currentDef, currentHp, card.id);
        enhancedCount++;
        results.push({ id: card.id, level: currentLevel, atk: currentAtk, def: currentDef, hp: currentHp });
      }
    }
  });

  enhance();
  res.json({ enhancedCount, results });
});

function getCumulativeDupes(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) {
    total += DUPES_TO_NEXT_LEVEL[i];
  }
  return total;
}

export default router;
