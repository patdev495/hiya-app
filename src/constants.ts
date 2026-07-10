import type { Outcome } from './types';

export const OUTCOME_COLORS: Record<Outcome, { bg: string; text: string; border: string; accent: string }> = {
  x5_1: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500' },
  x5_2: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', accent: 'bg-teal-500' },
  x5_3: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', accent: 'bg-cyan-500' },
  x5_4: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', accent: 'bg-sky-500' },
  x10: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500' },
  x15: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', accent: 'bg-indigo-500' },
  x25: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', accent: 'bg-violet-500' },
  x45: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', accent: 'bg-rose-500' },
};

export const GRID_ORDERED_OUTCOMES: Outcome[] = [
  'x5_1', 'x10',
  'x5_2', 'x15',
  'x5_3', 'x25',
  'x5_4', 'x45',
];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  x5_1: 'x5 Slot 1',
  x5_2: 'x5 Slot 2',
  x5_3: 'x5 Slot 3',
  x5_4: 'x5 Slot 4',
  x10: 'x10 Slot',
  x15: 'x15 Slot',
  x25: 'x25 Slot',
  x45: 'x45 Slot',
};
