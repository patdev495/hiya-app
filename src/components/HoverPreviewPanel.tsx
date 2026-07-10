import type { Config, PredictionMode, PredictionResult, BettingSignal, Outcome } from '../types';
import type { Language } from '../locales';
import { TrendingUp, Gauge, Flame, Sparkles } from 'lucide-react';
import { OUTCOME_COLORS } from '../constants';
import { ALL_OUTCOMES } from '../predictionEngine';
import {
  getDisplacementLabel,
  getSignalTone,
  formatSignalTargets,
  translateReason,
} from '../utils';

interface HoverPreviewPanelProps {
  hoveredMode: PredictionMode | null;
  hoverPrediction: PredictionResult;
  hoverBettingSignal: BettingSignal;
  hoverActiveModeToShow: PredictionMode;
  config: Pick<Config, 'useKellyCriterion' | 'minSupport'>;
  language: Language;
  t: (key: any) => string;
  getModeLabel: (mode: PredictionMode) => string;
}

export default function HoverPreviewPanel({
  hoveredMode,
  hoverPrediction,
  hoverBettingSignal,
  hoverActiveModeToShow,
  config,
  language,
  t,
  getModeLabel,
}: HoverPreviewPanelProps) {
  if (!hoveredMode) return null;

  return (
    <div
      className="fixed right-6 top-[100px] z-50 w-[420px] max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-950/95 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in slide-in-from-right-10 duration-300"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PHÂN TÍCH CHI TIẾT</span>
          <h4 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            {getModeLabel(hoveredMode)}
          </h4>
        </div>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-black px-2.5 py-1 rounded-lg border border-indigo-500/30 tracking-wider">
          HOVER PREVIEW
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* Card 1: Prediction Lead */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                {t('predictionLead')}
              </span>
              <span className="text-xs text-slate-500">{t('eventDriven')}</span>
            </div>
            {hoverActiveModeToShow === 'relative' && hoverPrediction.directional ? (
              <>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {hoverPrediction.directional.direction === 'forward' && (
                    <span className="text-emerald-400">{t('directionForward')}</span>
                  )}
                  {hoverPrediction.directional.direction === 'backward' && (
                    <span className="text-rose-400">{t('directionBackward')}</span>
                  )}
                  {hoverPrediction.directional.direction === 'stay' && (
                    <span className="text-slate-400">{t('directionStay')}</span>
                  )}
                  {hoverPrediction.directional.direction === 'half' && (
                    <span className="text-indigo-400">{t('directionHalf')}</span>
                  )}
                </h2>
                <p className="text-xs font-semibold text-slate-300 mt-1">
                  {hoverPrediction.directional.minSteps > 0 ? (
                    <>{t('displacementMin')} {hoverPrediction.directional.minSteps} {t('slots')}</>
                  ) : (
                    <>{t('displacementNone')}</>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {t('targetOutcome')}:{' '}
                  <strong className={OUTCOME_COLORS[hoverPrediction.topOutcome].text}>
                    {hoverPrediction.topOutcome.toUpperCase().replace('_', ' ')}
                  </strong>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {hoverPrediction.probabilities[hoverPrediction.topOutcome] > 0 ? (
                    <span className={OUTCOME_COLORS[hoverPrediction.topOutcome].text}>
                      {hoverPrediction.topOutcome.replace('_', ' ').toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-slate-500">None</span>
                  )}
                </h2>
                <p className="text-xs font-semibold text-slate-300 mt-1">
                  {t('highestProb')}: {hoverPrediction.probabilities[hoverPrediction.topOutcome]}%
                </p>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Evidence Support */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                {t('evidenceSupport')}
              </span>
              <span className="text-xs text-slate-500">{t('minSupport')} = {config.minSupport}</span>
            </div>

            <div className="flex items-center gap-3">
              {hoverPrediction.confidence === 'high' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Flame className="w-3.5 h-3.5 mr-1 animate-pulse text-emerald-400" />
                  {t('highConfidence')}
                </span>
              ) : hoverPrediction.confidence === 'medium' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {t('mediumConfidence')}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  {t('lowConfidence')}
                </span>
              )}
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="text-[11px] text-slate-400">
                {t('activeContext')} ({hoverPrediction.evidence.matchedOrder}-{t('order')}):
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {hoverPrediction.evidence.activeContext.length === 0 ? (
                  <span className="text-xs text-slate-600 italic">{t('nonePriorDominant')}</span>
                ) : (
                  hoverPrediction.evidence.activeContext.map((c, i) => {
                    const color = OUTCOME_COLORS[c];
                    const nextItem = hoverPrediction.evidence.activeContext[i + 1];
                    let shiftLabel = '';
                    if (nextItem && hoverActiveModeToShow === 'relative') {
                      const idx1 = ALL_OUTCOMES.indexOf(c);
                      const idx2 = ALL_OUTCOMES.indexOf(nextItem);
                      const shift = (idx2 - idx1 + 8) % 8;
                      shiftLabel = getDisplacementLabel(shift, language);
                    }
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${color.bg} ${color.text} border ${color.border}`}
                        >
                          {c.toUpperCase()}
                        </span>
                        {shiftLabel && (
                          <span className="text-[9px] text-indigo-400 font-bold bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20">
                            {shiftLabel}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                {t('contextSeen')}{' '}
                <strong className="text-slate-300 font-semibold">
                  {hoverPrediction.evidence.contextCount}
                </strong>{' '}
                {t('timesInHistory')}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Payout Regime */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                {t('payoutRegime')}
              </span>
              <span className="text-xs text-slate-500">{t('last15Spins')}</span>
            </div>

            <div className="flex flex-col gap-2">
              {hoverPrediction.regime === 'hot' ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <Flame className="w-3.5 h-3.5 mr-1 animate-pulse text-rose-400" />
                    {t('hotRegime')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    <span className="w-2.5 h-2.5 mr-1 rounded-full bg-blue-500 animate-pulse" />
                    {t('coldRegime')}
                  </span>
                </div>
              )}

              <div className="text-[11px] text-slate-400">
                {t('largeSpins')} (≥ x10):{' '}
                <strong className="text-slate-200">{hoverPrediction.largeCount}/15</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Betting Signal */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                {t('bettingSignal')}
              </span>
              <span className="text-xs text-slate-500">{t('edgeGate')}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getSignalTone(hoverBettingSignal.action)}`}
              >
                {t(`signalAction_${hoverBettingSignal.action}`)}
              </span>
              {hoverBettingSignal.isDriftDetected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                  ⚠️ {t('driftDetected')}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black text-white mt-3 tracking-tight">
              {formatSignalTargets(hoverBettingSignal.targets, hoverBettingSignal.target)}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                <div className="text-slate-500">{t('stakeLevel')}</div>
                <div className="font-bold text-slate-200 uppercase">{hoverBettingSignal.stakeLevel}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                <div className="text-slate-500">{t('riskLevel')}</div>
                <div className="font-bold text-slate-200 uppercase">{hoverBettingSignal.risk}</div>
              </div>
            </div>

            <div className="mt-3 space-y-1 border-t border-slate-800/40 pt-2 text-[9px] text-slate-500">
              {hoverBettingSignal.reasons.slice(0, 3).map((reason) => (
                <div key={reason} className="text-slate-400 flex gap-1">
                  <span className="text-indigo-400">•</span>
                  <span>{translateReason(reason, language)}</span>
                </div>
              ))}
            </div>

            {config.useKellyCriterion &&
              hoverBettingSignal.recommendedBets &&
              Object.keys(hoverBettingSignal.recommendedBets).length > 0 && (
                <div className="mt-3 border-t border-slate-800/40 pt-2">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    {t('recommendedBetLabel')} (Kelly):
                  </div>
                  <div className="flex flex-col gap-1 font-mono text-xs">
                    {Object.entries(hoverBettingSignal.recommendedBets).map(([outcome, bet]) => {
                      const color = OUTCOME_COLORS[outcome as Outcome];
                      return (
                        <div
                          key={outcome}
                          className="flex justify-between items-center bg-slate-950/40 px-2.5 py-1 rounded border border-slate-800/40"
                        >
                          <span className={`font-bold ${color.text}`}>
                            {outcome.toUpperCase().replace('_', ' ')}
                          </span>
                          <span className="font-bold text-emerald-400">
                            {(bet as number).toLocaleString()}đ
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
