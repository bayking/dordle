export const DEFAULT_ELO = 1500;

// K-factor determines how much ELO changes per game
// Higher = more volatile, Lower = more stable
export const K_FACTOR_PROVISIONAL = 40; // 0-10 games
export const K_FACTOR_ESTABLISHING = 32; // 11-30 games
export const K_FACTOR_ESTABLISHED = 24; // 31+ games

// Game count thresholds for K-factor tiers
export const PROVISIONAL_GAMES = 10;
export const ESTABLISHING_GAMES = 30;

// Minimum players required for ELO to change
export const MIN_PLAYERS_FOR_ELO = 2;

// Fail (X/7) is treated as this score for ELO calculation
// Makes failing significantly worse than scoring 6
export const FAIL_EFFECTIVE_SCORE = 9;

// Expected score caps to prevent extreme ELO changes
export const EXPECTED_SCORE_MIN = 0.1;
export const EXPECTED_SCORE_MAX = 0.9;

// Additional penalty for failing (X/7)
export const FAIL_PENALTY = 3;

// ELO decay settings
export const DECAY_THRESHOLD_DAYS = 7;
export const DECAY_AMOUNT = 10;
export const DECAY_FLOOR = 1200;
