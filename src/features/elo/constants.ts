export const DEFAULT_ELO = 1500;

// K-factor determines how much ELO changes per game
// Higher = more volatile, Lower = more stable
export const K_FACTOR_PROVISIONAL = 80; // 0-10 games
export const K_FACTOR_ESTABLISHING = 64; // 11-30 games
export const K_FACTOR_ESTABLISHED = 48; // 31+ games

// Bonus ELO for having the best score of the day
export const DAILY_WINNER_BONUS = 10;

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

// Absent players are treated as having this score (worse than failing)
export const ABSENT_EFFECTIVE_SCORE = 10;

// How many days of inactivity before a player is no longer "active"
// (won't be penalized for missing days)
export const ACTIVE_THRESHOLD_DAYS = 7;

// ELO floor for absent penalty (don't drop below this)
export const ABSENT_ELO_FLOOR = 1200;
