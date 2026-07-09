import { describe, it, expect } from 'vitest';
import { calculateDeckWindowStats, calculatePrediction, getBaseProbabilities, ALL_OUTCOMES } from './predictionEngine';
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

  it('should detect cold and hot regimes based on last 15 spins', () => {
    // 1. Cold regime: last 15 spins have <= 1 large outcome
    const coldHistory: Outcome[] = Array(15).fill('x5_1');
    const resultCold = calculatePrediction(coldHistory, DEFAULT_CONFIG);
    expect(resultCold.regime).toBe('cold');
    expect(resultCold.largeCount).toBe(0);

    // 2. Hot regime: last 15 spins have >= 2 large outcomes (e.g. x10, x25)
    const hotHistory: Outcome[] = [
      ...Array(13).fill('x5_1'),
      'x10', 'x25'
    ];
    const resultHot = calculatePrediction(hotHistory, DEFAULT_CONFIG);
    expect(resultHot.regime).toBe('hot');
    expect(resultHot.largeCount).toBe(2);
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

  it('should compute exponential decay probabilities correctly in decay mode', () => {
    const config: Config = { ...DEFAULT_CONFIG, predictionMode: 'decay', decayFactor: 0.90, priorStrength: 0 };
    const history: Outcome[] = ['x10', 'x45'];
    const result = calculatePrediction(history, config);
    expect(result.probabilities.x45).toBeGreaterThan(result.probabilities.x10);
    expect(result.probabilities.x15).toBe(0);
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
});
