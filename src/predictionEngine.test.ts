import { describe, it, expect } from 'vitest';
import { calculateDeckWindowStats, calculatePrediction, getBaseProbabilities, ALL_OUTCOMES, calculatePatternAccuracyStats } from './predictionEngine';
import type { Config, Outcome } from './types';

const DEFAULT_CONFIG: Config = {
  historyWindow: 100,
  maxOrder: 2,
  priorStrength: 20,
  minSupport: 5,
  predictionMode: 'absolute',
  useRegimeAdjuster: false,
  decayFactor: 0.95,
  useDeckAdjuster: false,
  deckSize: 1000,
};

describe('Prediction Engine', () => {
  it('should return exactly eight outcomes in probabilities', () => {
    const result = calculatePrediction([], DEFAULT_CONFIG);
    const outcomes = Object.keys(result.probabilities) as Outcome[];
    expect(outcomes.length).toBe(8);
    for (const o of ALL_OUTCOMES) {
      expect(result.probabilities).toHaveProperty(o);
    }
  });

  it('should have base probabilities that sum to 100%', () => {
    const baseProbs = getBaseProbabilities();
    const sum = Object.values(baseProbs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('should keep the four x5 outcomes separate', () => {
    const baseProbs = getBaseProbabilities();
    expect(baseProbs.x5_1).toBe(baseProbs.x5_2);
    expect(baseProbs.x5_3).toBe(baseProbs.x5_4);
    expect(baseProbs.x5_1).toBeCloseTo(0.19438, 4);
  });

  it('should return probabilities that sum to exactly 100%', () => {
    const result = calculatePrediction([], DEFAULT_CONFIG);
    const sum = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);

    // Test with mock history as well
    const history: Outcome[] = ['x5_1', 'x10', 'x15', 'x5_1', 'x25', 'x45'];
    const result2 = calculatePrediction(history, DEFAULT_CONFIG);
    const sum2 = Object.values(result2.probabilities).reduce((a, b) => a + b, 0);
    expect(sum2).toBe(100);
  });

  it('should keep rare outcomes above zero even if they never appeared', () => {
    // History contains only x5_1
    const history: Outcome[] = Array(50).fill('x5_1');
    const result = calculatePrediction(history, DEFAULT_CONFIG);
    expect(result.probabilities.x45).toBeGreaterThan(0);
  });

  it('should restrict prediction to the history window size', () => {
    const history: Outcome[] = [
      ...Array(100).fill('x10'), // these will be discarded if window is 50
      ...Array(50).fill('x5_1')  // these will be the active history
    ];
    const config: Config = {
      ...DEFAULT_CONFIG,
      historyWindow: 50
    };
    const result = calculatePrediction(history, config);
    expect(result.activeHistory.length).toBe(50);
    // Since only x5_1 is in the last 50 spins, x5_1 should have high probability,
    // and x10 should only have its smoothed base probability.
    expect(result.probabilities.x5_1).toBeGreaterThan(result.probabilities.x10);
  });

  it('should compute high, medium, and low confidence levels based on context support', () => {
    // 1. Low confidence: empty history
    const resLow = calculatePrediction([], DEFAULT_CONFIG);
    expect(resLow.confidence).toBe('low');

    // 2. Low confidence: context occurred but support is below minSupport (default 5)
    // Here we have history: x5_1 -> x10 (1 occurrence), and we are at state x10.
    // The active context of length 2 is [x5_1, x10]. Suffix is [x10].
    // Count of [x10] in history is 1, which is < minSupport (5).
    const historyLow: Outcome[] = ['x5_1', 'x10'];
    const resLow2 = calculatePrediction(historyLow, DEFAULT_CONFIG);
    expect(resLow2.confidence).toBe('low');

    // 3. Medium confidence: maxOrder (2) context is not supported, but 1st order context [x10] is supported (>= 5 times)
    // Let's create a history where [x10] is followed by something 5 times, but [x5_1, x10] is followed by something < 5 times.
    // Let's add:
    // x10 -> x5_2 (4 times)
    // x15 -> x10 -> x5_2 (1 time)
    // Total [x10] followed by something = 5 times.
    // The current last element is x10. So context of length 1 is [x10], count = 5.
    // Suffix context of length 2 is [x15, x10], count = 1.
        const historyMed: Outcome[] = [
      'x10', 'x5_2',
      'x10', 'x5_2',
      'x10', 'x5_2',
      'x10', 'x5_2',
      'x10', 'x5_2',
      'x10'
    ];
    const resMed = calculatePrediction(historyMed, DEFAULT_CONFIG);
    expect(resMed.confidence).toBe('medium');

    // 4. High confidence: maxOrder (2) context [x5_1, x10] is supported (>= 5 times)
    // Let's have x5_1 -> x10 -> x5_2 (5 times).
    // The current last two spins are [x5_1, x10].
    const historyHigh: Outcome[] = [];
    for (let i = 0; i < 5; i++) {
      historyHigh.push('x5_1', 'x10', 'x5_2');
    }
    // Suffix is [x5_1, x10]
    historyHigh.push('x5_1', 'x10');
    const resHigh = calculatePrediction(historyHigh, DEFAULT_CONFIG);
    expect(resHigh.confidence).toBe('high');
  });

  it('should select the top outcome correctly', () => {
    // If x5_1 has highest count in history, it should be top outcome
    const history: Outcome[] = ['x5_1', 'x5_1', 'x5_1', 'x5_1', 'x5_1'];
    const result = calculatePrediction(history, DEFAULT_CONFIG);
    expect(result.topOutcome).toBe('x5_1');
  });

  it('should blend higher-order transitions with lower-order transitions', () => {
    // Suppose we have history where:
    // [x5_1, x10] is followed by [x15] (2 times)
    // [x10] (1st order context) is followed by [x25] (10 times)
    // The current last sequence is [x5_1, x10].
    // Since maxOrder is 2, the 2nd order context [x5_1, x10] has count 2 (which is < minSupport 5).
    // So the prediction will blend the 2nd order transition (which favors x15) with 1st order transition (which favors x25)
    // and the 0-order base probability.
    const history: Outcome[] = [];
    // 10 times x10 -> x25 (not preceded by x5_1)
    for (let i = 0; i < 10; i++) {
      history.push('x15', 'x10', 'x25');
    }
    // 2 times x5_1 -> x10 -> x15
    for (let i = 0; i < 2; i++) {
      history.push('x5_1', 'x10', 'x15');
    }
    // End with x5_1, x10 so current context is [x5_1, x10]
    history.push('x5_1', 'x10');

    const result = calculatePrediction(history, DEFAULT_CONFIG);
    // Since blending is used, both x15 (favored by order 2 context) and x25 (favored by order 1 context) should have elevated probabilities.
    expect(result.probabilities.x15).toBeGreaterThan(result.probabilities.x45);
    expect(result.probabilities.x25).toBeGreaterThan(result.probabilities.x45);
  });

  it('should fallback to absolute mode if history length < 2 in relative mode', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'relative' };
    const result = calculatePrediction(['x5_1'], config);
    expect(result.probabilities.x5_1).toBeGreaterThan(result.probabilities.x45);
  });

  it('should predict offset transitions in relative mode', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'relative' };
    // +2 step shifts:
    // x5_1 (0) -> x5_3 (2)
    // x5_3 (2) -> x10 (4)
    // x10 (4) -> x25 (6)
    // x25 (6) -> x5_1 (0)
    const history: Outcome[] = [
      'x5_1', 'x5_3', 'x10', 'x25',
      'x5_1', 'x5_3', 'x10', 'x25',
      'x5_1', 'x5_3', 'x10', 'x25',
      'x5_1'
    ];
    const result = calculatePrediction(history, config);
    // Suffix is 'x5_1' (0). Step +2 leads to 'x5_3' (2).
    expect(result.topOutcome).toBe('x5_3');
    expect(result.probabilities.x5_3).toBeGreaterThan(50);
  });

  it('should compute directional prediction correctly in relative mode', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'relative' };
    // Every transition is a +3 step shift (x5_1 -> x5_4)
    const history: Outcome[] = [
      'x5_1', 'x5_4', 'x25', 'x5_2',
      'x5_1', 'x5_4', 'x25', 'x5_2',
      'x5_1', 'x5_4'
    ];
    const result = calculatePrediction(history, config);
    expect(result.directional).toBeDefined();
    expect(result.directional?.direction).toBe('forward');
    expect(result.directional?.minSteps).toBe(3);
  });

  it('should detect cold and hot regimes based on configurable recent large outcome count', () => {
    const coldHistory: Outcome[] = Array(15).fill('x5_1');
    const resultCold = calculatePrediction(coldHistory, DEFAULT_CONFIG);
    expect(resultCold.regime).toBe('cold');
    expect(resultCold.largeCount).toBe(0);

    const hotHistory: Outcome[] = [
      ...Array(11).fill('x5_1'),
      'x10', 'x25', 'x15', 'x45'
    ];
    const resultHot = calculatePrediction(hotHistory, DEFAULT_CONFIG);
    expect(resultHot.regime).toBe('hot');
    expect(resultHot.largeCount).toBe(4);

    const customHotHistory: Outcome[] = [
      ...Array(7).fill('x5_1'),
      'x10', 'x25', 'x15'
    ];
    const customHot = calculatePrediction(customHotHistory, {
      ...DEFAULT_CONFIG,
      hotRegimeWindow: 10,
      hotRegimeThreshold: 3,
    });
    expect(customHot.regime).toBe('hot');
    expect(customHot.largeCount).toBe(3);
  });

  it('should damp or boost large outcomes when useRegimeAdjuster is enabled', () => {
    const configWithAdjuster: Config = { ...DEFAULT_CONFIG, useRegimeAdjuster: true };

    // 1. In COLD regime (no large spins in history), large outcomes should be damped.
    const history: Outcome[] = Array(15).fill('x5_1');
    const resNoAdj = calculatePrediction(history, DEFAULT_CONFIG);
    const resWithAdj = calculatePrediction(history, configWithAdjuster);
    expect(resWithAdj.probabilities.x45).toBeLessThan(resNoAdj.probabilities.x45);

    // 2. In HOT regime (many large spins in history), large outcomes should be boosted.
    const hotHistory: Outcome[] = Array(15).fill('x45');
    const resHotNoAdj = calculatePrediction(hotHistory, DEFAULT_CONFIG);
    const resHotWithAdj = calculatePrediction(hotHistory, configWithAdjuster);
    expect(resHotWithAdj.probabilities.x45).toBeGreaterThan(resHotNoAdj.probabilities.x45);
  });

  it('should learn abstract tier patterns without requiring exact repeated values in pattern mode', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'pattern', priorStrength: 0, minSupport: 2 };
    const history: Outcome[] = [
      'x5_1', 'x10', 'x5_2',
      'x5_3', 'x15', 'x5_4',
      'x5_2', 'x10', 'x5_3',
      'x5_4', 'x15', 'x5_1',
      'x5_2',
    ];

    const result = calculatePrediction(history, config);
    const largeProbability = result.probabilities.x10 + result.probabilities.x15 + result.probabilities.x25 + result.probabilities.x45;

    expect(largeProbability).toBeGreaterThan(60);
    expect(result.probabilities.x10 + result.probabilities.x15).toBeGreaterThan(result.probabilities.x5_1);
    expect(['medium', 'high']).toContain(result.confidence);
  });

  it('should use wheel-step patterns as a separate pattern family', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'pattern', priorStrength: 0, minSupport: 2 };
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x45',
      'x5_2', 'x5_3', 'x45',
      'x5_3', 'x5_4', 'x45',
      'x5_1', 'x5_3', 'x10',
      'x5_2', 'x5_4', 'x10',
      'x5_1', 'x5_3',
    ];

    const result = calculatePrediction(history, config);

    expect(result.probabilities.x10).toBeGreaterThan(result.probabilities.x45);
    expect(result.evidence.contextCount).toBeGreaterThan(0);
  });

  it('should use alternation patterns as a separate pattern family', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'pattern', priorStrength: 0, minSupport: 2 };
    const history: Outcome[] = [
      'x5_1', 'x10', 'x5_2', 'x15',
      'x5_3', 'x10', 'x5_4', 'x15',
      'x5_1',
    ];

    const result = calculatePrediction(history, config);
    const mainProbability = result.probabilities.x10 + result.probabilities.x15;

    expect(mainProbability).toBeGreaterThan(60);
    expect(mainProbability).toBeGreaterThan(result.probabilities.x5_1 + result.probabilities.x5_2);
  });

  it('should make pattern mode more decisive when pattern strength is higher', () => {
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x45',
      'x5_2', 'x5_3', 'x45',
      'x5_3', 'x5_4', 'x45',
      'x5_1', 'x5_3', 'x10',
      'x5_2', 'x5_4', 'x10',
      'x5_1', 'x5_3',
    ];
    const weak = calculatePrediction(history, {
      ...DEFAULT_CONFIG,
      predictionMode: 'pattern',
      priorStrength: 20,
      patternStrength: 1,
    });
    const strong = calculatePrediction(history, {
      ...DEFAULT_CONFIG,
      predictionMode: 'pattern',
      priorStrength: 20,
      patternStrength: 5,
    });

    expect(strong.probabilities.x10).toBeGreaterThan(weak.probabilities.x10);
    expect(strong.probabilities.x10 - strong.probabilities.x45).toBeGreaterThan(
      weak.probabilities.x10 - weak.probabilities.x45
    );
  });

  it('should expose pattern family evidence when pattern mode is active', () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      predictionMode: 'pattern',
      priorStrength: 20,
      patternStrength: 3,
      minSupport: 2,
    };
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x45',
      'x5_2', 'x5_3', 'x45',
      'x5_3', 'x5_4', 'x45',
      'x5_1', 'x5_3', 'x10',
      'x5_2', 'x5_4', 'x10',
      'x5_1', 'x5_3',
    ];

    const result = calculatePrediction(history, config);
    const families = result.evidence.patternFamilies ?? [];
    const wheelStep = families.find((family) => family.name === 'wheel-step');

    expect(families.length).toBeGreaterThan(0);
    expect(wheelStep).toBeDefined();
    expect(wheelStep?.matches).toBeGreaterThan(0);
    expect(wheelStep?.topOutcome).toBe('x10');
    expect(wheelStep?.contribution).toBeGreaterThan(0);
    expect(families[0].contribution).toBeGreaterThanOrEqual(families[families.length - 1].contribution);
  });

  it('should damp or boost probabilities based on deck exhaustion when enabled', () => {
    const configWithDeck: Config = { ...DEFAULT_CONFIG, useDeckAdjuster: true, deckSize: 100 };

    // 1. If 'x45' has appeared too much in the history (e.g. 10 times in 100 spins, which is much higher than expected 2.2 times),
    // it should be damped.
    const overHistory: Outcome[] = [
      ...Array(90).fill('x5_1'),
      ...Array(10).fill('x45')
    ];
    const resNoAdj = calculatePrediction(overHistory, DEFAULT_CONFIG);
    const resWithAdj = calculatePrediction(overHistory, configWithDeck);
    expect(resWithAdj.probabilities.x45).toBeLessThan(resNoAdj.probabilities.x45);

    // 2. If 'x45' has never appeared in the history (0 times in 100 spins, expected is 2.2 times),
    // it should be boosted.
    const underHistory: Outcome[] = Array(100).fill('x5_1');
    const resUnderNoAdj = calculatePrediction(underHistory, DEFAULT_CONFIG);
    const resUnderWithAdj = calculatePrediction(underHistory, configWithDeck);
    expect(resUnderWithAdj.probabilities.x45).toBeGreaterThan(resUnderNoAdj.probabilities.x45);
  });

  it('should summarize outcome counts inside the configured deck window', () => {
    const history: Outcome[] = [
      ...Array(20).fill('x5_1'),
      ...Array(5).fill('x10'),
      ...Array(5).fill('x45')
    ];

    const stats = calculateDeckWindowStats(history, 10);

    expect(stats.configuredSize).toBe(10);
    expect(stats.windowSize).toBe(10);
    expect(stats.outcomes.x10.count).toBe(5);
    expect(stats.outcomes.x45.count).toBe(5);
    expect(stats.outcomes.x5_1.count).toBe(0);
    expect(stats.outcomes.x45.expected).toBeCloseTo(0.22, 2);
    expect(stats.outcomes.x45.deviation).toBeCloseTo(4.78, 2);
    expect(stats.outcomes.x45.ratioPercent).toBe(2273);
    expect(stats.outcomes.x10.ratioPercent).toBe(515);
    expect(stats.outcomes.x45.countPercent).toBeCloseTo(50.00, 2);
    expect(stats.outcomes.x45.expectedPercent).toBeCloseTo(2.16, 2);
    expect(stats.outcomes.x10.countPercent).toBeCloseTo(50.00, 2);
    expect(stats.outcomes.x10.expectedPercent).toBeCloseTo(9.72, 2);
  });

  describe('calculatePatternAccuracyStats', () => {
    it('should return accuracy stats for all pattern families', () => {
      const history: Outcome[] = ['x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x15', 'x5_3'];
      const config: Config = {
        ...DEFAULT_CONFIG,
        predictionMode: 'pattern',
        priorStrength: 5,
        minSupport: 1
      };
      
      const stats = calculatePatternAccuracyStats(history, config, 5);
      
      const expectedFamilies = [
        'tier-transition',
        'tier-gap',
        'regime-gap',
        'wheel-step',
        'alternation',
        'exact-gap',
        'exact-direction'
      ];
      
      for (const name of expectedFamilies) {
        expect(stats).toHaveProperty(name);
        expect(stats[name].attempts).toBeGreaterThanOrEqual(0);
        expect(stats[name].hits).toBeGreaterThanOrEqual(0);
        expect(stats[name].accuracy).toBeGreaterThanOrEqual(0);
        expect(stats[name].accuracy).toBeLessThanOrEqual(100);
      }
    });

    it('should return empty/zero stats if history length is less than 3', () => {
      const stats = calculatePatternAccuracyStats(['x5_1', 'x5_2'], DEFAULT_CONFIG);
      for (const key in stats) {
        expect(stats[key].attempts).toBe(0);
        expect(stats[key].hits).toBe(0);
        expect(stats[key].accuracy).toBe(0);
      }
    });
  });
});

