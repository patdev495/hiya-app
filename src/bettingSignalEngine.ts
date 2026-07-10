import { ALL_OUTCOMES, calculatePrediction, MULTIPLIERS } from './predictionEngine';
import type { BacktestSummary, BettingCandidate, BettingSignal, Config, Outcome, PredictionMode, PredictionResult } from './types';

const DEFAULT_SAFETY_MARGIN = 0.5;

const getBreakEvenPercent = (outcome: Outcome): number => 100 / MULTIPLIERS[outcome];

const isX5Outcome = (outcome: Outcome): boolean => outcome.startsWith('x5_');
const LARGE_OUTCOMES: Outcome[] = ['x10', 'x15', 'x25', 'x45'];

const isLargeOutcome = (outcome: Outcome): boolean => LARGE_OUTCOMES.includes(outcome);

const isHotByRecentLargeOutcomes = (history: Outcome[], config: Config): boolean => {
  const windowSize = config.hotRegimeWindow || 15;
  const threshold = config.hotRegimeThreshold || 4;
  return history.slice(-windowSize).filter(isLargeOutcome).length >= threshold;
};

const getMultiTargetCandidates = (
  prediction: PredictionResult,
  history: Outcome[],
  config: Config,
  safetyMargin = DEFAULT_SAFETY_MARGIN
): { targets: Outcome[]; candidates: BettingCandidate[]; reasons: string[] } => {
  const isHot = isHotByRecentLargeOutcomes(history, config);
  const candidates: BettingCandidate[] = ALL_OUTCOMES.map((outcome) => {
    const breakEven = getBreakEvenPercent(outcome);
    const probability = prediction.probabilities[outcome];
    const requiredMultiple = isLargeOutcome(outcome) ? (isHot ? 2 : 3) : 1;
    return {
      outcome,
      probability,
      breakEven,
      edge: Math.round((probability - breakEven * requiredMultiple) * 100) / 100,
    };
  }).sort((a, b) => b.edge - a.edge);

  const largeSafety = safetyMargin;
  const smallSafety = safetyMargin * 10;

  const largeTargets = LARGE_OUTCOMES.filter((outcome) => {
    const probability = prediction.probabilities[outcome];
    const threshold = getBreakEvenPercent(outcome) * (isHot ? 2 : 3) + largeSafety;
    return probability >= threshold;
  });

  const x5Targets = ALL_OUTCOMES
    .filter(isX5Outcome)
    .sort((a, b) => prediction.probabilities[b] - prediction.probabilities[a]);

  const smallTargets = isHot
    ? x5Targets.filter((outcome) => prediction.probabilities[outcome] > (30 + smallSafety))
    : x5Targets.slice(0, 2);

  return {
    targets: [...largeTargets, ...smallTargets],
    candidates,
    reasons: [
      isHot
        ? 'Hot regime: bet large outcomes above 2x break-even.'
        : 'Non-hot regime: bet large outcomes above 3x break-even.',
      isHot
        ? 'Hot regime: bet x5 slots only above 30%.'
        : 'Non-hot regime: always bet top two x5 slots.',
    ],
  };
};

const calculateBettingSignalInternal = (
  history: Outcome[],
  prediction: PredictionResult,
  _config: Config,
  _safetyMargin = DEFAULT_SAFETY_MARGIN
): BettingSignal => {
  const { targets, candidates, reasons } = getMultiTargetCandidates(prediction, history, _config, _safetyMargin);

  if (targets.length === 0) {
    return {
      action: 'skip',
      target: null,
      targets: [],
      stakeLevel: 'skip',
      risk: 'low',
      candidates,
      agreementScore: 0,
      reasons: ['No outcome qualifies under the current regime rules.', ...reasons],
    };
  }

  return {
    action: 'normal',
    target: targets[0],
    targets,
    stakeLevel: 'normal',
    risk: 'medium',
    candidates,
    agreementScore: targets.length,
    reasons: [
      `Bet targets: ${targets.map((target) => target.toUpperCase()).join(', ')}.`,
      ...reasons,
    ],
  };
};

