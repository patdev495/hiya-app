import { describe, expect, it } from 'vitest';
import { calculatePrediction } from './predictionEngine';
import { calculateBacktest, calculateBettingSignal } from './bettingSignalEngine';
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
  it('recommends skipping when no outcome clears break-even plus safety margin', () => {
    const prediction = predict([]);

    const signal = calculateBettingSignal([], prediction, DEFAULT_CONFIG);

    expect(signal.action).toBe('skip');
    expect(signal.target).toBeNull();
    expect(signal.stakeLevel).toBe('skip');
    expect(signal.reasons).toContain('No outcome clears break-even plus safety margin.');
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

  it('maps playable outcomes into the balanced target tiers', () => {
    const hotX10History: Outcome[] = Array(12).fill(['x10', 'x15']).flat() as Outcome[];
    const x10Signal = calculateBettingSignal(hotX10History, predict(hotX10History), DEFAULT_CONFIG);
    expect(x10Signal.target).toBe('x10-x15');
    expect(x10Signal.action).toBe('normal');
    expect(x10Signal.stakeLevel).toBe('normal');

    const x25History: Outcome[] = Array(12).fill(['x25', 'x10']).flat() as Outcome[];
    const x25Signal = calculateBettingSignal(x25History, predict(x25History), DEFAULT_CONFIG);
    expect(x25Signal.target).toBe('x25');
    expect(x25Signal.action).toBe('probe');
    expect(x25Signal.stakeLevel).toBe('probe');

    const x45History: Outcome[] = Array(12).fill(['x45', 'x10']).flat() as Outcome[];
    const x45Signal = calculateBettingSignal(x45History, predict(x45History), DEFAULT_CONFIG);
    expect(x45Signal.target).toBe('x45');
    expect(x45Signal.action).toBe('tiny-shot');
    expect(x45Signal.stakeLevel).toBe('tiny-shot');
  });

  it('does not recommend x5 solely because generic x5 outcomes are frequent', () => {
    const history: Outcome[] = [
      'x5_1', 'x5_2', 'x5_3', 'x5_4',
      'x5_2', 'x5_3', 'x5_4', 'x5_1',
      'x5_3', 'x5_4', 'x5_1', 'x5_2',
      'x5_4', 'x5_1', 'x5_2', 'x5_3',
    ];

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.target).toBeNull();
    expect(signal.action).toBe('skip');
  });

  it('scores stronger recommendations when regime and transition evidence align', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 8; i++) {
      history.push('x5_1', 'x10', 'x15');
    }
    history.push('x5_1', 'x10');

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.agreementScore).toBeGreaterThanOrEqual(3);
    expect(signal.reasons).toContain('Hot regime supports large-outcome targets.');
    expect(signal.reasons).toContain('Transition evidence has medium or high support.');
  });

  it('downgrades playable outcomes when signal evidence conflicts', () => {
    const hotHistory: Outcome[] = Array(12).fill(['x10', 'x15']).flat() as Outcome[];
    const prediction = {
      ...predict(hotHistory),
      regime: 'cold' as const,
      largeCount: 1,
    };

    const signal = calculateBettingSignal(hotHistory, prediction, DEFAULT_CONFIG);

    expect(signal.action).toBe('probe');
    expect(signal.stakeLevel).toBe('probe');
    expect(signal.reasons).toContain('Cold regime conflicts with large-outcome targets.');
  });

  it('allows an exact x5 slot only when exact-slot evidence is strong', () => {
    const history: Outcome[] = [];
    for (let i = 0; i < 8; i++) {
      history.push('x10', 'x5_3');
    }
    history.push('x10');

    const signal = calculateBettingSignal(history, predict(history), DEFAULT_CONFIG);

    expect(signal.action).toBe('normal');
    expect(signal.target).toBe('x5_3');
    expect(signal.stakeLevel).toBe('normal');
    expect(signal.reasons).toContain('Exact x5 slot has strong supported evidence.');
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
    expect(summary.hitsByTarget['x10-x15']?.attempts).toBeGreaterThan(0);
    expect(typeof summary.estimatedReturn).toBe('number');
  });
});
