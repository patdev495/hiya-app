import { describe, expect, it } from 'vitest';
import { calculatePrediction } from './predictionEngine';
import { calculateBacktest, calculateBettingSignal, selectActivePredictionMode } from './bettingSignalEngine';
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

const predict = (history: Outcome[], config: Config = DEFAULT_CONFIG) =>
  calculatePrediction(history, config);

describe('Betting Signal Engine', () => {
  it('non-hot regime still recommends the two highest x5 slots when no large outcome qualifies', () => {
    const prediction = predict([]);

    const signal = calculateBettingSignal([], prediction, DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.targets).toHaveLength(2);
    expect(signal.targets?.every(target => target.startsWith('x5_'))).toBe(true);
    expect(signal.reasons).toContain('Non-hot regime: always bet top two x5 slots.');
  });

  it('keeps an outcome playable when it clears break-even plus safety margin', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 12; i++) {
      history.push('x10', 'x15', 'x10');
    }
    history.push('x10');
    const prediction = predict(history);

    const signal = calculateBettingSignal(history, prediction, DEFAULT_CONFIG);

    expect(signal.action).not.toBe('skip');
    expect(signal.candidates.some(candidate => candidate.edge > 0)).toBe(true);
  });

  it('maps playable outcomes into exact multi-target recommendations', () => {
    const hotX10History: Outcome[] = Array(12).fill(['x10', 'x15']).flat() as Outcome[];
    const x10Signal = calculateBettingSignal(hotX10History, predict(hotX10History), DEFAULT_CONFIG);
    expect(x10Signal.targets?.some(target => target === 'x10' || target === 'x15')).toBe(true);
    expect(x10Signal.action).toBe('normal');
    expect(x10Signal.stakeLevel).toBe('normal');

    const x25History: Outcome[] = Array(12).fill(['x25', 'x10']).flat() as Outcome[];
    const x25Signal = calculateBettingSignal(x25History, predict(x25History), DEFAULT_CONFIG);
    expect(x25Signal.targets).toContain('x25');
    expect(x25Signal.action).toBe('normal');
    expect(x25Signal.stakeLevel).toBe('normal');

    const x45History: Outcome[] = Array(12).fill(['x45', 'x10']).flat() as Outcome[];
    const x45Signal = calculateBettingSignal(x45History, predict(x45History), DEFAULT_CONFIG);
    expect(x45Signal.targets).toContain('x45');
    expect(x45Signal.action).toBe('normal');
    expect(x45Signal.stakeLevel).toBe('normal');
  });

  it('in non-hot regime recommends the top two x5 slots even when generic x5 outcomes are frequent', () => {
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x5_3', 'x5_4',
      'x5_2', 'x5_3', 'x5_4', 'x5_1',
      'x5_3', 'x5_4', 'x5_1', 'x5_2',
      'x5_4', 'x5_1', 'x5_2', 'x5_3',
    ];

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.targets).toHaveLength(2);
    expect(signal.targets?.every(target => target.startsWith('x5_'))).toBe(true);
  });

  it('uses target count as agreement score for multi-target recommendations', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 8; i++) {
      history.push('x5_1', 'x10', 'x15');
    }
    history.push('x5_1', 'x10');

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.agreementScore).toBe(signal.targets?.length);
    expect(signal.reasons.some(reason => reason.startsWith('Bet targets:'))).toBe(true);
  });

  it('does not downgrade hot regime multi-target recommendations for old conflict scoring', () => {
    const hotHistory: Outcome[] = Array(12).fill(['x10', 'x15']).flat() as Outcome[];
    const prediction = {
      ...predict(hotHistory),
      regime: 'cold' as const,
      largeCount: 1,
    };

    const signal = calculateBettingSignal(hotHistory, prediction, DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.stakeLevel).toBe('normal');
    expect(signal.targets?.some(target => target === 'x10' || target === 'x15')).toBe(true);
  });

  it('allows x5 slots through regime rules instead of old exact-evidence gate', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 8; i++) {
      history.push('x10', 'x5_3');
    }
    history.push('x10');

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.targets).toContain('x5_3');
    expect(signal.stakeLevel).toBe('normal');
    expect(signal.reasons).toContain('Hot regime: bet x5 slots only above 30%.');
  });

  it('backtests recorded history using the same live recommendation engine', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 8; i++) {
      history.push('x5_1', 'x10', 'x15');
    }
    history.push('x5_1', 'x10', 'x15');

    const summary = calculateBacktest(history, DEFAULT_CONFIG);

    expect(summary.totalEvaluated).toBeGreaterThan(0);
    expect(summary.actionCounts.normal).toBeGreaterThan(0);
    expect(
      (summary.hitsByTarget.x10?.attempts ?? 0) + (summary.hitsByTarget.x15?.attempts ?? 0)
    ).toBeGreaterThan(0);
    expect(typeof summary.estimatedReturn).toBe('number');
  });

  it('in non-hot regime bets the top two x5 slots and large outcomes at three times break-even', () => {
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x5_1', 'x5_2', 'x5_1',
      'x5_2', 'x5_3', 'x5_4', 'x5_1', 'x5_2',
      'x5_1', 'x5_2', 'x5_3', 'x5_4', 'x5_1',
    ];

    const signal = calculateBettingSignal(history, predict(history), {
      ...DEFAULT_CONFIG,
      priorStrength: 0,
      useRegimeAdjuster: false,
    });

    expect(signal.targets).toHaveLength(2);
    expect(signal.targets).toEqual(expect.arrayContaining(['x5_1', 'x5_2']));
    expect(signal.reasons).toContain('Non-hot regime: always bet top two x5 slots.');
  });

  it('in hot regime bets all large outcomes at two times break-even and only x5 slots above 30%', () => {
    const history: Outcome[] = [
      'x10', 'x15', 'x10', 'x15', 'x10',
      'x15', 'x25', 'x45', 'x10', 'x15',
      'x10', 'x15', 'x10', 'x15', 'x10',
    ];

    const signal = calculateBettingSignal(history, predict(history), {
      ...DEFAULT_CONFIG,
      priorStrength: 0,
      useRegimeAdjuster: false,
    });

    expect(signal.targets).toContain('x15');
    expect(signal.targets).not.toContain('x5_1');
    expect(signal.reasons).toContain('Hot regime: bet large outcomes above 2x break-even.');
  });

  it('uses configurable hot regime window and threshold for multi-target rules', () => {
    const history: Outcome[] = [
      ...Array(7).fill('x5_1'),
      'x10', 'x25', 'x15',
    ];

    const signal = calculateBettingSignal(history, predict(history, {
      ...DEFAULT_CONFIG,
      hotRegimeWindow: 10,
      hotRegimeThreshold: 3,
    }), {
      ...DEFAULT_CONFIG,
      priorStrength: 0,
      useRegimeAdjuster: false,
      hotRegimeWindow: 10,
      hotRegimeThreshold: 3,
    });

    expect(signal.reasons).toContain('Hot regime: bet large outcomes above 2x break-even.');
  });

  it('backtest charges one stake per selected target in the same turn', () => {
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x5_1', 'x5_2', 'x5_1',
      'x5_2', 'x5_1', 'x5_2', 'x5_1', 'x5_2',
      'x5_1', 'x5_2', 'x5_1', 'x5_2', 'x5_1',
      'x5_1',
    ];

    const summary = calculateBacktest(history, {
      ...DEFAULT_CONFIG,
      priorStrength: 0,
      useRegimeAdjuster: false,
    });

    expect(summary.hitsByTarget.x5_1?.attempts).toBeGreaterThan(0);
    expect(summary.hitsByTarget.x5_2?.attempts).toBeGreaterThan(0);
    expect(summary.estimatedReturn).toBeGreaterThanOrEqual(3);
  });

  it('keeps adaptive safety at the default margin when multi-target rules do not detect drift', () => {
    const history: Outcome[] = [
      ...Array(15).fill('x10'),
      'x5_1', 'x5_2', 'x5_3', 'x5_4', 'x25', 'x45',
      'x5_1', 'x5_2', 'x5_3', 'x5_4', 'x25', 'x45',
      'x5_1', 'x5_2', 'x5_3'
    ];

    const config: Config = {
      ...DEFAULT_CONFIG,
      useAdaptiveSafety: true,
    };

    const prediction = calculatePrediction(history, config);
    const signal = calculateBettingSignal(history, prediction, config);

    expect(signal.isDriftDetected).toBe(false);
    expect(signal.adaptiveSafetyMargin).toBe(0.5);
  });

  it('supports auto mode switching to select the mode with highest recent backtest return', () => {
    // Create a history of 32 spins that is highly cyclical (offsets of +1 forward).
    // This will perform extremely well in relative mode, but poorly in decay mode.
    const history: Outcome[] = [];
    const pattern: Outcome[] = ['x5_1', 'x5_2', 'x5_3', 'x5_4', 'x10', 'x15', 'x25', 'x45'];
    for (let i = 0; i < 4; i++) {
      history.push(...pattern);
    }

    const config: Config = {
      ...DEFAULT_CONFIG,
      useAutoModeSwitch: true,
      predictionMode: 'decay', // Start with decay mode, which should be overridden
    };

    const prediction = calculatePrediction(history, config);
    const signal = calculateBettingSignal(history, prediction, config);

    expect(signal.activeMode).toBe('relative');
  });

  it('exposes the same active mode used by auto mode switching for prediction rendering', () => {
    const history: Outcome[] = [];
    const pattern: Outcome[] = ['x5_1', 'x5_2', 'x5_3', 'x5_4', 'x10', 'x15', 'x25', 'x45'];
    for (let i = 0; i < 4; i++) {
      history.push(...pattern);
    }

    const config: Config = {
      ...DEFAULT_CONFIG,
      useAutoModeSwitch: true,
      predictionMode: 'decay',
      useRegimeAdjuster: true,
      useDeckAdjuster: true,
    };

    const selectedMode = selectActivePredictionMode(history, config);
    const renderedPrediction = calculatePrediction(history, {
      ...config,
      predictionMode: selectedMode,
      useAutoModeSwitch: false,
    });
    const signal = calculateBettingSignal(history, renderedPrediction, config);

    expect(selectedMode).toBe('relative');
    expect(signal.activeMode).toBe(selectedMode);
    expect(renderedPrediction.probabilities).toEqual(
      calculatePrediction(history, {
        ...config,
        predictionMode: selectedMode,
        useAutoModeSwitch: false,
      }).probabilities
    );
  });

  it('supports custom autoModeWindow configuration', () => {
    const history: Outcome[] = [];
    const pattern: Outcome[] = ['x5_1', 'x5_2', 'x5_3', 'x5_4', 'x10', 'x15', 'x25', 'x45'];
    for (let i = 0; i < 3; i++) {
      history.push(...pattern);
    } // length = 24

    const configDefault: Config = {
      ...DEFAULT_CONFIG,
      useAutoModeSwitch: true,
      predictionMode: 'decay',
      autoModeWindow: 30,
    };

    const predDefault = calculatePrediction(history, configDefault);
    const signalDefault = calculateBettingSignal(history, predDefault, configDefault);
    // Should NOT auto-switch since 24 < 30
    expect(signalDefault.activeMode).toBe('decay');

    const configCustom: Config = {
      ...DEFAULT_CONFIG,
      useAutoModeSwitch: true,
      predictionMode: 'decay',
      autoModeWindow: 20,
    };

    const predCustom = calculatePrediction(history, configCustom);
    const signalCustom = calculateBettingSignal(history, predCustom, configCustom);
    // Should auto-switch since 24 >= 20
    expect(signalCustom.activeMode).toBe('relative');
  });
});
