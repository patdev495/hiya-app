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
  const mode = (config.predictionMode === 'relative' && m >= 2) ? 'relative' : 'absolute';

  const baseProbs = getBaseProbabilities();

  if (mode === 'absolute') {
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

    // Convert to 100.00% percentages
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
  } else {
    // --- RELATIVE MODE ---
    // 1. Convert history to shifts: (index[i+1] - index[i]) mod 8
    const offsets: number[] = [];
    for (let i = 0; i < m - 1; i++) {
      const idx1 = ALL_OUTCOMES.indexOf(activeHistory[i]);
      const idx2 = ALL_OUTCOMES.indexOf(activeHistory[i + 1]);
      const shift = (idx2 - idx1 + 8) % 8;
      offsets.push(shift);
    }
    const L = offsets.length;

    // 2. Count frequencies of shifts
    const shiftCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    for (const d of offsets) {
      shiftCounts[d]++;
    }

    // 3. 0-order estimation on shifts (uniform prior of 1/8)
    let pPrevShift: Record<number, number> = {};
    for (let d = 0; d < 8; d++) {
      pPrevShift[d] = (shiftCounts[d] + config.priorStrength * 0.125) / (L + config.priorStrength);
    }

    const K = Math.min(L, config.maxOrder);
    let finalOffsetContextCount = L;
    let matchedOrder = 0;

    for (let k = 1; k <= K; k++) {
      const context = offsets.slice(-k);
      const { total: contextCount, transitions } = countOffsetContext(offsets, context);

      const pkShift: Record<number, number> = {};
      for (let d = 0; d < 8; d++) {
        const pLower = pPrevShift[d];
        pkShift[d] = (transitions[d] + config.minSupport * pLower) / (contextCount + config.minSupport);
      }

      pPrevShift = pkShift;
      finalOffsetContextCount = contextCount;
      matchedOrder = k;
    }

    // 4. Map predicted shifts back to absolute outcomes
    const idxLast = ALL_OUTCOMES.indexOf(activeHistory[m - 1]);
    const pOutcome: Record<Outcome, number> = {} as any;
    for (const o of ALL_OUTCOMES) {
      const idxO = ALL_OUTCOMES.indexOf(o);
      const shift = (idxO - idxLast + 8) % 8;
      pOutcome[o] = pPrevShift[shift];
    }

    // 5. Determine confidence level based on shifts context support
    let confidence: 'high' | 'medium' | 'low' = 'low';
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

    // 6. Convert to 100.00% percentages
    let sumRounded = 0;
    const probabilities: Record<Outcome, number> = {} as any;
    for (const o of ALL_OUTCOMES) {
      const percentage = pOutcome[o] * 100;
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

    let topOutcome = ALL_OUTCOMES[0];
    let maxProb = probabilities[topOutcome];
    for (const o of ALL_OUTCOMES) {
      if (probabilities[o] > maxProb) {
        maxProb = probabilities[o];
        topOutcome = o;
      }
    }

    // Context mapped back to outcomes for type safety and UI consistency
    const finalContext = activeHistory.slice(-matchedOrder);

    return {
      activeHistory,
      probabilities,
      topOutcome,
      confidence,
      evidence: {
        activeContext: finalContext,
        contextCount: finalOffsetContextCount,
        matchedOrder
      }
    };
  }
};
