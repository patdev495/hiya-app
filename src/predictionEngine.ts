import type { DeckWindowStats, Outcome, Config, PredictionResult } from './types';

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

export const calculateDeckWindowStats = (
  history: Outcome[],
  configuredSize: number
): DeckWindowStats => {
  const deckHistory = history.slice(-configuredSize);
  const baseProbs = getBaseProbabilities();
  const outcomes: DeckWindowStats['outcomes'] = {} as DeckWindowStats['outcomes'];

  for (const outcome of ALL_OUTCOMES) {
    const count = deckHistory.filter((item) => item === outcome).length;
    const expected = Math.round(deckHistory.length * baseProbs[outcome] * 100) / 100;
    const ratioPercent = expected > 0
      ? Math.round((count / expected) * 100)
      : 0;
    const countPercent = deckHistory.length > 0
      ? Math.round((count / deckHistory.length) * 10000) / 100
      : 0;
    const expectedPercent = Math.round(baseProbs[outcome] * 10000) / 100;
    outcomes[outcome] = {
      outcome,
      count,
      expected,
      deviation: Math.round((count - expected) * 100) / 100,
      ratioPercent,
      countPercent,
      expectedPercent,
    };
  }

  return {
    windowSize: deckHistory.length,
    configuredSize,
    outcomes,
  };
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

type PatternTier = 'small' | 'main' | 'rare';
type PatternDirection = 'up' | 'down' | 'same';
type WheelDirection = 'forward' | 'backward' | 'stay' | 'half';
type GapBucket = 'short' | 'medium' | 'long';
type AlternationState = 'alternating' | 'repeating' | 'mixed';

type PatternState = {
  lastOutcome: Outcome;
  previousOutcome: Outcome;
  lastTier: PatternTier;
  previousTier: PatternTier;
  tierDirection: PatternDirection;
  regime: 'hot' | 'cold';
  largeGap: GapBucket;
  exactGap: GapBucket;
  wheelDirection: WheelDirection;
  wheelShift: number;
  alternation: AlternationState;
};

type PatternFamily = {
  name: string;
  weight: number;
  serialize: (state: PatternState) => string;
};

const getPatternTier = (outcome: Outcome): PatternTier => {
  if (outcome.startsWith('x5_')) {
    return 'small';
  }

  return outcome === 'x10' || outcome === 'x15' ? 'main' : 'rare';
};

const getTierRank = (tier: PatternTier): number => {
  if (tier === 'small') return 0;
  if (tier === 'main') return 1;
  return 2;
};

const getGapBucket = (gap: number): GapBucket => {
  if (gap <= 2) return 'short';
  if (gap <= 6) return 'medium';
  return 'long';
};

const getLargeGapBucket = (history: Outcome[]): GapBucket => {
  const lastLargeIndex = [...history].reverse().findIndex((outcome) => !outcome.startsWith('x5_'));
  return getGapBucket(lastLargeIndex === -1 ? history.length : lastLargeIndex);
};

const getExactGapBucket = (history: Outcome[]): GapBucket => {
  const lastOutcome = history[history.length - 1];
  for (let index = history.length - 2; index >= 0; index--) {
    if (history[index] === lastOutcome) {
      return getGapBucket(history.length - 1 - index);
    }
  }

  return 'long';
};

const getPatternRegime = (history: Outcome[], config: Config): PatternState['regime'] => {
  const windowSize = Math.min(config.hotRegimeWindow || 15, history.length);
  const threshold = config.hotRegimeThreshold || 4;
  const recent = history.slice(-windowSize);
  const largeCount = recent.filter((outcome) => !outcome.startsWith('x5_')).length;
  return largeCount >= Math.min(threshold, Math.max(1, Math.ceil(windowSize / 3))) ? 'hot' : 'cold';
};

const getWheelShift = (previousOutcome: Outcome, lastOutcome: Outcome): number => {
  const previousIndex = ALL_OUTCOMES.indexOf(previousOutcome);
  const lastIndex = ALL_OUTCOMES.indexOf(lastOutcome);
  return (lastIndex - previousIndex + ALL_OUTCOMES.length) % ALL_OUTCOMES.length;
};

const getWheelDirection = (shift: number): WheelDirection => {
  if (shift === 0) return 'stay';
  if (shift === 4) return 'half';
  return shift <= 3 ? 'forward' : 'backward';
};

const getAlternationState = (history: Outcome[]): AlternationState => {
  if (history.length < 4) {
    return 'mixed';
  }

  const tiers = history.slice(-4).map(getPatternTier);
  const isAlternating = tiers.every((tier, index) => index < 2 || tier === tiers[index - 2])
    && tiers[0] !== tiers[1];
  if (isAlternating) {
    return 'alternating';
  }

  return tiers.every((tier) => tier === tiers[0]) ? 'repeating' : 'mixed';
};

const getPatternState = (history: Outcome[], config: Config): PatternState | null => {
  if (history.length < 2) {
    return null;
  }

  const previousOutcome = history[history.length - 2];
  const lastOutcome = history[history.length - 1];
  const previousTier = getPatternTier(previousOutcome);
  const lastTier = getPatternTier(lastOutcome);
  const previousRank = getTierRank(previousTier);
  const lastRank = getTierRank(lastTier);
  const tierDirection = lastRank > previousRank ? 'up' : lastRank < previousRank ? 'down' : 'same';
  const wheelShift = getWheelShift(previousOutcome, lastOutcome);

  return {
    lastOutcome,
    previousOutcome,
    lastTier,
    previousTier,
    tierDirection,
    regime: getPatternRegime(history, config),
    largeGap: getLargeGapBucket(history),
    exactGap: getExactGapBucket(history),
    wheelDirection: getWheelDirection(wheelShift),
    wheelShift,
    alternation: getAlternationState(history),
  };
};

const PATTERN_FAMILIES: PatternFamily[] = [
  {
    name: 'tier-transition',
    weight: 1.1,
    serialize: (state) => ['tier', state.previousTier, state.lastTier, state.tierDirection].join('|'),
  },
  {
    name: 'tier-gap',
    weight: 0.9,
    serialize: (state) => ['tier-gap', state.lastTier, state.largeGap].join('|'),
  },
  {
    name: 'regime-gap',
    weight: 0.7,
    serialize: (state) => ['regime-gap', state.regime, state.largeGap].join('|'),
  },
  {
    name: 'wheel-step',
    weight: 3.2,
    serialize: (state) => ['wheel-step', state.wheelShift, state.previousTier, state.lastTier].join('|'),
  },
  {
    name: 'alternation',
    weight: 0.8,
    serialize: (state) => ['alternation', state.alternation, state.lastTier].join('|'),
  },
  {
    name: 'exact-gap',
    weight: 0.6,
    serialize: (state) => ['exact-gap', state.lastOutcome, state.exactGap].join('|'),
  },
  {
    name: 'exact-direction',
    weight: 1.2,
    serialize: (state) => ['exact-direction', state.previousOutcome, state.wheelShift].join('|'),
  },
];

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

  const mode = config.predictionMode === 'pattern'
    ? 'pattern'
    : (config.predictionMode === 'relative' && m >= 2) ? 'relative' : 'absolute';

  const baseProbs = getBaseProbabilities();

  let pRawOutcomes: Record<Outcome, number> = {} as any;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let finalContext: Outcome[] = [];
  let finalContextCount = 0;
  let matchedOrder = 0;
  let directional: { direction: 'forward' | 'backward' | 'stay' | 'half'; minSteps: number } | undefined;

  if (mode === 'pattern') {
    // --- ABSTRACT PATTERN ENSEMBLE MODE ---
    const currentState = getPatternState(activeHistory, config);
    const weightedCounts: Record<Outcome, number> = {} as any;
    for (const outcome of ALL_OUTCOMES) {
      weightedCounts[outcome] = 0;
    }

    let supportWeight = 0;
    let rawMatchCount = 0;
    if (currentState) {
      for (const family of PATTERN_FAMILIES) {
        const currentSignature = family.serialize(currentState);
        const familyCounts: Record<Outcome, number> = {} as any;
        for (const outcome of ALL_OUTCOMES) {
          familyCounts[outcome] = 0;
        }

        let familyMatches = 0;
        for (let index = 2; index < activeHistory.length; index++) {
          const state = getPatternState(activeHistory.slice(0, index), config);
          if (!state || family.serialize(state) !== currentSignature) {
            continue;
          }

          familyMatches++;
          familyCounts[activeHistory[index]]++;
        }

        if (familyMatches === 0) {
          continue;
        }

        rawMatchCount += familyMatches;
        supportWeight += family.weight;
        for (const outcome of ALL_OUTCOMES) {
          weightedCounts[outcome] += family.weight * (familyCounts[outcome] / familyMatches);
        }
      }
    }

    for (const outcome of ALL_OUTCOMES) {
      pRawOutcomes[outcome] = supportWeight + config.priorStrength > 0
        ? (weightedCounts[outcome] + config.priorStrength * baseProbs[outcome]) / (supportWeight + config.priorStrength)
        : baseProbs[outcome];
    }

    finalContext = activeHistory.slice(-2);
    finalContextCount = rawMatchCount;
    matchedOrder = currentState ? PATTERN_FAMILIES.length : 0;
    confidence = supportWeight >= config.minSupport * 3
      ? 'high'
      : supportWeight >= Math.max(1, config.minSupport)
        ? 'medium'
        : 'low';
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

  // --- SLIDING EXHAUSTION DECK ADJUSTER ---
  if (config.useDeckAdjuster) {
    const deckSize = config.deckSize !== undefined ? config.deckSize : 1000;
    const deckHistory = history.slice(-deckSize);
    
    const counts: Record<Outcome, number> = {} as any;
    for (const o of ALL_OUTCOMES) {
      counts[o] = 0;
    }
    for (const o of deckHistory) {
      counts[o]++;
    }

    let sumAdj = 0;
    for (const o of ALL_OUTCOMES) {
      const expected = deckSize * baseProbs[o];
      const factor = Math.exp(1 - counts[o] / Math.max(1, expected));
      pRawOutcomes[o] = pRawOutcomes[o] * factor;
      sumAdj += pRawOutcomes[o];
    }
    for (const o of ALL_OUTCOMES) {
      pRawOutcomes[o] = pRawOutcomes[o] / (sumAdj || 1);
    }
  }

  // --- REGIME ESTIMATOR & ADJUSTER ---
  const regimeWindow = config.hotRegimeWindow || 15;
  const regimeThreshold = config.hotRegimeThreshold || 4;
  const recentRegimeHistory = activeHistory.slice(-regimeWindow);
  const largeOutcomes = ['x10', 'x15', 'x25', 'x45'];
  const largeCount = recentRegimeHistory.filter(o => largeOutcomes.includes(o)).length;
  const regime = largeCount >= regimeThreshold ? 'hot' : 'cold';

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
    largeCount,
    regimeWindow,
    regimeThreshold
  };
};
