export type Outcome = 'x5_1' | 'x5_2' | 'x5_3' | 'x5_4' | 'x10' | 'x15' | 'x25' | 'x45';

export type PredictionMode = 'absolute' | 'relative' | 'decay';

export interface Config {
  historyWindow: number;
  maxOrder: number;
  priorStrength: number;
  minSupport: number;
  predictionMode: PredictionMode;
  useRegimeAdjuster: boolean;
  decayFactor: number;
  useDeckAdjuster: boolean;
  deckSize: number;
}

export interface PredictionResult {
  activeHistory: Outcome[];
  probabilities: Record<Outcome, number>; // Percentages (e.g. 0 to 100)
  topOutcome: Outcome;
  confidence: 'high' | 'medium' | 'low';
  evidence: {
    activeContext: Outcome[];
    contextCount: number;
    matchedOrder: number;
  };
  directional?: {
    direction: 'forward' | 'backward' | 'stay' | 'half';
    minSteps: number;
  };
  regime?: 'hot' | 'cold';
  largeCount?: number;
}

export interface HistoryItem {
  id: string;
  outcome: Outcome;
  timestamp: number;
}

export type BettingAction = 'skip' | 'probe' | 'normal' | 'tiny-shot';
export type StakeLevel = 'skip' | 'probe' | 'normal' | 'tiny-shot';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TargetTier = 'x5' | 'x10-x15' | 'x25' | 'x45';

export interface BettingCandidate {
  outcome: Outcome;
  probability: number;
  breakEven: number;
  edge: number;
}

export interface BettingSignal {
  action: BettingAction;
  target: Outcome | TargetTier | null;
  stakeLevel: StakeLevel;
  risk: RiskLevel;
  candidates: BettingCandidate[];
  agreementScore: number;
  reasons: string[];
}

export interface BacktestSummary {
  totalEvaluated: number;
  skipped: number;
  actionCounts: Record<StakeLevel, number>;
  hitsByTarget: Partial<Record<Outcome | TargetTier, { hits: number; attempts: number; hitRate: number }>>;
  estimatedReturn: number;
}
