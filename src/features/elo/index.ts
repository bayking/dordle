export {
  calculateDailyEloChanges,
  getKFactor,
  type EloUpdate,
  type PlayerGame,
} from '@/features/elo/service';

export {
  getPlayersForWordle,
  applyEloUpdates,
  hasEloBeenCalculated,
  getEloHistory,
  getEloChangesForWordle,
  getEloHistoryForDateRange,
  resetServerElo,
  clearServerEloHistory,
  getInactiveUsers,
  applyEloDecay,
  getWordleNumbersForServer,
  type PlayerWithElo,
} from '@/features/elo/repository';

export { processWordleElo, recalculateServerElo } from '@/features/elo/processor';

export {
  DEFAULT_ELO,
  K_FACTOR_PROVISIONAL,
  K_FACTOR_ESTABLISHING,
  K_FACTOR_ESTABLISHED,
  PROVISIONAL_GAMES,
  ESTABLISHING_GAMES,
  MIN_PLAYERS_FOR_ELO,
  FAIL_EFFECTIVE_SCORE,
  FAIL_PENALTY,
  DECAY_THRESHOLD_DAYS,
  DECAY_AMOUNT,
  DECAY_FLOOR,
} from '@/features/elo/constants';