export const selectActivePredictionMode = (
  history: Outcome[],
  config: Config
): PredictionMode => {
  const autoWindow = config.autoModeWindow || 3;
  if (!config.useAutoModeSwitch || history.length < autoWindow) {
    return config.predictionMode;
  }

  const modes: PredictionMode[] = ['absolute', 'relative', 'decay'];
  let bestMode = config.predictionMode;
  let bestReturn = -Infinity;

  for (const mode of modes) {
    const modeConfig = {
      ...config,
      predictionMode: mode,
      useAutoModeSwitch: false,
      useAdaptiveSafety: false,
    };
    const backtest = calculateBacktest(history.slice(-autoWindow), modeConfig);
    if (backtest.estimatedReturn > bestReturn) {
      bestReturn = backtest.estimatedReturn;
      bestMode = mode;
    }
  }

  return bestMode;
};

const evaluateRecentPerformance = (
  history: Outcome[],
  config: Config
): { netReturn: number; isDriftDetected: boolean } => {
  const windowSize = 15;
  const startIdx = Math.max(0, history.length - windowSize);
  let activeBets = 0;
  let netReturn = 0;
  let wins = 0;

  for (let i = startIdx; i < history.length; i++) {
    const prefix = history.slice(0, i);
    const actual = history[i];
    const pred = calculatePrediction(prefix, config);
    const signal = calculateBettingSignalInternal(prefix, pred, config);

    const targets = signal.targets ?? (signal.target && ALL_OUTCOMES.includes(signal.target as Outcome) ? [signal.target as Outcome] : []);
    for (const target of targets) {
      activeBets++;
      if (actual === target) {
        wins++;
        netReturn += MULTIPLIERS[actual] - 1;
      } else {
        netReturn -= 1;
      }
    }
  }

  const isDriftDetected = activeBets >= 3 && (netReturn <= -2 || wins / activeBets < 0.15);
  return { netReturn, isDriftDetected };
};

const E_BASE = 7.7753; // Expected multiplier under base probabilities

export const calculateActualRtp = (
  history: Outcome[],
  windowSize = 100,
  theoreticalRtp = 96
): { rtpActual: number; rtpDeviation: number } => {
  if (history.length === 0) {
    return { rtpActual: theoreticalRtp, rtpDeviation: 0 };
  }
  const recentHistory = history.slice(-windowSize);
  let sumMultipliers = 0;
  for (const outcome of recentHistory) {
    sumMultipliers += MULTIPLIERS[outcome] || 5;
  }
  const averageMultiplier = sumMultipliers / recentHistory.length;
  const rtpActual = Math.round(((averageMultiplier / E_BASE) * theoreticalRtp) * 100) / 100;
  const rtpDeviation = Math.round((rtpActual - theoreticalRtp) * 100) / 100;
  return { rtpActual, rtpDeviation };
};

export const calculateKellyBets = (
  targets: Outcome[],
  prediction: PredictionResult,
  bankroll: number,
  kellyMultiplier = 0.25,
  rtpDeviation = 0
): Record<Outcome, number> => {
  const bets: Record<Outcome, number> = {} as any;
  for (const o of targets) {
    const p = (prediction.probabilities[o] || 0) / 100; // convert to 0-1
    const M = MULTIPLIERS[o] || 5;
    const b = M - 1; // net decimal odds
    
    // Kelly fraction: f = (p * b - q) / b = (p * M - 1) / (M - 1)
    const f = (p * M - 1) / b;
    if (f > 0) {
      // Calculate RTP adjustment multiplier
      const isLarge = isLargeOutcome(o);
      let rtpScale = 1.0;
      if (isLarge) {
        if (rtpDeviation < 0) {
          rtpScale = 1.0 + Math.min(1.0, (Math.abs(rtpDeviation) / 100) * 2.0);
        } else if (rtpDeviation > 0) {
          rtpScale = Math.max(0.1, 1.0 - (rtpDeviation / 100) * 2.0);
        }
      } else {
        if (rtpDeviation > 0) {
          rtpScale = 1.0 + Math.min(1.0, (rtpDeviation / 100) * 2.0);
        } else if (rtpDeviation < 0) {
          rtpScale = Math.max(0.5, 1.0 - (Math.abs(rtpDeviation) / 100) * 1.0);
        }
      }

      const betAmount = Math.floor((bankroll * f * kellyMultiplier * rtpScale) / 10) * 10;
      if (betAmount > 0) {
        bets[o] = betAmount;
      }
    }
  }
  return bets;
};

