import type { Config, PredictionMode, PredictionResult, BettingSignal, BacktestSummary } from '../types';
import type { Language } from '../locales';
import { OUTCOME_COLORS, GRID_ORDERED_OUTCOMES } from '../constants';

interface ModeCardProps {
  mode: PredictionMode;
  modeReturn: number;
  modeReturnDelta: number;
  modePrediction: PredictionResult;
  modeSignal: BettingSignal;
  modeBacktest: BacktestSummary;
  modeConsensusTargets: Record<string, number>;
  isPreview: boolean;
  isAutoSelected: boolean;
  isManualSelected: boolean;
  isBestMode: boolean;
  stateLabel: string;
  language: Language;
  config: Pick<Config, 'useKellyCriterion'>;
  getModeLabel: (mode: PredictionMode) => string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

export default function ModeCard({
  mode,
  modeReturn,
  modeReturnDelta,
  modePrediction,
  modeSignal,
  modeBacktest,
  modeConsensusTargets,
  isPreview,
  isAutoSelected,
  isManualSelected,
  isBestMode,
  stateLabel,
  language,
  config,
  getModeLabel,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: ModeCardProps) {
  const returnTone = modeReturn > 0
    ? 'text-emerald-400'
    : modeReturn < 0
      ? 'text-rose-400'
      : 'text-slate-400';
  const deltaTone = modeReturnDelta > 0
    ? 'text-emerald-400'
    : modeReturnDelta < 0
      ? 'text-rose-400'
      : 'text-slate-400';

  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer ${
        isPreview
          ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
          : isAutoSelected || isManualSelected
            ? 'border-indigo-500 bg-indigo-600/15 shadow-[0_0_18px_rgba(99,102,241,0.16)]'
            : isBestMode
              ? 'border-emerald-500/60 bg-emerald-500/10'
              : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{getModeLabel(mode)}</div>
          <div className={`mt-1 font-mono text-xl font-black ${returnTone}`}>
            {modeReturn > 0 ? '+' : ''}{modeReturn}
            <span className={`ml-2 text-sm ${deltaTone}`}>
              ({modeReturnDelta > 0 ? '+' : ''}{modeReturnDelta})
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-bold font-mono">
            <span
              className="flex items-center gap-0.5 text-emerald-400"
              title={language === 'en' ? 'Max consecutive wins' : 'Chuỗi thắng liên tiếp tối đa'}
            >
              🔥 {modeBacktest.maxConsecutiveWins || 0}
            </span>
            <span className="text-slate-800">|</span>
            <span
              className="flex items-center gap-0.5 text-rose-400"
              title={language === 'en' ? 'Max consecutive losses' : 'Chuỗi thua liên tiếp tối đa'}
            >
              💀 {modeBacktest.maxConsecutiveLosses || 0}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold font-mono">
            {modeBacktest.currentWinStreak > 0 ? (
              <span
                className="text-emerald-300"
                title={language === 'en' ? 'Current win streak' : 'Chuỗi thắng hiện tại'}
              >
                ↗ +{modeBacktest.currentWinStreak}W
              </span>
            ) : modeBacktest.currentLossStreak > 0 ? (
              <span
                className="text-rose-300"
                title={language === 'en' ? 'Current loss streak' : 'Chuỗi thua hiện tại'}
              >
                ↘ -{modeBacktest.currentLossStreak}L
              </span>
            ) : (
              <span className="text-slate-700">—</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {stateLabel && (
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${
                isPreview
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : isAutoSelected || isManualSelected
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {stateLabel}
            </span>
          )}
          {(() => {
            const modeTargets = modeSignal.targets ?? [];
            const consensusHits = modeTargets.filter(
              (target) => (modeConsensusTargets[target] || 0) >= 2
            );
            if (consensusHits.length === 0) return null;
            const maxAgree = Math.max(
              ...consensusHits.map((target) => modeConsensusTargets[target] || 0)
            );
            return (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${
                  maxAgree === 3
                    ? 'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300'
                    : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                }`}
                title={
                  language === 'en'
                    ? `${maxAgree}/3 modes agree on same target`
                    : `${maxAgree}/3 chế độ đồng thuận cùng target`
                }
              >
                {maxAgree}/3
              </span>
            );
          })()}
        </div>
      </div>

      <div className="hidden md:grid mt-3 grid-cols-2 gap-1.5">
        {GRID_ORDERED_OUTCOMES.map((outcome) => {
          const color = OUTCOME_COLORS[outcome];
          const isRecommendedTarget = modeSignal.targets?.includes(outcome) ?? false;
          const recommendedBet = config.useKellyCriterion
            ? modeSignal.recommendedBets?.[outcome]
            : undefined;
          return (
            <div
              key={outcome}
              className={`rounded-lg border px-2 py-1.5 flex flex-col justify-between transition-all duration-200 ${
                isRecommendedTarget
                  ? 'border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_8px_rgba(99,102,241,0.1)]'
                  : 'border-slate-800 bg-slate-950/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[10px] font-mono font-bold ${color.text}`}>
                    {outcome.toUpperCase().replace('_', ' ')}
                  </span>
                  {recommendedBet !== undefined && (
                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 px-1 py-0.5 rounded border border-emerald-500/20 font-mono">
                      {recommendedBet >= 1000
                        ? `${Math.round(recommendedBet / 1000)}k`
                        : recommendedBet}
                    </span>
                  )}
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {modePrediction.probabilities[outcome]}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </button>
  );
}
