import { getDb } from '../database.js';
import { FARM_MAX_SLOTS, FARM_MAX_PER_SLOT, FARM_MINUTES_PER_TICKET, BADGE_DROP_RATE, BADGES } from '../constants.js';

function tryDropBadge(userId: number): { badgeId: number; badgeName: string } | null {
  if (Math.random() >= BADGE_DROP_RATE) return null;

  const db = getDb();
  // 아직 안 가진 뱃지 중 랜덤
  const owned = db.prepare('SELECT badge_id FROM user_badges WHERE user_id = ?').all(userId) as { badge_id: number }[];
  const ownedSet = new Set(owned.map(o => o.badge_id));
  const available = BADGES.filter(b => !ownedSet.has(b.id));
  if (available.length === 0) return null;

  const badge = available[Math.floor(Math.random() * available.length)];
  db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badge.id);
  return { badgeId: badge.id, badgeName: badge.name };
}

interface FarmSlotRow {
  id: number;
  user_id: number;
  slot: number;
  card_id: number;
  deployed_at: string;
}

interface CardRow {
  id: number;
  pokemon_id: number;
  grade: string;
  level: number;
  atk: number;
  def: number;
  hp: number;
}

interface PokemonRow {
  id: number;
  name: string;
  sprite_url: string;
  artwork_url: string;
  type1: string;
  type2: string | null;
}

function calcAccumulated(deployedAt: string, grade: string): number {
  const deployed = new Date(deployedAt + 'Z').getTime();
  const now = Date.now();
  const elapsedMin = (now - deployed) / (1000 * 60);
  const minutesPerTicket = FARM_MINUTES_PER_TICKET[grade] || 120;
  const raw = Math.floor(elapsedMin / minutesPerTicket);
  return Math.min(raw, FARM_MAX_PER_SLOT);
}

function nextTicketSeconds(deployedAt: string, grade: string): number | null {
  const accumulated = calcAccumulated(deployedAt, grade);
  if (accumulated >= FARM_MAX_PER_SLOT) return null; // 꽉 참

  const deployed = new Date(deployedAt + 'Z').getTime();
  const now = Date.now();
  const minutesPerTicket = FARM_MINUTES_PER_TICKET[grade] || 120;
  const elapsedMin = (now - deployed) / (1000 * 60);
  const nextTicketAt = (accumulated + 1) * minutesPerTicket;
  const remainingMin = nextTicketAt - elapsedMin;
  return Math.max(0, Math.ceil(remainingMin * 60));
}

function formatSlot(
  slot: number,
  farmRow: FarmSlotRow | null,
  card: CardRow | null,
  pokemon: PokemonRow | null
) {
  if (!farmRow || !card || !pokemon) {
    return { slot, empty: true as const };
  }

  const accumulated = calcAccumulated(farmRow.deployed_at, card.grade);
  const nextSec = nextTicketSeconds(farmRow.deployed_at, card.grade);
  const minutesPerTicket = FARM_MINUTES_PER_TICKET[card.grade] || 120;

  return {
    slot,
    empty: false as const,
    cardId: card.id,
    grade: card.grade,
    level: card.level,
    atk: card.atk,
    def: card.def,
    hp: card.hp,
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      spriteUrl: pokemon.sprite_url,
      artworkUrl: pokemon.artwork_url,
      type1: pokemon.type1,
      type2: pokemon.type2,
    },
    accumulated,
    maxPerSlot: FARM_MAX_PER_SLOT,
    minutesPerTicket,
    nextTicketInSeconds: nextSec,
    deployedAt: farmRow.deployed_at,
  };
}

export function getFarmStatus(userId: number) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM pokemon_farm WHERE user_id = ? ORDER BY slot'
  ).all(userId) as FarmSlotRow[];

  const slots = [];
  for (let s = 1; s <= FARM_MAX_SLOTS; s++) {
    const farmRow = rows.find(r => r.slot === s) || null;
    let card: CardRow | null = null;
    let pokemon: PokemonRow | null = null;
    if (farmRow) {
      card = db.prepare('SELECT * FROM user_cards WHERE id = ?').get(farmRow.card_id) as CardRow | null;
      if (card) {
        pokemon = db.prepare('SELECT * FROM pokemon WHERE id = ?').get(card.pokemon_id) as PokemonRow | null;
      }
    }
    slots.push(formatSlot(s, farmRow, card, pokemon));
  }

  return { slots, maxSlots: FARM_MAX_SLOTS };
}

