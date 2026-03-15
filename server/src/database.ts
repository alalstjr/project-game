import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'game.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now')),
      first_login   TEXT DEFAULT (date('now')),
      pull_tickets  INTEGER DEFAULT 300,
      last_ticket_at TEXT DEFAULT (datetime('now')),
      ranking_score INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pokemon (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      sprite_url    TEXT NOT NULL,
      artwork_url   TEXT NOT NULL,
      type1         TEXT NOT NULL,
      type2         TEXT
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      pokemon_id    INTEGER NOT NULL REFERENCES pokemon(id),
      grade         TEXT NOT NULL,
      level         INTEGER DEFAULT 1,
      atk           INTEGER NOT NULL,
      def           INTEGER NOT NULL,
      hp            INTEGER NOT NULL,
      dupe_count    INTEGER DEFAULT 0,
      obtained_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, pokemon_id, grade)
    );

    CREATE TABLE IF NOT EXISTS pull_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      pokemon_id    INTEGER NOT NULL,
      grade         TEXT NOT NULL,
      was_duplicate INTEGER DEFAULT 0,
      pulled_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS battles (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_id   INTEGER NOT NULL REFERENCES users(id),
      defender_id     INTEGER NOT NULL REFERENCES users(id),
      winner_id       INTEGER REFERENCES users(id),
      challenger_card_id INTEGER NOT NULL REFERENCES user_cards(id),
      defender_card_id   INTEGER NOT NULL REFERENCES user_cards(id),
      battle_date     TEXT DEFAULT (date('now')),
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: ranking_score 컬럼 추가 (기존 DB 호환)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ranking_score INTEGER DEFAULT 0`);
  } catch (_) { /* 이미 존재 */ }

  // 배틀 덱 테이블 (공격 3장, 방어 3장)
  db.exec(`
    CREATE TABLE IF NOT EXISTS battle_deck (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id),
      card_id   INTEGER NOT NULL REFERENCES user_cards(id),
      deck_type TEXT NOT NULL CHECK(deck_type IN ('attack', 'defense')),
      slot      INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 3),
      UNIQUE(user_id, deck_type, slot)
    );
  `);

  // 포켓몬 농장 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS pokemon_farm (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      slot        INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 5),
      card_id     INTEGER NOT NULL REFERENCES user_cards(id),
      deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, slot)
    );
  `);

  // 유저 뱃지 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_badges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      badge_id    INTEGER NOT NULL,
      obtained_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_id)
    );
  `);

  // 프로필 컬럼 추가 (profile_type: 'pokemon' | 'badge', profile_value: pokemonId 또는 badgeId)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN profile_type TEXT DEFAULT NULL`);
  } catch (_) { /* 이미 존재 */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN profile_value INTEGER DEFAULT NULL`);
  } catch (_) { /* 이미 존재 */ }
}

export async function seedPokemon() {
  const d = getDb();
  const count = d.prepare('SELECT COUNT(*) as cnt FROM pokemon').get() as { cnt: number };
  if (count.cnt >= 151) return;

  console.log('Seeding 151 Pokemon from PokeAPI...');
  for (let i = 1; i <= 151; i++) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${i}`);
      const data = await res.json();
      const name = data.name;
      const spriteUrl = data.sprites.front_default || '';
      const artworkUrl = data.sprites.other?.['official-artwork']?.front_default || spriteUrl;
      const type1 = data.types[0]?.type?.name || 'normal';
      const type2 = data.types[1]?.type?.name || null;

      d.prepare(
        'INSERT OR REPLACE INTO pokemon (id, name, sprite_url, artwork_url, type1, type2) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(i, name, spriteUrl, artworkUrl, type1, type2);

      if (i % 20 === 0) console.log(`  Seeded ${i}/151 Pokemon`);
    } catch (err) {
      console.error(`Failed to fetch pokemon ${i}:`, err);
    }
  }
  console.log('Pokemon seeding complete!');
}