export const calculateBettingSignal = (
  history: Outcome[],
  prediction: PredictionResult,
  config: Config
): BettingSignal => {
  let activeMode = config.predictionMode;
  let activePrediction = prediction;
  let activeConfig = config;

  activeMode = selectActivePredictionMode(history, config);
  if (activeMode !== config.predictionMode) {
    activeConfig = { ...config, predictionMode: activeMode };
    activePrediction = calculatePrediction(history, activeConfig);
  }

  // 2. RTP Adaptation
  let rtpActual = config.theoreticalRtp || 96;
  let rtpDeviation = 0;
  let activeSafetyMargin = DEFAULT_SAFETY_MARGIN;

  if (config.useRtpAdaptation) {
    const rtpStats = calculateActualRtp(history, config.rtpWindow || 100, config.theoreticalRtp || 96);
    rtpActual = rtpStats.rtpActual;
    rtpDeviation = rtpStats.rtpDeviation;
    // safetyShift = (rtpDeviation / 100) * sensitivity
    const sensitivity = config.rtpSensitivity !== undefined ? config.rtpSensitivity : 1.0;
    const safetyShift = (rtpDeviation / 100) * sensitivity;
    activeSafetyMargin = Math.max(0.01, Math.round((activeSafetyMargin + safetyShift) * 100) / 100);
  }

  // 3. Drift Detection
  let isDriftDetected = false;
  if (config.useAdaptiveSafety && history.length >= 15) {
    const evalConfig = { ...activeConfig, useAdaptiveSafety: false, useAutoModeSwitch: false };
    const perf = evaluateRecentPerformance(history, evalConfig);
    isDriftDetected = perf.isDriftDetected;
    if (isDriftDetected) {
      activeSafetyMargin = 2.0; // scale up safety margin to 2%
    }
  }

  // 4. Compute final signal
  const signal = calculateBettingSignalInternal(history, activePrediction, activeConfig, activeSafetyMargin);

  // 5. Compute Kelly bets if enabled
  let recommendedBets: Record<Outcome, number> | undefined = undefined;
  if (config.useKellyCriterion && signal.targets && signal.targets.length > 0) {
    recommendedBets = calculateKellyBets(
      signal.targets,
      activePrediction,
      config.bankroll || 1000000,
      config.kellyMultiplier !== undefined ? config.kellyMultiplier : 0.25,
      rtpDeviation
    );
  }

  return {
    ...signal,
    adaptiveSafetyMargin: activeSafetyMargin,
    isDriftDetected,
    activeMode,
    rtpActual,
    rtpDeviation,
    recommendedBets,
  };
};

export const calculateBacktest = (
  history: Outcome[],
  config: Config
): BacktestSummary => {
  const summary: BacktestSummary = {
    totalEvaluated: 0,
    skipped: 0,
    actionCounts: {
      skip: 0,
      probe: 0,
      normal: 0,
      'tiny-shot': 0,
    },
    hitsByTarget: {},
    estimatedReturn: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    currentWinStreak: 0,
    currentLossStreak: 0,
  };

  let currentWins = 0;
  let currentLosses = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;

  for (let i = 1; i < history.length; i++) {
    const prefix = history.slice(0, i);
    const actual = history[i];
    const prediction = calculatePrediction(prefix, config);
    const signal = calculateBettingSignal(prefix, prediction, config);

    summary.totalEvaluated++;
    summary.actionCounts[signal.stakeLevel]++;

    const targets = signal.targets ?? (signal.target && ALL_OUTCOMES.includes(signal.target as Outcome) ? [signal.target as Outcome] : []);
    if (signal.action === 'skip' || targets.length === 0) {
      summary.skipped++;
      currentWins = 0;
      currentLosses = 0;
      continue;
    }

    // Check if any target was hit
    const hitAny = targets.includes(actual);
    if (hitAny) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }

    for (const target of targets) {
      const targetStats = summary.hitsByTarget[target] ?? { hits: 0, attempts: 0, hitRate: 0 };
      targetStats.attempts++;

      const hit = actual === target;
      if (hit) {
        targetStats.hits++;
        summary.estimatedReturn += MULTIPLIERS[actual] - 1;
      } else {
        summary.estimatedReturn -= 1;
      }

      targetStats.hitRate = Math.round((targetStats.hits / targetStats.attempts) * 10000) / 100;
      summary.hitsByTarget[target] = targetStats;
    }

  }

  summary.estimatedReturn = Math.round(summary.estimatedReturn * 100) / 100;
  summary.maxConsecutiveWins = maxConsecutiveWins;
  summary.maxConsecutiveLosses = maxConsecutiveLosses;
  summary.currentWinStreak = currentWins;
  summary.currentLossStreak = currentLosses;
  return summary;
};
