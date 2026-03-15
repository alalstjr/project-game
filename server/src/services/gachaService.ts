import { getDb } from '../database.js';
import { GRADE_PROBABILITIES, GRADE_STAT_RANGES, type Grade } from '../constants.js';
import { getPokemonIdsByGrade } from '../pokemonGrades.js';

function rollGrade(): Grade {
  const rand = Math.random();
  let cumulative = 0;
  const grades: Grade[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'];
  for (const grade of grades) {
    cumulative += GRADE_PROBABILITIES[grade];
    if (rand < cumulative) return grade;
  }
  return 'E';
}

function rollStat(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPokemonById(pokemonId: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM pokemon WHERE id = ?').get(pokemonId) as {
    id: number; name: string; sprite_url: string; artwork_url: string; type1: string; type2: string | null;
  };
}

export function pullCard(userId: number) {
  const db = getDb();

  // 1. 등급 확률 롤
  const grade = rollGrade();

  // 2. 해당 등급 포켓몬 풀에서 랜덤 선택
  const pool = getPokemonIdsByGrade(grade);
  const pokemonId = pool[Math.floor(Math.random() * pool.length)];

  const range = GRADE_STAT_RANGES[grade];
  const baseAtk = rollStat(range.min, range.max);
  const baseDef = rollStat(range.min, range.max);
  const baseHp = rollStat(range.min, range.max);

  const existing = db.prepare(
    'SELECT * FROM user_cards WHERE user_id = ? AND pokemon_id = ? AND grade = ?'
  ).get(userId, pokemonId, grade) as any;

  let isDuplicate = false;
  let card: any;

  if (existing) {
    isDuplicate = true;
    const newDupeCount = existing.dupe_count + 1;

    // 중복 카드: dupe_count만 증가, 레벨/스탯은 사용자가 직접 강화할 때만 변경
    db.prepare(
      'UPDATE user_cards SET dupe_count = ? WHERE id = ?'
    ).run(newDupeCount, existing.id);

    card = db.prepare('SELECT * FROM user_cards WHERE id = ?').get(existing.id);
  } else {
    db.prepare(
      'INSERT INTO user_cards (user_id, pokemon_id, grade, atk, def, hp) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, pokemonId, grade, baseAtk, baseDef, baseHp);
    card = db.prepare('SELECT * FROM user_cards WHERE user_id = ? AND pokemon_id = ? AND grade = ?').get(userId, pokemonId, grade);
  }

  db.prepare(
    'INSERT INTO pull_history (user_id, pokemon_id, grade, was_duplicate) VALUES (?, ?, ?, ?)'
  ).run(userId, pokemonId, grade, isDuplicate ? 1 : 0);

  const pokemon = getPokemonById(pokemonId);

  return {
    card: {
      id: card.id,
      userId: card.user_id,
      pokemonId: card.pokemon_id,
      grade: card.grade as Grade,
      level: card.level,
      atk: card.atk,
      def: card.def,
      hp: card.hp,
      dupeCount: card.dupe_count,
      obtainedAt: card.obtained_at,
      pokemon: {
        id: pokemon.id,
        name: pokemon.name,
        spriteUrl: pokemon.sprite_url,
        artworkUrl: pokemon.artwork_url,
        type1: pokemon.type1,
        type2: pokemon.type2,
      },
    },
    isDuplicate,
    isNew: !isDuplicate,
  };
}
