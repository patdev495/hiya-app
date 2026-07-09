import type { Outcome, Config, PredictionResult } from './types';

export const ALL_OUTCOMES: Outcome[] = [
  'x5_1',
  'x5_2',
  'x5_3',
  'x5_4',
  'x10',
  'x15',
  'x25',
  'x45'
];

export const MULTIPLIERS: Record<Outcome, number> = {
  x5_1: 5,
  x5_2: 5,
  x5_3: 5,
  x5_4: 5,
  x10: 10,
  x15: 15,
  x25: 25,
  x45: 45
};

// Compute normalized base probabilities
export const getBaseProbabilities = (): Record<Outcome, number> => {
  const raw: Record<Outcome, number> = {} as any;
  let sum = 0;
  for (const o of ALL_OUTCOMES) {
    raw[o] = 1 / MULTIPLIERS[o];
    sum += raw[o];
  }
  const normalized: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    normalized[o] = raw[o] / sum;
  }
  return normalized;
};

// Count occurrences of context and its transitions in the history
const countContext = (
  history: Outcome[],
  context: Outcome[]
): { total: number; transitions: Record<Outcome, number> } => {
  const k = context.length;
  let total = 0;
  const transitions: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    transitions[o] = 0;
  }

  // Iterate over all possible starting positions in history that are followed by a transition
  for (let i = 0; i <= history.length - k - 1; i++) {
    let match = true;
    for (let j = 0; j < k; j++) {
      if (history[i + j] !== context[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      total++;
      const nextOutcome = history[i + k];
      transitions[nextOutcome]++;
    }
  }

  return { total, transitions };
};

export const calculatePrediction = (
  history: Outcome[],
  config: Config
): PredictionResult => {
  // 1. Get active history window
  const activeHistory = history.slice(-config.historyWindow);
  const m = activeHistory.length;

  const baseProbs = getBaseProbabilities();

  // 2. Base 0-order probability estimation (P0) with Bayesian smoothing
  const overallCounts: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    overallCounts[o] = 0;
  }
  for (const o of activeHistory) {
    overallCounts[o]++;
  }

  const p0: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    p0[o] = (overallCounts[o] + config.priorStrength * baseProbs[o]) / (m + config.priorStrength);
  }

  // 3. Variable-order Markov chain blending
  const K = Math.min(m, config.maxOrder);
  let pPrev = { ...p0 };
  let finalContext: Outcome[] = [];
  let finalContextCount = 0;
  let matchedOrder = 0;

  for (let k = 1; k <= K; k++) {
    const context = activeHistory.slice(-k);
    const { total: contextCount, transitions } = countContext(activeHistory, context);

    const pk: Record<Outcome, number> = {} as any;
    for (const o of ALL_OUTCOMES) {
      const pLower = pPrev[o];
      pk[o] = (transitions[o] + config.minSupport * pLower) / (contextCount + config.minSupport);
    }

    pPrev = pk;
    finalContext = context;
    finalContextCount = contextCount;
    matchedOrder = k;
  }

  // 4. Determine confidence level
  // High: maxOrder is fully reached and has support >= minSupport
  // Medium: maxOrder is not supported, but 1st order context has support >= minSupport
  // Low: otherwise
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (m >= 1) {
    const context1 = activeHistory.slice(-1);
    const { total: count1 } = countContext(activeHistory, context1);

    if (config.maxOrder > 0 && m >= config.maxOrder) {
      const contextMax = activeHistory.slice(-config.maxOrder);
      const { total: countMax } = countContext(activeHistory, contextMax);
      if (countMax >= config.minSupport) {
        confidence = 'high';
      } else if (count1 >= config.minSupport) {
        confidence = 'medium';
      }
    } else if (count1 >= config.minSupport) {
      confidence = 'medium';
    }
  }

  // 5. Convert probabilities to percentages and normalize to exactly 100.00%
  let sumRounded = 0;
  const probabilities: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    const percentage = pPrev[o] * 100;
    const rounded = Math.round(percentage * 100) / 100;
    probabilities[o] = rounded;
    sumRounded += rounded;
  }

  const diff = Math.round((100 - sumRounded) * 100) / 100;
  if (diff !== 0) {
    let maxOutcome = ALL_OUTCOMES[0];
    let maxVal = probabilities[maxOutcome];
    for (const o of ALL_OUTCOMES) {
      if (probabilities[o] > maxVal) {
        maxVal = probabilities[o];
        maxOutcome = o;
      }
    }
    probabilities[maxOutcome] = Math.round((probabilities[maxOutcome] + diff) * 100) / 100;
  }

  // 6. Select top outcome (consistent tie breaking)
  let topOutcome = ALL_OUTCOMES[0];
  let maxProb = probabilities[topOutcome];
  for (const o of ALL_OUTCOMES) {
    if (probabilities[o] > maxProb) {
      maxProb = probabilities[o];
      topOutcome = o;
    }
  }

  return {
    activeHistory,
    probabilities,
    topOutcome,
    confidence,
    evidence: {
      activeContext: finalContext,
      contextCount: finalContextCount,
      matchedOrder
    }
  };
};