export function deployToFarm(userId: number, slot: number, cardId: number) {
  const db = getDb();

  if (slot < 1 || slot > FARM_MAX_SLOTS) {
    throw new Error(`슬롯은 1~${FARM_MAX_SLOTS} 사이여야 합니다`);
  }

  // 카드 소유 검증
  const card = db.prepare('SELECT id FROM user_cards WHERE id = ? AND user_id = ?').get(cardId, userId);
  if (!card) throw new Error('소유하지 않은 카드입니다');

  // 이미 다른 슬롯에 배치된 카드인지 확인
  const existing = db.prepare(
    'SELECT slot FROM pokemon_farm WHERE user_id = ? AND card_id = ?'
  ).get(userId, cardId) as { slot: number } | undefined;
  if (existing && existing.slot !== slot) {
    throw new Error('이미 다른 슬롯에 배치된 카드입니다');
  }

  // 해당 슬롯에 이미 포켓몬이 있으면 회수 가능한 티켓 자동 회수
  const currentSlot = db.prepare(
    'SELECT * FROM pokemon_farm WHERE user_id = ? AND slot = ?'
  ).get(userId, slot) as FarmSlotRow | undefined;

  if (currentSlot) {
    const currentCard = db.prepare('SELECT grade FROM user_cards WHERE id = ?').get(currentSlot.card_id) as { grade: string } | undefined;
    if (currentCard) {
      const accumulated = calcAccumulated(currentSlot.deployed_at, currentCard.grade);
      if (accumulated > 0) {
        db.prepare('UPDATE users SET pull_tickets = pull_tickets + ? WHERE id = ?').run(accumulated, userId);
      }
    }
    db.prepare('DELETE FROM pokemon_farm WHERE user_id = ? AND slot = ?').run(userId, slot);
  }

  // 배치
  db.prepare(
    'INSERT INTO pokemon_farm (user_id, slot, card_id, deployed_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(userId, slot, cardId);
}

export function collectFromSlot(userId: number, slot: number) {
  const db = getDb();
  const farmRow = db.prepare(
    'SELECT * FROM pokemon_farm WHERE user_id = ? AND slot = ?'
  ).get(userId, slot) as FarmSlotRow | undefined;

  if (!farmRow) throw new Error('해당 슬롯에 배치된 포켓몬이 없습니다');

  const card = db.prepare('SELECT grade FROM user_cards WHERE id = ?').get(farmRow.card_id) as { grade: string };
  const accumulated = calcAccumulated(farmRow.deployed_at, card.grade);

  if (accumulated <= 0) throw new Error('아직 수집할 뽑기권이 없습니다');

  // 뽑기권 지급
  db.prepare('UPDATE users SET pull_tickets = pull_tickets + ? WHERE id = ?').run(accumulated, userId);

  // 타이머 리셋 (잔여 진행도 보존)
  const minutesPerTicket = FARM_MINUTES_PER_TICKET[card.grade] || 120;
  const consumedMs = accumulated * minutesPerTicket * 60 * 1000;
  const deployedMs = new Date(farmRow.deployed_at + 'Z').getTime();
  const newDeployed = new Date(deployedMs + consumedMs).toISOString().replace('Z', '').replace('T', ' ').split('.')[0];

  db.prepare('UPDATE pokemon_farm SET deployed_at = ? WHERE id = ?').run(newDeployed, farmRow.id);

  // 뱃지 드랍 시도
  const badgeDrop = tryDropBadge(userId);

  const userRow = db.prepare('SELECT pull_tickets FROM users WHERE id = ?').get(userId) as { pull_tickets: number };
  return { collected: accumulated, totalTickets: userRow.pull_tickets, badgeDrop };
}

export function collectAll(userId: number) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM pokemon_farm WHERE user_id = ? ORDER BY slot'
  ).all(userId) as FarmSlotRow[];

  let totalCollected = 0;

  for (const farmRow of rows) {
    const card = db.prepare('SELECT grade FROM user_cards WHERE id = ?').get(farmRow.card_id) as { grade: string } | undefined;
    if (!card) continue;

    const accumulated = calcAccumulated(farmRow.deployed_at, card.grade);
    if (accumulated <= 0) continue;

    totalCollected += accumulated;

    const minutesPerTicket = FARM_MINUTES_PER_TICKET[card.grade] || 120;
    const consumedMs = accumulated * minutesPerTicket * 60 * 1000;
    const deployedMs = new Date(farmRow.deployed_at + 'Z').getTime();
    const newDeployed = new Date(deployedMs + consumedMs).toISOString().replace('Z', '').replace('T', ' ').split('.')[0];

    db.prepare('UPDATE pokemon_farm SET deployed_at = ? WHERE id = ?').run(newDeployed, farmRow.id);
  }

  if (totalCollected > 0) {
    db.prepare('UPDATE users SET pull_tickets = pull_tickets + ? WHERE id = ?').run(totalCollected, userId);
  }

  // 뱃지 드랍 시도 (수확량이 있을 때만)
  const badgeDrop = totalCollected > 0 ? tryDropBadge(userId) : null;

  const userRow = db.prepare('SELECT pull_tickets FROM users WHERE id = ?').get(userId) as { pull_tickets: number };
  return { collected: totalCollected, totalTickets: userRow.pull_tickets, badgeDrop };
}

export function removeFromFarm(userId: number, slot: number) {
  const db = getDb();
  const farmRow = db.prepare(
    'SELECT * FROM pokemon_farm WHERE user_id = ? AND slot = ?'
  ).get(userId, slot) as FarmSlotRow | undefined;

  if (!farmRow) throw new Error('해당 슬롯에 배치된 포켓몬이 없습니다');

  // 남은 티켓 자동 회수
  const card = db.prepare('SELECT grade FROM user_cards WHERE id = ?').get(farmRow.card_id) as { grade: string } | undefined;
  let collected = 0;
  if (card) {
    collected = calcAccumulated(farmRow.deployed_at, card.grade);
    if (collected > 0) {
      db.prepare('UPDATE users SET pull_tickets = pull_tickets + ? WHERE id = ?').run(collected, userId);
    }
  }

  db.prepare('DELETE FROM pokemon_farm WHERE user_id = ? AND slot = ?').run(userId, slot);

  const user = db.prepare('SELECT pull_tickets FROM users WHERE id = ?').get(userId) as { pull_tickets: number };
  return { collected, totalTickets: user.pull_tickets };
}
