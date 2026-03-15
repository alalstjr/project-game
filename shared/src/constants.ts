import type { Grade } from './types.js';

export const GRADES: Grade[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'];

export const GRADE_PROBABILITIES: Record<Grade, number> = {
  E: 0.35,
  D: 0.25,
  C: 0.18,
  B: 0.12,
  A: 0.06,
  S: 0.025,
  SS: 0.01,
  SSS: 0.005,
};

export const GRADE_STAT_RANGES: Record<Grade, { min: number; max: number }> = {
  E:   { min: 10,  max: 20  },
  D:   { min: 20,  max: 35  },
  C:   { min: 35,  max: 50  },
  B:   { min: 50,  max: 70  },
  A:   { min: 70,  max: 90  },
  S:   { min: 130, max: 160 },
  SS:  { min: 180, max: 220 },
  SSS: { min: 250, max: 300 },
};

export const GRADE_COLORS: Record<Grade, string> = {
  E:   '#8B8B8B',
  D:   '#6B8E23',
  C:   '#4682B4',
  B:   '#9370DB',
  A:   '#FF6347',
  S:   '#FFD700',
  SS:  '#FF4500',
  SSS: '#FF00FF',
};

// Duplicates needed to reach each level
// Level 1 = base (0 dupes), Level 2 = 1 dupe, ..., Level 10 = cumulative 10 dupes
export const LEVEL_DUPE_REQUIREMENTS: number[] = [0, 1, 1, 2, 2, 3, 3, 4, 5, 10];
// cumulative: 0, 1, 2, 4, 6, 9, 12, 16, 21, 31 -- no, let's simplify
// Each index = dupes needed to go from that level to next
// e.g., LEVEL_DUPE_REQUIREMENTS[0] = 1 means 1 dupe to go from lv1->lv2

export const DUPES_TO_NEXT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 5, 7, 10];
// lv1->2: 1, lv2->3: 1, lv3->4: 2, ..., lv9->10: 10
// Max level is 10

export const MAX_LEVEL = 10;

export const LEVEL_MULTIPLIER = (level: number): number => {
  return 1 + (level - 1) * 0.05;
};

export const TICKET_REGEN_MINUTES = 10;
export const INITIAL_FREE_PULLS = 10;
export const MAX_TICKETS = 99;
export const TOTAL_POKEMON = 151;
export const BATTLE_MIN_TICKETS = 5;
