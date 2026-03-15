import { getDb } from '../database.js';
import { CHALLENGER_MIN_TICKETS, DEFENDER_MIN_TICKETS, RANKING_WIN_POINTS } from '../constants.js';

// ===== 덱 관리 =====

export function getDeck(userId: number) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT bd.deck_type, bd.slot, bd.card_id,
      uc.pokemon_id, uc.grade, uc.level, uc.atk, uc.def, uc.hp,
      p.name, p.sprite_url, p.artwork_url, p.type1, p.type2
    FROM battle_deck bd
    JOIN user_cards uc ON uc.id = bd.card_id
    JOIN pokemon p ON p.id = uc.pokemon_id
    WHERE bd.user_id = ?
    ORDER BY bd.deck_type, bd.slot
  `).all(userId) as any[];

  const attack: any[] = [];
  const defense: any[] = [];

  for (const r of rows) {
    const card = {
      slot: r.slot,
      cardId: r.card_id,
      grade: r.grade,
      level: r.level,
      atk: r.atk,
      def: r.def,
      hp: r.hp,
      pokemon: {
        id: r.pokemon_id,
        name: r.name,
        spriteUrl: r.sprite_url,
        artworkUrl: r.artwork_url,
        type1: r.type1,
        type2: r.type2,
      },
    };
    if (r.deck_type === 'attack') attack.push(card);
    else defense.push(card);
  }

  return { attack, defense };
}

export function setDeck(userId: number, deckType: 'attack' | 'defense', cardIds: number[]) {
  const db = getDb();

  if (cardIds.length !== 3) throw new Error('카드 3장을 선택해야 합니다');

  // 중복 체크
  if (new Set(cardIds).size !== 3) throw new Error('같은 카드를 중복 선택할 수 없습니다');

  // 카드 소유 검증
  for (const cardId of cardIds) {
    const card = db.prepare('SELECT id FROM user_cards WHERE id = ? AND user_id = ?').get(cardId, userId);
    if (!card) throw new Error('소유하지 않은 카드가 포함되어 있습니다');
  }

  // 공격/방어 간 중복 체크
  const otherType = deckType === 'attack' ? 'defense' : 'attack';
  const otherCards = db.prepare('SELECT card_id FROM battle_deck WHERE user_id = ? AND deck_type = ?')
    .all(userId, otherType) as { card_id: number }[];
  const otherSet = new Set(otherCards.map(c => c.card_id));
  for (const cardId of cardIds) {
    if (otherSet.has(cardId)) throw new Error('공격덱과 방어덱에 같은 카드를 넣을 수 없습니다');
  }

  // 저장 (upsert)
  const upsert = db.prepare(`
    INSERT INTO battle_deck (user_id, card_id, deck_type, slot)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, deck_type, slot) DO UPDATE SET card_id = excluded.card_id
  `);

  const tx = db.transaction(() => {
    for (let i = 0; i < 3; i++) {
      upsert.run(userId, cardIds[i], deckType, i + 1);
    }
  });
  tx();
}

// ===== 덱 준비 상태 확인 =====

function getUserDeck(userId: number, deckType: 'attack' | 'defense') {
  const db = getDb();
  return db.prepare(`
    SELECT bd.slot, bd.card_id, uc.atk, uc.def, uc.hp, uc.grade, uc.level, uc.pokemon_id
    FROM battle_deck bd
    JOIN user_cards uc ON uc.id = bd.card_id
    WHERE bd.user_id = ? AND bd.deck_type = ?
    ORDER BY bd.slot
  `).all(userId, deckType) as any[];
}

function isDeckReady(userId: number): boolean {
  const atk = getUserDeck(userId, 'attack');
  const def = getUserDeck(userId, 'defense');
  return atk.length === 3 && def.length === 3;
}

// ===== 상대 목록 =====

export function getOpponents(userId: number) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const users = db.prepare(`
    SELECT u.id, u.username, u.pull_tickets, u.ranking_score,
      (SELECT COUNT(*) FROM user_cards WHERE user_id = u.id) as total_cards,
      (SELECT grade FROM user_cards WHERE user_id = u.id ORDER BY
        CASE grade
          WHEN 'SSS' THEN 1 WHEN 'SS' THEN 2 WHEN 'S' THEN 3
          WHEN 'A' THEN 4 WHEN 'B' THEN 5 WHEN 'C' THEN 6
          WHEN 'D' THEN 7 WHEN 'E' THEN 8
        END LIMIT 1) as best_grade,
      (SELECT COUNT(*) FROM battle_deck WHERE user_id = u.id AND deck_type = 'defense') as def_deck_count,
      (SELECT COUNT(*) FROM battles WHERE challenger_id = ? AND defender_id = u.id AND battle_date = ?) as battled_today
    FROM users u
    WHERE u.id != ? AND u.pull_tickets >= ?
  `).all(userId, today, userId, DEFENDER_MIN_TICKETS) as any[];

  return users.map(u => ({
    id: u.id,
    username: u.username,
    pullTickets: u.pull_tickets,
    rankingScore: u.ranking_score,
    totalCards: u.total_cards,
    bestGrade: u.best_grade as string | null,
    hasDefenseDeck: u.def_deck_count === 3,
    canChallenge: u.def_deck_count === 3 && u.battled_today === 0,
    battledToday: u.battled_today > 0,
  }));
}

// ===== 타입 상성표 (1세대 기준) =====

const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 2, flying: 0.5, psychic: 2, ghost: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2 },
  ghost:    { normal: 0, psychic: 0, ghost: 2 },
  dragon:   { dragon: 2 },
  fairy:    { fighting: 2, dragon: 2, fire: 0.5, poison: 0.5 },
  dark:     { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
};

function getTypeMultiplier(attackerType1: string, attackerType2: string | null, defenderType1: string, defenderType2: string | null): number {
  const atkTypes = [attackerType1, attackerType2].filter(Boolean) as string[];
  const defTypes = [defenderType1, defenderType2].filter(Boolean) as string[];
  // 공격측의 주 타입으로만 계산 (첫 번째 타입)
  const atkType = atkTypes[0] || 'normal';
  let multiplier = 1;
  for (const defType of defTypes) {
    multiplier *= TYPE_CHART[atkType]?.[defType] ?? 1;
  }
  return multiplier;
}

// ===== 타입별 공격 이름 =====

const TYPE_ATTACK_NAMES: Record<string, string[]> = {
  normal: ['몸통박치기', '돌진', '전력질주'],
  fire: ['불꽃세례', '화염방사', '불대문자'],
  water: ['물대포', '파도타기', '하이드로펌프'],
  electric: ['전기충격', '10만볼트', '번개'],
  grass: ['덩굴채찍', '잎날가르기', '솔라빔'],
  ice: ['냉동빔', '눈보라', '얼음펀치'],
  fighting: ['공수도베기', '지옥차', '파동탄'],
  poison: ['독찌르기', '오물폭탄', '독안개'],
  ground: ['지진', '땅고르기', '대지의힘'],
  flying: ['공기베기', '공중날기', '폭풍'],
  psychic: ['사이코키네시스', '사이코쇼크', '미래예지'],
  bug: ['벌레먹기', '시저크로스', '메가혼'],
  rock: ['돌떨구기', '스톤에지', '암석봉인'],
  ghost: ['섀도볼', '야습', '그림자펀치'],
  dragon: ['용의숨결', '드래곤클로', '유성군'],
  fairy: ['요정의바람', '문포스', '매지컬샤인'],
  dark: ['깨물어부수기', '악의파동', '이지메'],
  steel: ['아이언테일', '러스터캐논', '메탈클로'],
};

function getAttackName(type: string, isCritical: boolean): string {
  const names = TYPE_ATTACK_NAMES[type] || TYPE_ATTACK_NAMES['normal'];
  if (isCritical) return names[names.length - 1]; // 크리티컬은 가장 강한 기술
  return names[Math.floor(Math.random() * (names.length - 1))]; // 일반은 랜덤
}

// ===== 전투 시뮬레이션 =====

interface BattleLogEntry {
  timestamp: number;
  actor: 'challenger' | 'defender';
  actorName: string;
  skillName: string;
  damage: number;
  remainingHp: { challenger: number; defender: number };
  isCritical: boolean;
  typeEffect: 'super_effective' | 'not_effective' | 'immune' | 'normal';
}

interface RoundSimResult {
  log: BattleLogEntry[];
  winnerId: number;
  challengerMaxHp: number;
  defenderMaxHp: number;
  typeMultipliers: { challenger: number; defender: number };
}

function simulateRound(
  challengerCard: any, challengerPokemon: any,
  defenderCard: any, defenderPokemon: any,
  challengerId: number, defenderId: number,
  challengerName: string, defenderName: string,
): RoundSimResult {
  // 유효 HP (스탯 * 25 로 스케일)
  const cMaxHp = challengerCard.atk + challengerCard.def + challengerCard.hp > 0
    ? challengerCard.hp * 25 : 100;
  const dMaxHp = defenderCard.atk + defenderCard.def + defenderCard.hp > 0
    ? defenderCard.hp * 25 : 100;

  let cHp = cMaxHp;
  let dHp = dMaxHp;

  // 공격 간격 (ms): 기본 1800 - 총 스탯 * 1.5, 최소 400, 최대 2000
  const cTotalStats = challengerCard.atk + challengerCard.def + challengerCard.hp;
  const dTotalStats = defenderCard.atk + defenderCard.def + defenderCard.hp;
  const cInterval = Math.max(400, Math.min(2000, 1800 - cTotalStats * 1.5));
  const dInterval = Math.max(400, Math.min(2000, 1800 - dTotalStats * 1.5));

  // 타입 상성
  const cTypeMult = getTypeMultiplier(
    challengerPokemon.type1, challengerPokemon.type2,
    defenderPokemon.type1, defenderPokemon.type2,
  );
  const dTypeMult = getTypeMultiplier(
    defenderPokemon.type1, defenderPokemon.type2,
    challengerPokemon.type1, challengerPokemon.type2,
  );

  let cNext = cInterval;
  let dNext = dInterval;

  const log: BattleLogEntry[] = [];
  let safety = 200;

  while (cHp > 0 && dHp > 0 && safety-- > 0) {
    if (cNext <= dNext) {
      // 도전자 공격
      const isCrit = Math.random() < 0.12;
      const baseDmg = challengerCard.atk * 2.0 * (0.85 + Math.random() * 0.3);
      const defReduce = defenderCard.def * 0.4;
      const critMult = isCrit ? 1.5 : 1;
      const raw = (baseDmg - defReduce) * cTypeMult * critMult;
      const damage = Math.max(1, Math.floor(raw));

      dHp = Math.max(0, dHp - damage);

      const typeEffect = cTypeMult === 0 ? 'immune' as const
        : cTypeMult > 1 ? 'super_effective' as const
        : cTypeMult < 1 ? 'not_effective' as const
        : 'normal' as const;

      log.push({
        timestamp: Math.round(cNext),
        actor: 'challenger',
        actorName: challengerName,
        skillName: cTypeMult === 0 ? '공격' : getAttackName(challengerPokemon.type1, isCrit),
        damage: cTypeMult === 0 ? 0 : damage,
        remainingHp: { challenger: cHp, defender: dHp },
        isCritical: isCrit,
        typeEffect,
      });

      cNext += cInterval;
    } else {
      // 수비자 공격
      const isCrit = Math.random() < 0.12;
      const baseDmg = defenderCard.atk * 2.0 * (0.85 + Math.random() * 0.3);
      const defReduce = challengerCard.def * 0.4;
      const critMult = isCrit ? 1.5 : 1;
      const raw = (baseDmg - defReduce) * dTypeMult * critMult;
      const damage = Math.max(1, Math.floor(raw));

      cHp = Math.max(0, cHp - damage);

      const typeEffect = dTypeMult === 0 ? 'immune' as const
        : dTypeMult > 1 ? 'super_effective' as const
        : dTypeMult < 1 ? 'not_effective' as const
        : 'normal' as const;

      log.push({
        timestamp: Math.round(dNext),
        actor: 'defender',
        actorName: defenderName,
        skillName: dTypeMult === 0 ? '공격' : getAttackName(defenderPokemon.type1, isCrit),
        damage: dTypeMult === 0 ? 0 : damage,
        remainingHp: { challenger: cHp, defender: dHp },
        isCritical: isCrit,
        typeEffect,
      });

      dNext += dInterval;
    }
  }

  return {
    log,
    winnerId: dHp <= 0 ? challengerId : defenderId,
    challengerMaxHp: cMaxHp,
    defenderMaxHp: dMaxHp,
    typeMultipliers: { challenger: cTypeMult, defender: dTypeMult },
  };
}

function formatCard(c: any) {
  return {
    id: c.id ?? c.card_id, userId: c.user_id, pokemonId: c.pokemon_id,
    grade: c.grade, level: c.level, atk: c.atk, def: c.def, hp: c.hp,
    dupeCount: c.dupe_count ?? 0, obtainedAt: c.obtained_at ?? null,
  };
}

function formatPokemon(p: any) {
  return {
    id: p.id, name: p.name, spriteUrl: p.sprite_url,
    artworkUrl: p.artwork_url, type1: p.type1, type2: p.type2,
  };
}

function getFullCard(db: any, cardId: number) {
  const card = db.prepare('SELECT * FROM user_cards WHERE id = ?').get(cardId) as any;
  const pokemon = db.prepare('SELECT * FROM pokemon WHERE id = ?').get(card.pokemon_id) as any;
  return { card, pokemon };
}

export function executeBattle(challengerId: number, defenderId: number) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  // 오늘 이미 같은 상대와 배틀했는지 확인
  const alreadyBattled = db.prepare(
    'SELECT id FROM battles WHERE challenger_id = ? AND defender_id = ? AND battle_date = ?'
  ).get(challengerId, defenderId, today);
  if (alreadyBattled) throw new Error('오늘 이미 도전한 상대입니다. 내일 다시 도전하세요!');

  // 검증
  const challenger = db.prepare('SELECT pull_tickets, username FROM users WHERE id = ?').get(challengerId) as any;
  if (challenger.pull_tickets < CHALLENGER_MIN_TICKETS) throw new Error('뽑기권이 10개 이상 필요합니다');

  const defender = db.prepare('SELECT pull_tickets, username FROM users WHERE id = ?').get(defenderId) as any;
  if (defender.pull_tickets < DEFENDER_MIN_TICKETS) throw new Error('상대의 뽑기권이 부족합니다');

  // 덱 확인
  if (!isDeckReady(challengerId)) throw new Error('공격덱과 방어덱을 모두 설정해주세요');

  const attackDeck = getUserDeck(challengerId, 'attack');
  const defenseDeck = getUserDeck(defenderId, 'defense');
  if (defenseDeck.length !== 3) throw new Error('상대의 방어덱이 설정되어 있지 않습니다');

  // 3라운드 진행 (전투 시뮬레이션)
  const rounds: any[] = [];
  let challengerWins = 0;
  let defenderWins = 0;

  for (let i = 0; i < 3; i++) {
    const atkCard = attackDeck[i];
    const defCard = defenseDeck[i];

    const { card: atkFullCard, pokemon: atkPokemon } = getFullCard(db, atkCard.card_id);
    const { card: defFullCard, pokemon: defPokemon } = getFullCard(db, defCard.card_id);

    const sim = simulateRound(
      atkFullCard, atkPokemon,
      defFullCard, defPokemon,
      challengerId, defenderId,
      atkPokemon.name, defPokemon.name,
    );

    if (sim.winnerId === challengerId) challengerWins++;
    else defenderWins++;

    rounds.push({
      round: i + 1,
      challengerCard: { ...formatCard(atkFullCard), pokemon: formatPokemon(atkPokemon) },
      defenderCard: { ...formatCard(defFullCard), pokemon: formatPokemon(defPokemon) },
      winnerId: sim.winnerId,
      battleLog: sim.log,
      maxHp: { challenger: sim.challengerMaxHp, defender: sim.defenderMaxHp },
      typeMultipliers: sim.typeMultipliers,
    });
  }

  const winnerId = challengerWins >= 2 ? challengerId : defenderId;

  // 티켓 & 랭킹 변동 (승자 +10, 패자 -10)
  if (winnerId === challengerId) {
    db.prepare('UPDATE users SET pull_tickets = pull_tickets + 10, ranking_score = ranking_score + ? WHERE id = ?').run(RANKING_WIN_POINTS, challengerId);
    db.prepare('UPDATE users SET pull_tickets = MAX(pull_tickets - 10, 0) WHERE id = ?').run(defenderId);
  } else {
    db.prepare('UPDATE users SET pull_tickets = pull_tickets + 10, ranking_score = ranking_score + ? WHERE id = ?').run(RANKING_WIN_POINTS, defenderId);
    db.prepare('UPDATE users SET pull_tickets = MAX(pull_tickets - 10, 0) WHERE id = ?').run(challengerId);
  }

  // 기록 (1라운드 카드 ID로 대표 기록)
  db.prepare(
    'INSERT INTO battles (challenger_id, defender_id, winner_id, challenger_card_id, defender_card_id, battle_date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(challengerId, defenderId, winnerId, attackDeck[0].card_id, defenseDeck[0].card_id, today);

  return {
    winnerId,
    challengerUsername: challenger.username,
    defenderUsername: defender.username,
    challengerWins,
    defenderWins,
    rounds,
  };
}

export function executeTestBattle(challengerId: number) {
  const db = getDb();

  if (!isDeckReady(challengerId)) throw new Error('공격덱과 방어덱을 모두 설정해주세요');

  const attackDeck = getUserDeck(challengerId, 'attack');
  const cUser = db.prepare('SELECT username FROM users WHERE id = ?').get(challengerId) as any;

  // NPC 3장 생성
  const grades = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  const gradeWeights = [0.2, 0.2, 0.2, 0.15, 0.1, 0.08, 0.05, 0.02];
  const statRanges: Record<string, { min: number; max: number }> = {
    E: { min: 10, max: 20 }, D: { min: 20, max: 35 }, C: { min: 35, max: 50 },
    B: { min: 50, max: 70 }, A: { min: 70, max: 90 }, S: { min: 130, max: 160 },
    SS: { min: 180, max: 220 }, SSS: { min: 250, max: 300 },
  };

  function rollNpcCard() {
    let roll = Math.random(), cumulative = 0, npcGrade = 'E';
    for (let i = 0; i < grades.length; i++) {
      cumulative += gradeWeights[i];
      if (roll < cumulative) { npcGrade = grades[i]; break; }
    }
    const range = statRanges[npcGrade];
    const randStat = () => Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    const npcPokemonId = Math.floor(Math.random() * 151) + 1;
    const npcPokemon = db.prepare('SELECT * FROM pokemon WHERE id = ?').get(npcPokemonId) as any;
    return {
      card: {
        id: -1, user_id: -1, pokemon_id: npcPokemonId,
        grade: npcGrade, level: Math.ceil(Math.random() * 5),
        atk: randStat(), def: randStat(), hp: randStat(),
        dupe_count: 0, obtained_at: null,
      },
      pokemon: npcPokemon,
    };
  }

  const rounds: any[] = [];
  let challengerWins = 0;
  let defenderWins = 0;

  for (let i = 0; i < 3; i++) {
    const atkCard = attackDeck[i];
    const npc = rollNpcCard();

    const { card: atkFullCard, pokemon: atkPokemon } = getFullCard(db, atkCard.card_id);

    const sim = simulateRound(
      atkFullCard, atkPokemon,
      npc.card, npc.pokemon,
      challengerId, -1,
      atkPokemon.name, npc.pokemon.name,
    );

    if (sim.winnerId === challengerId) challengerWins++;
    else defenderWins++;

    rounds.push({
      round: i + 1,
      challengerCard: { ...formatCard(atkFullCard), pokemon: formatPokemon(atkPokemon) },
      defenderCard: { ...formatCard(npc.card), pokemon: formatPokemon(npc.pokemon) },
      winnerId: sim.winnerId,
      battleLog: sim.log,
      maxHp: { challenger: sim.challengerMaxHp, defender: sim.defenderMaxHp },
      typeMultipliers: sim.typeMultipliers,
    });
  }

  const winnerId = challengerWins >= 2 ? challengerId : -1;

  return {
    winnerId,
    challengerUsername: cUser.username,
    defenderUsername: 'NPC 트레이너',
    challengerWins,
    defenderWins,
    rounds,
    isTest: true,
  };
}

// ===== 랭킹 & 기록 =====

export function getRanking() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, username, ranking_score, profile_type, profile_value
    FROM users WHERE ranking_score > 0
    ORDER BY ranking_score DESC LIMIT 10
  `).all() as any[];

  return rows.map(r => {
    let profileImage: string | null = null;
    if (r.profile_type === 'pokemon') {
      const p = db.prepare('SELECT sprite_url FROM pokemon WHERE id = ?').get(r.profile_value) as any;
      if (p) profileImage = p.sprite_url;
    } else if (r.profile_type === 'badge') {
      profileImage = `badge:${r.profile_value}`;
    }
    return {
      id: r.id,
      username: r.username,
      ranking_score: r.ranking_score,
      profileType: r.profile_type,
      profileValue: r.profile_value,
      profileImage,
    };
  });
}

export function getBattleHistory(userId: number) {
  const db = getDb();
  const battles = db.prepare(`
    SELECT b.*, cu.username as challenger_username, du.username as defender_username
    FROM battles b
    JOIN users cu ON cu.id = b.challenger_id
    JOIN users du ON du.id = b.defender_id
    WHERE b.challenger_id = ? OR b.defender_id = ?
    ORDER BY b.created_at DESC LIMIT 20
  `).all(userId, userId) as any[];

  return battles.map(b => ({
    id: b.id,
    challengerId: b.challenger_id,
    defenderId: b.defender_id,
    winnerId: b.winner_id,
    challengerUsername: b.challenger_username,
    defenderUsername: b.defender_username,
    battleDate: b.battle_date,
  }));
}
