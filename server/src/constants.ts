export type Grade = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export const GRADES: Grade[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'];

export const GRADE_PROBABILITIES: Record<Grade, number> = {
  E: 0.42, D: 0.30, C: 0.15, B: 0.08,
  A: 0.035, S: 0.008, SS: 0.005, SSS: 0.002,
};

export const GRADE_STAT_RANGES: Record<Grade, { min: number; max: number }> = {
  E: { min: 10, max: 20 }, D: { min: 20, max: 35 },
  C: { min: 35, max: 50 }, B: { min: 50, max: 70 },
  A: { min: 70, max: 90 }, S: { min: 130, max: 160 },
  SS: { min: 180, max: 220 }, SSS: { min: 250, max: 300 },
};

export const DUPES_TO_NEXT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 5, 7, 10];
export const MAX_LEVEL = 10;
export const LEVEL_MULTIPLIER = (level: number): number => 1 + (level - 1) * 0.15;
export const TICKET_REGEN_MINUTES = 10;
export const INITIAL_FREE_PULLS = 300;
export const MAX_TICKETS = 9999;
export const TOTAL_POKEMON = 151;
export const CHALLENGER_MIN_TICKETS = 10;
export const DEFENDER_MIN_TICKETS = 10;
export const RANKING_WIN_POINTS = 10;

// ===== 뱃지 =====
export const BADGE_DROP_RATE = 0.03; // 농장 수확 시 3% 확률

export interface BadgeInfo {
  id: number;
  name: string;
  engName: string;
  leader: string;
  type: string;
  color: string;
}

export const BADGES: BadgeInfo[] = [
  { id: 1, name: '회색뱃지',  engName: 'Boulder Badge',  leader: '웅',     type: 'rock',     color: '#A8A878' },
  { id: 2, name: '블루뱃지',  engName: 'Cascade Badge',  leader: '이슬',   type: 'water',    color: '#6890F0' },
  { id: 3, name: '번개뱃지',  engName: 'Thunder Badge',  leader: '마티스', type: 'electric', color: '#F8D030' },
  { id: 4, name: '무지개뱃지', engName: 'Rainbow Badge', leader: '민화',   type: 'grass',    color: '#78C850' },
  { id: 5, name: '핑크뱃지',  engName: 'Soul Badge',     leader: '독수',   type: 'poison',   color: '#A040A0' },
  { id: 6, name: '골드뱃지',  engName: 'Marsh Badge',    leader: '초련',   type: 'psychic',  color: '#F85888' },
  { id: 7, name: '진홍뱃지',  engName: 'Volcano Badge',  leader: '강연',   type: 'fire',     color: '#F08030' },
  { id: 8, name: '초록뱃지',  engName: 'Earth Badge',    leader: '비주기', type: 'ground',   color: '#E0C068' },
];

// ===== 포켓몬 농장 =====
export const FARM_MAX_SLOTS = 5;
export const FARM_MAX_PER_SLOT = 10;

// 등급별 뽑기권 1개 생산에 걸리는 시간(분)
export const FARM_MINUTES_PER_TICKET: Record<string, number> = {
  E: 120,   // 2시간
  D: 90,    // 1시간 30분
  C: 60,    // 1시간
  B: 45,    // 45분
  A: 30,    // 30분
  S: 20,    // 20분
  SS: 15,   // 15분
  SSS: 10,  // 10분
};
