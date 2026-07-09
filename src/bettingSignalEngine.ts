import { ALL_OUTCOMES, calculatePrediction, MULTIPLIERS } from './predictionEngine';
import type { BacktestSummary, BettingAction, BettingCandidate, BettingSignal, Config, Outcome, PredictionResult, StakeLevel, TargetTier } from './types';

const DEFAULT_SAFETY_MARGIN = 0.5;

const getBreakEvenPercent = (outcome: Outcome): number => 100 / MULTIPLIERS[outcome];

const getPlayableCandidates = (
  prediction: PredictionResult,
  safetyMargin = DEFAULT_SAFETY_MARGIN
): BettingCandidate[] => {
  return ALL_OUTCOMES
    .map((outcome) => {
      const breakEven = getBreakEvenPercent(outcome);
      const probability = prediction.probabilities[outcome];
      return {
        outcome,
        probability,
        breakEven,
        edge: Math.round((probability - breakEven - safetyMargin) * 100) / 100,
      };
    })
    .filter((candidate) => candidate.edge > 0)
    .sort((a, b) => b.edge - a.edge);
};

const isX5Outcome = (outcome: Outcome): boolean => outcome.startsWith('x5_');

const toBalancedTier = (outcome: Outcome): {
  action: BettingAction;
  stakeLevel: StakeLevel;
  target: TargetTier;
} => {
  if (outcome === 'x25') {
    return { action: 'probe', stakeLevel: 'probe', target: 'x25' };
  }
  if (outcome === 'x45') {
    return { action: 'tiny-shot', stakeLevel: 'tiny-shot', target: 'x45' };
  }
  return { action: 'normal', stakeLevel: 'normal', target: 'x10-x15' };
};

const isLargeTier = (target: TargetTier): boolean => target !== 'x5';

const scoreAgreement = (
  prediction: PredictionResult,
  target: TargetTier
): { score: number; reasons: string[]; hasConflict: boolean } => {
  let score = 1;
  let hasConflict = false;
  const reasons: string[] = [];

  if (isLargeTier(target)) {
    if (prediction.regime === 'hot') {
      score++;
      reasons.push('Hot regime supports large-outcome targets.');
    } else if (prediction.regime === 'cold') {
      score--;
      hasConflict = true;
      reasons.push('Cold regime conflicts with large-outcome targets.');
    }
  }

  if (prediction.confidence === 'medium' || prediction.confidence === 'high') {
    score++;
    reasons.push('Transition evidence has medium or high support.');
  }

  return { score: Math.max(0, score), reasons, hasConflict };
};

const hasStrongExactX5Evidence = (
  candidate: BettingCandidate,
  prediction: PredictionResult,
  config: Config
): boolean => {
  return (
    isX5Outcome(candidate.outcome) &&
    candidate.outcome === prediction.topOutcome &&
    prediction.evidence.contextCount >= config.minSupport &&
    (prediction.confidence === 'medium' || prediction.confidence === 'high')
  );
};

const downgradeForConflict = (
  action: BettingAction,
  stakeLevel: StakeLevel,
  hasConflict: boolean
): { action: BettingAction; stakeLevel: StakeLevel } => {
  if (!hasConflict || action !== 'normal') {
    return { action, stakeLevel };
  }

  return { action: 'probe', stakeLevel: 'probe' };
};

export const calculateBettingSignal = (
  _history: Outcome[],
  prediction: PredictionResult,
  _config: Config
): BettingSignal => {
  const candidates = getPlayableCandidates(prediction);
  const exactX5Candidate = candidates.find((candidate) =>
    hasStrongExactX5Evidence(candidate, prediction, _config)
  );

  if (exactX5Candidate) {
    return {
      action: 'normal',
      target: exactX5Candidate.outcome,
      stakeLevel: 'normal',
      risk: 'medium',
      candidates,
      agreementScore: 3,
      reasons: [
        `${exactX5Candidate.outcome} clears break-even plus safety margin.`,
        'Exact x5 slot has strong supported evidence.',
      ],
    };
  }

  const balancedCandidates = candidates.filter((candidate) => !isX5Outcome(candidate.outcome));

  if (balancedCandidates.length === 0) {
    return {
      action: 'skip',
      target: null,
      stakeLevel: 'skip',
      risk: 'low',
      candidates,
      agreementScore: 0,
      reasons: candidates.length === 0
        ? ['No outcome clears break-even plus safety margin.']
        : ['Only generic x5 outcomes cleared the edge gate; exact-slot support is required.'],
    };
  }

  const topCandidate = balancedCandidates[0];
  const tier = toBalancedTier(topCandidate.outcome);
  const agreement = scoreAgreement(prediction, tier.target);
  const downgraded = downgradeForConflict(tier.action, tier.stakeLevel, agreement.hasConflict);

  return {
    action: downgraded.action,
    target: tier.target,
    stakeLevel: downgraded.stakeLevel,
    risk: downgraded.action === 'normal' ? 'medium' : 'high',
    candidates,
    agreementScore: agreement.score,
    reasons: [
      `${topCandidate.outcome} clears break-even plus safety margin.`,
      ...agreement.reasons,
    ],
  };
};

const targetMatchesOutcome = (target: BettingSignal['target'], actual: Outcome): boolean => {
  if (!target) {
    return false;
  }
  if (target === 'x10-x15') {
    return actual === 'x10' || actual === 'x15';
  }
  if (target === 'x25' || target === 'x45') {
    return actual === target;
  }
  if (target === 'x5') {
    return isX5Outcome(actual);
  }
  return actual === target;
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
  };

  for (let i = 1; i < history.length; i++) {
    const prefix = history.slice(0, i);
    const actual = history[i];
    const prediction = calculatePrediction(prefix, config);
    const signal = calculateBettingSignal(prefix, prediction, config);

    summary.totalEvaluated++;
    summary.actionCounts[signal.stakeLevel]++;

    if (signal.action === 'skip' || !signal.target) {
      summary.skipped++;
      continue;
    }

    const target = signal.target;
    const targetStats = summary.hitsByTarget[target] ?? { hits: 0, attempts: 0, hitRate: 0 };
    targetStats.attempts++;

    const hit = targetMatchesOutcome(target, actual);
    if (hit) {
      targetStats.hits++;
      summary.estimatedReturn += MULTIPLIERS[actual] - 1;
    } else {
      summary.estimatedReturn -= 1;
    }

    targetStats.hitRate = Math.round((targetStats.hits / targetStats.attempts) * 10000) / 100;
    summary.hitsByTarget[target] = targetStats;
  }

  summary.estimatedReturn = Math.round(summary.estimatedReturn * 100) / 100;
  return summary;
};
