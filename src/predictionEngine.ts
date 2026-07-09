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

// Count occurrences of context and its transitions in relative offset history
const countOffsetContext = (
  offsets: number[],
  context: number[]
): { total: number; transitions: Record<number, number> } => {
  const k = context.length;
  let total = 0;
  const transitions: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };

  for (let i = 0; i <= offsets.length - k - 1; i++) {
    let match = true;
    for (let j = 0; j < k; j++) {
      if (offsets[i + j] !== context[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      total++;
      const nextShift = offsets[i + k];
      transitions[nextShift]++;
    }
  }

  return { total, transitions };
};

export const calculatePrediction = (
  history: Outcome[],
  config: Config
): PredictionResult => {
  const activeHistory = history.slice(-config.historyWindow);
  const m = activeHistory.length;

  // If in relative mode, but we don't have enough history to compute transitions, fallback to absolute
  const mode = config.predictionMode === 'decay' 
    ? 'decay' 
    : (config.predictionMode === 'relative' && m >= 2) ? 'relative' : 'absolute';

  const baseProbs = getBaseProbabilities();

  let pRawOutcomes: Record<Outcome, number> = {} as any;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let finalContext: Outcome[] = [];
  let finalContextCount = 0;
  let matchedOrder = 0;
  let directional: { direction: 'forward' | 'backward' | 'stay' | 'half'; minSteps: number } | undefined;

  if (mode === 'decay') {
    // --- EXPONENTIAL DECAY FREQUENCY MODE ---
    const decayFactor = config.decayFactor !== undefined ? config.decayFactor : 0.95;
    const weights: Record<Outcome, number> = {} as any;
    for (const o of ALL_OUTCOMES) {
      weights[o] = 0;
    }

    const totalSpins = history.length;
    for (let i = 0; i < totalSpins; i++) {
      const outcome = history[i];
      const distance = totalSpins - 1 - i;
      weights[outcome] += Math.pow(decayFactor, distance);
    }

    let sumWeights = 0;
    for (const o of ALL_OUTCOMES) {
      sumWeights += weights[o];
    }

    for (const o of ALL_OUTCOMES) {
      pRawOutcomes[o] = (weights[o] + config.priorStrength * baseProbs[o]) / (sumWeights + config.priorStrength);
    }

    confidence = 'medium';
    finalContext = totalSpins > 0 ? [history[totalSpins - 1]] : [];
    finalContextCount = totalSpins;
    matchedOrder = 0;
  } else if (mode === 'absolute') {
    // --- ABSOLUTE MODE ---
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

    const K = Math.min(m, config.maxOrder);
    let pPrev = { ...p0 };
    finalContextCount = m;

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

    pRawOutcomes = pPrev;

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
  } else {
    // --- RELATIVE MODE ---
    const offsets: number[] = [];
    for (let i = 0; i < m - 1; i++) {
      const idx1 = ALL_OUTCOMES.indexOf(activeHistory[i]);
      const idx2 = ALL_OUTCOMES.indexOf(activeHistory[i + 1]);
      const shift = (idx2 - idx1 + 8) % 8;
      offsets.push(shift);
    }
    const L = offsets.length;

    const shiftCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    for (const d of offsets) {
      shiftCounts[d]++;
    }

    let pPrevShift: Record<number, number> = {};
    for (let d = 0; d < 8; d++) {
      pPrevShift[d] = (shiftCounts[d] + config.priorStrength * 0.125) / (L + config.priorStrength);
    }

    const K = Math.min(L, config.maxOrder);
    finalContextCount = L;

    for (let k = 1; k <= K; k++) {
      const context = offsets.slice(-k);
      const { total: contextCount, transitions } = countOffsetContext(offsets, context);

      const pkShift: Record<number, number> = {};
      for (let d = 0; d < 8; d++) {
        const pLower = pPrevShift[d];
        pkShift[d] = (transitions[d] + config.minSupport * pLower) / (contextCount + config.minSupport);
      }

      pPrevShift = pkShift;
      finalContextCount = contextCount;
      matchedOrder = k;
    }

    const idxLast = ALL_OUTCOMES.indexOf(activeHistory[m - 1]);
    for (const o of ALL_OUTCOMES) {
      const idxO = ALL_OUTCOMES.indexOf(o);
      const shift = (idxO - idxLast + 8) % 8;
      pRawOutcomes[o] = pPrevShift[shift];
    }

    if (L >= 1) {
      const context1 = offsets.slice(-1);
      const { total: count1 } = countOffsetContext(offsets, context1);

      if (config.maxOrder > 0 && L >= config.maxOrder) {
        const contextMax = offsets.slice(-config.maxOrder);
        const { total: countMax } = countOffsetContext(offsets, contextMax);
        if (countMax >= config.minSupport) {
          confidence = 'high';
        } else if (count1 >= config.minSupport) {
          confidence = 'medium';
        }
      } else if (count1 >= config.minSupport) {
        confidence = 'medium';
      }
    }

    finalContext = activeHistory.slice(-matchedOrder);

    // Calculate directional trends
    const pFwd = (pPrevShift[1] || 0) + (pPrevShift[2] || 0) + (pPrevShift[3] || 0);
    const pBwd = (pPrevShift[5] || 0) + (pPrevShift[6] || 0) + (pPrevShift[7] || 0);
    const pStay = pPrevShift[0] || 0;
    const pHalf = pPrevShift[4] || 0;

    let direction: 'forward' | 'backward' | 'stay' | 'half' = 'stay';
    let maxGroupVal = pStay;

    if (pFwd > maxGroupVal) {
      direction = 'forward';
      maxGroupVal = pFwd;
    }
    if (pBwd > maxGroupVal) {
      direction = 'backward';
      maxGroupVal = pBwd;
    }
    if (pHalf > maxGroupVal) {
      direction = 'half';
      maxGroupVal = pHalf;
    }

    let minSteps = 0;
    if (direction === 'half') {
      minSteps = 4;
    } else if (direction === 'forward') {
      const p3Cond = (pPrevShift[3] || 0) / (pFwd || 1);
      const p2PlusCond = ((pPrevShift[2] || 0) + (pPrevShift[3] || 0)) / (pFwd || 1);
      if (p3Cond >= 0.35) {
        minSteps = 3;
      } else if (p2PlusCond >= 0.65) {
        minSteps = 2;
      } else {
        minSteps = 1;
      }
    } else if (direction === 'backward') {
      const p3Cond = (pPrevShift[5] || 0) / (pBwd || 1);
      const p2PlusCond = ((pPrevShift[5] || 0) + (pPrevShift[6] || 0)) / (pBwd || 1);
      if (p3Cond >= 0.35) {
        minSteps = 3;
      } else if (p2PlusCond >= 0.65) {
        minSteps = 2;
      } else {
        minSteps = 1;
      }
    }

    directional = { direction, minSteps };
  }

  // --- REGIME ESTIMATOR & ADJUSTER ---
  const last15 = activeHistory.slice(-15);
  const largeOutcomes = ['x10', 'x15', 'x25', 'x45'];
  const largeCount = last15.filter(o => largeOutcomes.includes(o)).length;
  const regime = largeCount <= 1 ? 'cold' : 'hot';

  let pAdjusted = { ...pRawOutcomes };
  if (config.useRegimeAdjuster) {
    let sum = 0;
    for (const o of ALL_OUTCOMES) {
      if (largeOutcomes.includes(o)) {
        pAdjusted[o] = pRawOutcomes[o] * (regime === 'cold' ? 0.5 : 1.5);
      } else {
        pAdjusted[o] = pRawOutcomes[o];
      }
      sum += pAdjusted[o];
    }
    // Re-normalize
    for (const o of ALL_OUTCOMES) {
      pAdjusted[o] = pAdjusted[o] / (sum || 1);
    }
  }

  // --- PERCENTAGE ROUNDING & NORMALIZATION ---
  let sumRounded = 0;
  const probabilities: Record<Outcome, number> = {} as any;
  for (const o of ALL_OUTCOMES) {
    const percentage = pAdjusted[o] * 100;
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

  // --- TOP OUTCOME SELECTION ---
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
    },
    directional,
    regime,
    largeCount
  };
};
