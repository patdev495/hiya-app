export type Outcome = 'x5_1' | 'x5_2' | 'x5_3' | 'x5_4' | 'x10' | 'x15' | 'x25' | 'x45';

export interface Config {
  historyWindow: number;
  maxOrder: number;
  priorStrength: number;
  minSupport: number;
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
}

export interface HistoryItem {
  id: string;
  outcome: Outcome;
  timestamp: number;
}
