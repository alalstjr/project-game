export type Grade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface Pokemon {
  id: number;
  name: string;
  spriteUrl: string;
  artworkUrl: string;
  type1: string;
  type2: string | null;
}

export interface UserCard {
  id: number;
  userId: number;
  pokemonId: number;
  grade: Grade;
  level: number;
  atk: number;
  def: number;
  hp: number;
  dupeCount: number;
  obtainedAt: string;
  pokemon?: Pokemon;
}

export interface User {
  id: number;
  username: string;
  pullTickets: number;
  createdAt: string;
  firstLogin: string;
}

export interface PullResult {
  card: UserCard & { pokemon: Pokemon };
  isDuplicate: boolean;
  isNew: boolean;
  levledUp: boolean;
}

export interface BattleRecord {
  id: number;
  challengerId: number;
  defenderId: number;
  winnerId: number;
  challengerCard: UserCard & { pokemon: Pokemon };
  defenderCard: UserCard & { pokemon: Pokemon };
  challengerUsername: string;
  defenderUsername: string;
  battleDate: string;
}

export interface Opponent {
  id: number;
  username: string;
  pullTickets: number;
  totalCards: number;
  bestGrade: Grade | null;
  canChallenge: boolean;
}
