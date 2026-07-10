import { useEffect, useState, type TouchEvent } from 'react';
import type { Config, PredictionMode, PredictionResult, BettingSignal, Outcome } from '../types';
import type { Language } from '../locales';
import { TrendingUp, Gauge, Flame, Sparkles, X } from 'lucide-react';
import { OUTCOME_COLORS } from '../constants';
import { ALL_OUTCOMES } from '../predictionEngine';
import {
  getDisplacementLabel,
  getSignalTone,
  formatSignalTargets,
  translateReason,
} from '../utils';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PredictionMode | null;
  prediction: PredictionResult | null;
  bettingSignal: BettingSignal | null;
  activeModeToShow: PredictionMode;
  config: Pick<Config, 'useKellyCriterion' | 'minSupport'>;
  language: Language;
  t: (key: any) => string;
  getModeLabel: (mode: PredictionMode) => string;
}

export default function MobileBottomSheet({
  isOpen,
  onClose,
  mode,
  prediction,
  bettingSignal,
  activeModeToShow,
  config,
  language,
  t,
  getModeLabel,
}: MobileBottomSheetProps) {
  const [startY, setStartY] = useState<number | null>(null);
  const [currentY, setCurrentY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isRendered, setIsRendered] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Disable body scroll when open
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered || !mode || !prediction || !bettingSignal) return null;

  // Touch handlers to support drag-down-to-dismiss gesture
  const handleTouchStart = (e: TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!startY || !isDragging) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 0) {
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentY > 150) {
      onClose();
    }
    setCurrentY(0);
    setStartY(null);
  };

  return (
    <div
      data-layout="mobile-bottom-sheet"
      className="md:hidden fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sheet Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${isOpen ? currentY : '100%'}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
        className="w-full max-h-[85vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col relative z-10"
      >
        {/* Drag Indicator Handle */}
        <div className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 pb-3">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">PHÂN TÍCH CHI TIẾT</span>
            <h4 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              {getModeLabel(mode)}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full border border-slate-800 bg-slate-950 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable details content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Card 1: Prediction Lead */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {t('predictionLead')}
                </span>
                <span className="text-xs text-slate-500">{t('eventDriven')}</span>
              </div>
              {activeModeToShow === 'relative' && prediction.directional ? (
                <>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {prediction.directional.direction === 'forward' && (
                      <span className="text-emerald-400">{t('directionForward')}</span>
                    )}
                    {prediction.directional.direction === 'backward' && (
                      <span className="text-rose-400">{t('directionBackward')}</span>
                    )}
                    {prediction.directional.direction === 'stay' && (
                      <span className="text-slate-400">{t('directionStay')}</span>
                    )}
                    {prediction.directional.direction === 'half' && (
                      <span className="text-indigo-400">{t('directionHalf')}</span>
                    )}
                  </h2>
                  <p className="text-xs font-semibold text-slate-300 mt-1">
                    {prediction.directional.minSteps > 0 ? (
                      <>{t('displacementMin')} {prediction.directional.minSteps} {t('slots')}</>
                    ) : (
                      <>{t('displacementNone')}</>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('targetOutcome')}:{' '}
                    <strong className={OUTCOME_COLORS[prediction.topOutcome].text}>
                      {prediction.topOutcome.toUpperCase().replace('_', ' ')}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-white tracking-tight">
                    {prediction.probabilities[prediction.topOutcome] > 0 ? (
                      <span className={OUTCOME_COLORS[prediction.topOutcome].text}>
                        {prediction.topOutcome.replace('_', ' ').toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </h2>
                  <p className="text-xs font-semibold text-slate-300 mt-1">
                    {t('highestProb')}: {prediction.probabilities[prediction.topOutcome]}%
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Evidence Support */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  {t('evidenceSupport')}
                </span>
                <span className="text-xs text-slate-500">{t('minSupport')} = {config.minSupport}</span>
              </div>

              <div className="flex items-center gap-3">
                {prediction.confidence === 'high' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Flame className="w-3.5 h-3.5 mr-1 animate-pulse text-emerald-400" />
                    {t('highConfidence')}
                  </span>
                ) : prediction.confidence === 'medium' ? (
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
                  {t('activeContext')} ({prediction.evidence.matchedOrder}-{t('order')}):
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {prediction.evidence.activeContext.length === 0 ? (
                    <span className="text-xs text-slate-600 italic">{t('nonePriorDominant')}</span>
                  ) : (
                    prediction.evidence.activeContext.map((c, i) => {
                      const color = OUTCOME_COLORS[c];
                      const nextItem = prediction.evidence.activeContext[i + 1];
                      let shiftLabel = '';
                      if (nextItem && activeModeToShow === 'relative') {
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
                    {prediction.evidence.contextCount}
                  </strong>{' '}
                  {t('timesInHistory')}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Payout Regime */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  {t('payoutRegime')}
                </span>
                <span className="text-xs text-slate-500">{t('last15Spins')}</span>
              </div>

              <div className="flex flex-col gap-2">
                {prediction.regime === 'hot' ? (
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
                  <strong className="text-slate-200">{prediction.largeCount}/15</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Betting Signal */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
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
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getSignalTone(bettingSignal.action)}`}
                >
                  {t(`signalAction_${bettingSignal.action}`)}
                </span>
                {bettingSignal.isDriftDetected && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                    ⚠️ {t('driftDetected')}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-black text-white mt-3 tracking-tight">
                {formatSignalTargets(bettingSignal.targets, bettingSignal.target)}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                  <div className="text-slate-500">{t('stakeLevel')}</div>
                  <div className="font-bold text-slate-200 uppercase">{bettingSignal.stakeLevel}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                  <div className="text-slate-500">{t('riskLevel')}</div>
                  <div className="font-bold text-slate-200 uppercase">{bettingSignal.risk}</div>
                </div>
              </div>

              <div className="mt-3 space-y-1 border-t border-slate-800/40 pt-2 text-[9px] text-slate-500">
                {bettingSignal.reasons.slice(0, 3).map((reason) => (
                  <div key={reason} className="text-slate-400 flex gap-1">
                    <span className="text-indigo-400">•</span>
                    <span>{translateReason(reason, language)}</span>
                  </div>
                ))}
              </div>

              {config.useKellyCriterion &&
                bettingSignal.recommendedBets &&
                Object.keys(bettingSignal.recommendedBets).length > 0 && (
                  <div className="mt-3 border-t border-slate-800/40 pt-2">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {t('recommendedBetLabel')} (Kelly):
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-xs">
                      {Object.entries(bettingSignal.recommendedBets).map(([outcome, bet]) => {
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
    </div>
  );
}
