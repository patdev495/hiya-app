import { useState, useEffect } from 'react';
import { calculateDeckWindowStats, calculatePrediction, ALL_OUTCOMES, MULTIPLIERS } from './predictionEngine';
import { calculateBacktest, calculateBettingSignal, selectActivePredictionMode } from './bettingSignalEngine';
import type { Outcome, Config, HistoryItem, PredictionMode } from './types';
import { translations, type Language } from './locales';
import { 
  History, 
  Trash2, 
  Edit2, 
  RotateCcw, 
  Info, 
  TrendingUp, 
  Gauge, 
  Sliders,
  Check,
  X,
  Sparkles,
  Flame
} from 'lucide-react';

const LOCAL_STORAGE_HISTORY_KEY = 'wheel_prediction_history_v1';
const LOCAL_STORAGE_CONFIG_KEY = 'wheel_prediction_config_v1';

const getDisplacementLabel = (shift: number, lang: Language): string => {
  const labels = translations[lang].displacementLabels;
  if (shift === 0) return labels.stay;
  if (shift === 1) return labels.fwd1;
  if (shift === 2) return labels.fwd2;
  if (shift === 3) return labels.fwd3;
  if (shift === 4) return labels.half;
  if (shift === 5) return labels.bwd3;
  if (shift === 6) return labels.bwd2;
  if (shift === 7) return labels.bwd1;
  return '';
};

const DEFAULT_CONFIG: Config = {
  historyWindow: 100,
  maxOrder: 2,
  priorStrength: 20,
  minSupport: 5,
  predictionMode: 'relative',
  useRegimeAdjuster: true,
  decayFactor: 0.95,
  useDeckAdjuster: true,
  deckSize: 1000,
  useAdaptiveSafety: true,
  useAutoModeSwitch: true,
  autoModeWindow: 30,
};

// Color mapping for outcomes to make the UI look rich and easy to scan
const OUTCOME_COLORS: Record<Outcome, { bg: string; text: string; border: string; accent: string }> = {
  x5_1: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500' },
  x5_2: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', accent: 'bg-teal-500' },
  x5_3: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', accent: 'bg-cyan-500' },
  x5_4: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', accent: 'bg-sky-500' },
  x10: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500' },
  x15: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', accent: 'bg-indigo-500' },
  x25: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', accent: 'bg-violet-500' },
  x45: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', accent: 'bg-rose-500' },
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  x5_1: 'x5 Slot 1',
  x5_2: 'x5 Slot 2',
  x5_3: 'x5 Slot 3',
  x5_4: 'x5 Slot 4',
  x10: 'x10 Slot',
  x15: 'x15 Slot',
  x25: 'x25 Slot',
  x45: 'x45 Slot',
};

const getSignalTone = (action: string): string => {
  if (action === 'skip') return 'bg-slate-800 text-slate-300 border-slate-700';
  if (action === 'normal') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (action === 'probe') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
};

const formatSignalTarget = (target: string | null): string => {
  return target ? target.replace('_', ' ').toUpperCase() : 'SKIP';
};

const translateReason = (reason: string, lang: Language): string => {
  if (lang === 'en') return reason;
  
  // Match outcome clear message (e.g. x5_3 clears break-even plus safety margin.)
  const outcomeClearMatch = reason.match(/^(\w+) clears break-even plus safety margin\.$/);
  if (outcomeClearMatch) {
    return `${outcomeClearMatch[1].toUpperCase()} vượt điểm hòa vốn + biên an toàn.`;
  }
  
  const dict: Record<string, string> = {
    'Exact x5 slot has strong supported evidence.': 'Ô x5 cụ thể có bằng chứng hỗ trợ mạnh mẽ.',
    'No outcome clears break-even plus safety margin.': 'Không có ô nào vượt điểm hòa vốn + biên an toàn.',
    'Only generic x5 outcomes cleared the edge gate; exact-slot support is required.': 'Chỉ có các ô x5 chung vượt ngưỡng; yêu cầu hỗ trợ ô cụ thể.',
    'Hot regime supports large-outcome targets.': 'Chế độ Hot hỗ trợ mục tiêu ô nhân lớn.',
    'Cold regime conflicts with large-outcome targets.': 'Chế độ Cold xung đột với mục tiêu ô nhân lớn.',
    'Transition evidence has medium or high support.': 'Bằng chứng chuyển cảnh có hỗ trợ trung bình hoặc cao.',
  };
  
  return dict[reason] || reason;
};

const DEMO_HISTORY: Outcome[] = [
  'x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x15', 'x5_3',
  'x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x10', 'x5_4', 'x25', 'x5_1', 'x5_2',
  'x10', 'x5_1', 'x5_2', 'x10', 'x5_1', 'x5_2', 'x45', 'x5_3', 'x5_1', 'x5_2'
];

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOutcome, setEditingOutcome] = useState<Outcome | ''>('');
  const [language, setLanguage] = useState<Language>('vi');
  const [previewMode, setPreviewMode] = useState<PredictionMode | null>(null);

  useEffect(() => {
    const storedLang = localStorage.getItem('wheel_prediction_lang');
    if (storedLang === 'en' || storedLang === 'vi') {
      setLanguage(storedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('wheel_prediction_lang', lang);
  };

  const t = (key: Exclude<keyof typeof translations['en'], 'displacementLabels'>): string => {
    return (translations[language][key] || translations['en'][key] || key) as string;
  };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }

      const storedConfig = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        if (!parsed.predictionMode) {
          parsed.predictionMode = 'absolute';
        }
        if (parsed.useRegimeAdjuster === undefined) {
          parsed.useRegimeAdjuster = false;
        }
        if (parsed.decayFactor === undefined) {
          parsed.decayFactor = 0.95;
        }
        if (parsed.useDeckAdjuster === undefined) {
          parsed.useDeckAdjuster = false;
        }
        if (parsed.deckSize === undefined) {
          parsed.deckSize = 1000;
        }
        if (parsed.useAdaptiveSafety === undefined) {
          parsed.useAdaptiveSafety = true;
        }
        if (parsed.useAutoModeSwitch === undefined) {
          parsed.useAutoModeSwitch = true;
        }
        if (parsed.autoModeWindow === undefined) {
          parsed.autoModeWindow = 30;
        }
        setConfig(parsed);
      }
    } catch (e) {
      console.error('Error reading localStorage', e);
    }
  }, []);

  // Save changes to localStorage
  const updateHistoryState = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const updateConfigState = (newConfig: Config) => {
    setConfig(newConfig);
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(newConfig));
  };

  // UI Actions
  const handleAddOutcome = (outcome: Outcome) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      outcome,
      timestamp: Date.now(),
    };
    updateHistoryState([...history, newItem]);
    setPreviewMode(null);
  };

  const handleStartEdit = (item: HistoryItem) => {
    setEditingId(item.id);
    setEditingOutcome(item.outcome);
  };

  const handleSaveEdit = (id: string) => {
    if (!editingOutcome) return;
    const newHistory = history.map(item => 
      item.id === id ? { ...item, outcome: editingOutcome } : item
    );
    updateHistoryState(newHistory);
    setEditingId(null);
    setEditingOutcome('');
  };

  const handleDeleteItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    updateHistoryState(newHistory);
    if (editingId === id) {
      setEditingId(null);
      setEditingOutcome('');
    }
  };

  const handleClearHistory = () => {
    if (window.confirm(t('confirmReset'))) {
      updateHistoryState([]);
    }
  };

  const handleLoadDemo = () => {
    const demoItems: HistoryItem[] = DEMO_HISTORY.map((outcome, idx) => ({
      id: `demo-${idx}-${Date.now()}`,
      outcome,
      timestamp: Date.now() - (DEMO_HISTORY.length - idx) * 40000, // spaced by ~40s
    }));
    updateHistoryState(demoItems);
  };

  // Prediction calculation using only the history outcomes
  const historyOutcomes = history.map(h => h.outcome);

  // Calculate simulated returns for each mode over the configured autoModeWindow
  const autoWindow = config.autoModeWindow || 30;
  const autoHistory = historyOutcomes.slice(-autoWindow);
  const modeReturns = {
    absolute: calculateBacktest(autoHistory, { ...config, predictionMode: 'absolute', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
    relative: calculateBacktest(autoHistory, { ...config, predictionMode: 'relative', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
    decay: calculateBacktest(autoHistory, { ...config, predictionMode: 'decay', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
  };

  // If previewMode is active, override config for prediction and betting signal calculations.
  // Otherwise, render probabilities with the same auto-selected mode used by the signal.
  const selectedPredictionMode = previewMode || selectActivePredictionMode(historyOutcomes, config);
  const activeConfigForPrediction = {
    ...config,
    predictionMode: selectedPredictionMode,
    useAutoModeSwitch: previewMode ? false : config.useAutoModeSwitch,
  };

  const prediction = calculatePrediction(historyOutcomes, activeConfigForPrediction);
  const bettingSignal = calculateBettingSignal(historyOutcomes, prediction, activeConfigForPrediction);
  const activeModeToShow = previewMode || bettingSignal.activeMode || selectedPredictionMode;
  const backtestSummary = calculateBacktest(historyOutcomes, config);
  const deckWindowStats = calculateDeckWindowStats(historyOutcomes, config.deckSize);

  // Split history into active (within window) and older
  const activeCount = prediction.activeHistory.length;
  const totalCount = history.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 antialiased pb-12">
      {/* Premium Gradient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">{t('liveSystem')}</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">{t('title')}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {t('subtitle')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3 mr-1">
              <button
                onClick={() => handleSetLanguage('en')}
                className={`px-2 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${language === 'en' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/40'}`}
              >
                EN
              </button>
              <button
                onClick={() => handleSetLanguage('vi')}
                className={`px-2 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${language === 'vi' ? 'bg-indigo-600 text-white font-black' : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/40'}`}
              >
                VI
              </button>
            </div>

            <button
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {t('loadDemo')}
            </button>
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('resetApp')}
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Predictions & Recording */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Top Highlight Panel (Top Outcome / Confidence) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              
              {/* Top Outcome Highlight */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl" />
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t('predictionLead')}
                    </span>
                    <span className="text-xs text-slate-500">{t('eventDriven')}</span>
                  </div>
                  {activeConfigForPrediction.predictionMode === 'relative' && prediction.directional ? (
                    <>
                      <h2 className="text-4xl font-black text-white mt-4 tracking-tight">
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
                      <p className="text-sm font-semibold text-slate-300 mt-2">
                        {prediction.directional.minSteps > 0 ? (
                          <>{t('displacementMin')} {prediction.directional.minSteps} {t('slots')}</>
                        ) : (
                          <>{t('displacementNone')}</>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {t('targetOutcome')}: <strong className={OUTCOME_COLORS[prediction.topOutcome].text}>{prediction.topOutcome.toUpperCase().replace('_', ' ')}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-5xl font-black text-white mt-4 tracking-tight">
                        {prediction.probabilities[prediction.topOutcome] > 0 ? (
                          <span className={OUTCOME_COLORS[prediction.topOutcome].text}>
                            {prediction.topOutcome.replace('_', ' ').toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </h2>
                      <p className="text-sm font-semibold text-slate-300 mt-2">
                        {t('highestProb')}: {prediction.probabilities[prediction.topOutcome]}%
                      </p>
                    </>
                  )}
                </div>
                
                <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 border-t border-slate-800/50 pt-3">
                  <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>
                    {t('disclaimer')}
                  </span>
                </div>
              </div>

              {/* Confidence Indicator Card */}
              {/* Confidence Indicator Card */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      {t('evidenceSupport')}
                    </span>
                    <span className="text-xs text-slate-500">{t('minSupport')} = {config.minSupport}</span>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-3">
                    {prediction.confidence === 'high' ? (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Flame className="w-4 h-4 mr-1.5 animate-pulse text-emerald-400" />
                        {t('highConfidence')}
                      </span>
                    ) : prediction.confidence === 'medium' ? (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {t('mediumConfidence')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        {t('lowConfidence')}
                      </span>
                    )}
                  </div>

                  {/* Active Context Readout */}
                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-slate-400">
                      {t('activeContext')} ({prediction.evidence.matchedOrder}-{t('order')}):
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {prediction.evidence.activeContext.length === 0 ? (
                        <span className="text-xs text-slate-600 italic">{t('nonePriorDominant')}</span>
                      ) : (
                        prediction.evidence.activeContext.map((c, i) => {
                          const color = OUTCOME_COLORS[c];
                          const nextItem = prediction.evidence.activeContext[i + 1];
                          let shiftLabel = '';
                          if (nextItem && activeConfigForPrediction.predictionMode === 'relative') {
                            const idx1 = ALL_OUTCOMES.indexOf(c);
                            const idx2 = ALL_OUTCOMES.indexOf(nextItem);
                            const shift = (idx2 - idx1 + 8) % 8;
                            shiftLabel = getDisplacementLabel(shift, language);
                          }
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <span 
                                className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${color.bg} ${color.text} border ${color.border}`}
                              >
                                {c.toUpperCase()}
                              </span>
                              {shiftLabel && (
                                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                  {shiftLabel}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {t('contextSeen')} <strong className="text-slate-300 font-semibold">{prediction.evidence.contextCount}</strong> {t('timesInHistory')}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-800/50 pt-3 text-xs text-slate-500">
                  {prediction.confidence === 'low' ? (
                    <span>{t('priorDominatesDesc')}</span>
                  ) : prediction.confidence === 'medium' ? (
                    <span>{t('mediumSupportDesc')}</span>
                  ) : (
                    <span>{t('strongSupportDesc')}</span>
                  )}
                </div>
              </div>

              {/* Payout Regime Status Card */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      {t('payoutRegime')}
                    </span>
                    <span className="text-xs text-slate-500">{t('last15Spins')}</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    {prediction.regime === 'hot' ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <Flame className="w-4 h-4 mr-1.5 animate-pulse text-rose-400" />
                          {t('hotRegime')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          <span className="w-2.5 h-2.5 mr-1.5 rounded-full bg-blue-500 animate-pulse" />
                          {t('coldRegime')}
                        </span>
                      </div>
                    )}
                    
                    <div className="text-xs text-slate-400 mt-2">
                      {t('largeSpins')} (≥ x10): <strong className="text-slate-200">{prediction.largeCount}/15</strong>
                    </div>

                    <div className="text-[10px] text-slate-500 mt-1">
                      {prediction.regime === 'hot' 
                        ? t('hotRegimeDesc') 
                        : t('coldRegimeDesc')}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-800/50 pt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{t('adjusterStatus')}:</span>
                  {config.useRegimeAdjuster ? (
                    <span className="text-emerald-400 font-bold">{t('activeOn')}</span>
                  ) : (
                    <span className="text-slate-500 font-medium">{t('inactiveOff')}</span>
                  )}
                </div>
              </div>

              {/* Betting Signal Card */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      {t('bettingSignal')}
                    </span>
                    <span className="text-xs text-slate-500">{t('edgeGate')}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold border ${getSignalTone(bettingSignal.action)}`}>
                      {t(`signalAction_${bettingSignal.action}` as Exclude<keyof typeof translations['en'], 'displacementLabels'>)}
                    </span>
                    {bettingSignal.isDriftDetected && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                        ⚠️ {t('driftDetected')}
                      </span>
                    )}
                  </div>

                  <h2 className="text-3xl font-black text-white mt-4 tracking-tight">
                    {formatSignalTarget(bettingSignal.target)}
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                      <div className="text-slate-500">{t('stakeLevel')}</div>
                      <div className="font-bold text-slate-200 uppercase">{bettingSignal.stakeLevel}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                      <div className="text-slate-500">{t('riskLevel')}</div>
                      <div className="font-bold text-slate-200 uppercase">{bettingSignal.risk}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-slate-800/40 pt-3 text-[10px] text-slate-500">
                    <div className="flex justify-between">
                      <span>{t('activeSafetyMarginLabel')}:</span>
                      <span className="font-mono font-semibold text-slate-300">
                        {bettingSignal.adaptiveSafetyMargin}% 
                        {bettingSignal.isDriftDetected && <span className="text-rose-400 ml-1">({t('adaptiveSafetyStatus')})</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('activeModeLabel')}:</span>
                      <span className="font-semibold text-indigo-400 uppercase">
                        {t(`mode${bettingSignal.activeMode ? bettingSignal.activeMode.charAt(0).toUpperCase() + bettingSignal.activeMode.slice(1) : 'Relative'}` as any)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-800/50 pt-3 space-y-1">
                  {bettingSignal.reasons.slice(0, 3).map((reason) => (
                    <div key={reason} className="text-[10px] text-slate-400 flex gap-1.5">
                      <span className="text-indigo-400">•</span>
                      <span>{translateReason(reason, language)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Probability Distribution Cards */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                {t('predictedDist')}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {ALL_OUTCOMES.map((o) => {
                  const prob = prediction.probabilities[o];
                  const color = OUTCOME_COLORS[o];
                  const isTop = o === prediction.topOutcome && prob > 0;
                  
                  return (
                    <div 
                      key={o} 
                      className={`relative border rounded-xl p-4 transition-all duration-300 ${isTop ? 'bg-slate-800/40 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.02]' : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${color.bg} ${color.text} border ${color.border}`}>
                          {o}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          1/{MULTIPLIERS[o]}
                        </span>
                      </div>
                      
                      <div className="mt-4 flex items-baseline justify-between">
                        <span className="text-2xl font-black text-white">{prob}%</span>
                        {isTop && (
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                            {t('leadBadge')}
                          </span>
                        )}
                      </div>

                      {/* Mini visual percentage progress bar */}
                      <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                        <div 
                          className={`h-full ${color.accent} rounded-full transition-all duration-500`}
                          style={{ width: `${prob}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Record Outcome Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 relative">
              <h3 className="text-lg font-bold text-white mb-2">{t('recordOutcome')}</h3>
              <p className="text-slate-400 text-xs mb-6">
                {t('recordDesc')}
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {ALL_OUTCOMES.map((o) => {
                  const color = OUTCOME_COLORS[o];
                  const reverseIdx = [...historyOutcomes].reverse().indexOf(o);
                  const drySpins = reverseIdx === -1 ? null : reverseIdx;
                  return (
                    <button
                      key={o}
                      onClick={() => handleAddOutcome(o)}
                      className={`h-20 px-4 border rounded-xl flex flex-col justify-center items-center text-center transition-all duration-200 active:scale-95 cursor-pointer bg-slate-950/60 ${color.border} hover:bg-slate-800 hover:border-slate-600 group relative overflow-hidden`}
                    >
                      <span className="absolute top-1.5 right-2 text-[9px] font-mono text-slate-500">
                        {drySpins !== null ? `-${drySpins}` : '—'}
                      </span>
                      <span className={`text-sm font-black tracking-wide ${color.text} group-hover:scale-105 transition-transform`}>
                        {o.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {OUTCOME_LABELS[o]}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-0.5 font-medium">
                        {drySpins !== null ? (drySpins === 0 ? (language === 'vi' ? 'Vừa ra' : 'Just hit') : `${drySpins} ${language === 'vi' ? 'lượt chưa ra' : 'spins dry'}`) : (language === 'vi' ? 'Chưa ra' : 'Never hit')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Column 3: Configuration & History log */}
          <div className="space-y-8">
            
            {/* Configuration Settings */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                {t('modelConfig')}
              </h3>
              
              <div className="space-y-6">
                {/* Prediction Mode Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                    {t('predMode')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Absolute Mode */}
                    <button
                      onClick={() => {
                        if (config.useAutoModeSwitch) {
                          setPreviewMode(previewMode === 'absolute' ? null : 'absolute');
                        } else {
                          updateConfigState({ ...config, predictionMode: 'absolute' });
                        }
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        config.useAutoModeSwitch
                          ? previewMode === 'absolute'
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : previewMode === null && activeModeToShow === 'absolute'
                            ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                            : 'bg-slate-950/40 border-slate-900/60 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-800'
                          : config.predictionMode === 'absolute'
                          ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{t('modeAbsolute')}</span>
                        <span className={`text-[10px] font-mono mt-0.5 ${modeReturns.absolute > 0 ? 'text-emerald-400' : modeReturns.absolute < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          ({modeReturns.absolute > 0 ? '+' : ''}{modeReturns.absolute})
                        </span>
                      </div>
                    </button>

                    {/* Relative Mode */}
                    <button
                      onClick={() => {
                        if (config.useAutoModeSwitch) {
                          setPreviewMode(previewMode === 'relative' ? null : 'relative');
                        } else {
                          updateConfigState({ ...config, predictionMode: 'relative' });
                        }
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        config.useAutoModeSwitch
                          ? previewMode === 'relative'
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : previewMode === null && activeModeToShow === 'relative'
                            ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                            : 'bg-slate-950/40 border-slate-900/60 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-800'
                          : config.predictionMode === 'relative'
                          ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{t('modeRelative')}</span>
                        <span className={`text-[10px] font-mono mt-0.5 ${modeReturns.relative > 0 ? 'text-emerald-400' : modeReturns.relative < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          ({modeReturns.relative > 0 ? '+' : ''}{modeReturns.relative})
                        </span>
                      </div>
                    </button>

                    {/* Decay Mode */}
                    <button
                      onClick={() => {
                        if (config.useAutoModeSwitch) {
                          setPreviewMode(previewMode === 'decay' ? null : 'decay');
                        } else {
                          updateConfigState({ ...config, predictionMode: 'decay' });
                        }
                      }}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        config.useAutoModeSwitch
                          ? previewMode === 'decay'
                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : previewMode === null && activeModeToShow === 'decay'
                            ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                            : 'bg-slate-950/40 border-slate-900/60 text-slate-500 opacity-60 hover:opacity-100 hover:border-slate-800'
                          : config.predictionMode === 'decay'
                          ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span>{t('modeDecay')}</span>
                        <span className={`text-[10px] font-mono mt-0.5 ${modeReturns.decay > 0 ? 'text-emerald-400' : modeReturns.decay < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          ({modeReturns.decay > 0 ? '+' : ''}{modeReturns.decay})
                        </span>
                      </div>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {config.useAutoModeSwitch && history.length >= (config.autoModeWindow || 30) ? (
                      previewMode ? (
                        <span className="text-amber-400 font-medium">
                          ⚠️ {language === 'vi' ? 'Đang xem tạm chế độ' : 'Previewing mode'}: {t(`mode${activeModeToShow.charAt(0).toUpperCase()}${activeModeToShow.slice(1)}` as any)}. {language === 'vi' ? 'Bấm lại để hủy xem tạm.' : 'Click again to cancel preview.'}
                        </span>
                      ) : (
                        <span className="text-indigo-400 font-medium">
                          {t('activeModeLabel')}: {t(`mode${activeModeToShow.charAt(0).toUpperCase()}${activeModeToShow.slice(1)}` as any)} {language === 'vi' ? '(Tối ưu tự động)' : '(Auto Optimized)'}
                        </span>
                      )
                    ) : (
                      <>
                        {config.predictionMode === 'absolute' && t('absoluteDesc')}
                        {config.predictionMode === 'relative' && t('relativeDesc')}
                        {config.predictionMode === 'decay' && t('decayDesc')}
                      </>
                    )}
                  </p>
                </div>

                {/* Decay Factor (visible only in Decay mode) */}
                {config.predictionMode === 'decay' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {t('decayFactorLabel')} (λ)
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-400">{config.decayFactor}</span>
                    </div>
                    <input
                      type="range"
                      min="0.80"
                      max="0.99"
                      step="0.01"
                      value={config.decayFactor}
                      onChange={(e) => updateConfigState({ ...config, decayFactor: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>0.80 ({t('fastDecay')})</span>
                      <span>0.99 ({t('slowDecay')})</span>
                    </div>
                  </div>
                )}

                {/* Hot/Cold Cycle Adjuster Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      {t('hotColdAdjuster')}
                    </label>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {t('rtpCompensator')}
                    </span>
                  </div>
                  <button
                    onClick={() => updateConfigState({ ...config, useRegimeAdjuster: !config.useRegimeAdjuster })}
                    className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.useRegimeAdjuster ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                  >
                    {config.useRegimeAdjuster ? t('enabledOn') : t('disabledOff')}
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('adjusterDesc')}
                  </p>
                </div>

                {/* Exhaustion Deck Adjuster Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      {t('deckAdjuster')}
                    </label>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {t('deckCompensator')}
                    </span>
                  </div>
                  <button
                    onClick={() => updateConfigState({ ...config, useDeckAdjuster: !config.useDeckAdjuster })}
                    className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.useDeckAdjuster ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                  >
                    {config.useDeckAdjuster ? t('enabledOn') : t('disabledOff')}
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('deckAdjusterDesc')}
                  </p>
                </div>

                {/* Assumed Deck Size (visible only when Deck Adjuster is enabled) */}
                {config.useDeckAdjuster && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {t('deckSizeLabel')}
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-400">{config.deckSize}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      value={config.deckSize}
                      onChange={(e) => updateConfigState({ ...config, deckSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>100 {t('deckSpins')}</span>
                      <span>5000 {t('deckSpins')}</span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                        <span>{t('deckWindowStats')}</span>
                        <span>{deckWindowStats.windowSize}/{deckWindowStats.configuredSize}</span>
                      </div>
                      <div className="divide-y divide-slate-800/80">
                        {ALL_OUTCOMES.map((outcome) => {
                          const stats = deckWindowStats.outcomes[outcome];
                          const color = OUTCOME_COLORS[outcome];
                          const ratioTone = stats.ratioPercent > 100
                            ? 'text-rose-400'
                            : stats.ratioPercent < 100
                              ? 'text-emerald-400'
                              : 'text-slate-400';

                          return (
                            <div key={outcome} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs">
                              <span className={`font-mono font-bold ${color.text}`}>
                                {outcome.toUpperCase()}
                              </span>
                              <span className="text-slate-300 font-semibold text-right flex flex-col items-end">
                                <span>
                                  {stats.count}
                                  <span className="text-slate-600 font-normal"> / {stats.expected}</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  {stats.countPercent}% / {stats.expectedPercent}%
                                </span>
                              </span>
                              <span className={`font-mono font-bold ${ratioTone}`}>
                                {stats.ratioPercent}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Adaptive Safety Margin Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      {t('useAdaptiveSafety')}
                    </label>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {t('adaptiveSafetyStatus')}
                    </span>
                  </div>
                  <button
                    onClick={() => updateConfigState({ ...config, useAdaptiveSafety: !config.useAdaptiveSafety })}
                    className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.useAdaptiveSafety ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                  >
                    {config.useAdaptiveSafety ? t('enabledOn') : t('disabledOff')}
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('adaptiveSafetyDesc')}
                  </p>
                </div>

                {/* Auto Mode Switching Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      {t('useAutoModeSwitch')}
                    </label>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Auto Mode
                    </span>
                  </div>
                  <button
                    onClick={() => updateConfigState({ ...config, useAutoModeSwitch: !config.useAutoModeSwitch })}
                    className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.useAutoModeSwitch ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                  >
                    {config.useAutoModeSwitch ? t('enabledOn') : t('disabledOff')}
                  </button>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('autoModeSwitchDesc')}
                  </p>

                  {config.useAutoModeSwitch && (
                    <div className="mt-4 border-t border-slate-800/40 pt-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {t('autoModeWindowLabel')}
                        </label>
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          {config.autoModeWindow || 30} {t('autoSpins')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="100"
                        step="5"
                        value={config.autoModeWindow || 30}
                        onChange={(e) => updateConfigState({ ...config, autoModeWindow: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Active History Window Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                    {t('activeHistoryWindow')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateConfigState({ ...config, historyWindow: preset })}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.historyWindow === preset ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                      >
                        {preset} {t('presetSpins')}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {t('windowDesc')}
                  </p>
                </div>

                {/* Prior Strength */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('priorStrength')}
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">{config.priorStrength}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={config.priorStrength}
                    onChange={(e) => updateConfigState({ ...config, priorStrength: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>5 ({t('weakPrior')})</span>
                    <span>50 ({t('strongPrior')})</span>
                  </div>
                </div>

                {/* Markov Order */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('markovOrder')}
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">{config.maxOrder}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={config.maxOrder}
                    onChange={(e) => updateConfigState({ ...config, maxOrder: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 ({t('orderLabel')} 1)</span>
                    <span>3 ({t('orderLabel')} 3)</span>
                  </div>
                </div>

                {/* Min Support */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('minSupportSlider')}
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">{config.minSupport}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={config.minSupport}
                    onChange={(e) => updateConfigState({ ...config, minSupport: parseInt(e.target.value) })}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 ({t('lowSupport')})</span>
                    <span>10 ({t('highSupport')})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Backtest Summary Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                {t('backtestSummary')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{t('evaluatedSpins')}</div>
                  <div className="text-xl font-black text-white">{backtestSummary.totalEvaluated}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{t('skippedSpins')}</div>
                  <div className="text-xl font-black text-white">{backtestSummary.skipped}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{t('normalSignals')}</div>
                  <div className="text-xl font-black text-emerald-400">{backtestSummary.actionCounts.normal}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{t('estimatedReturn')}</div>
                  <div className={`text-xl font-black ${backtestSummary.estimatedReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {backtestSummary.estimatedReturn}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(backtestSummary.hitsByTarget).length === 0 ? (
                  <div className="text-xs text-slate-500">{t('noBacktestSignals')}</div>
                ) : (
                  Object.entries(backtestSummary.hitsByTarget).map(([target, stats]) => (
                    <div key={target} className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2 last:border-b-0">
                      <span className="font-mono font-bold text-slate-300">{formatSignalTarget(target)}</span>
                      <span className="text-slate-500">
                        {stats.hits}/{stats.attempts} · {stats.hitRate}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* History Log Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col max-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  {t('spinLog')}
                </h3>
                <span className="text-xs text-slate-500 font-semibold font-mono">
                  {t('logActive')}: {activeCount}/{totalCount}
                </span>
              </div>

              {history.length === 0 ? (
                <div className="flex-1 py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <History className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">{t('noHistory')}</p>
                  <p className="text-xs text-slate-600 mt-1">{t('noHistoryDesc')}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {/* Show history reverse sorted (newest at top) */}
                  {[...history].reverse().map((item, reverseIdx) => {
                    const originalIdx = history.length - 1 - reverseIdx;
                    const isActive = originalIdx >= history.length - config.historyWindow;
                    const isEditing = editingId === item.id;
                    const color = OUTCOME_COLORS[item.outcome];
                    
                    return (
                      <div 
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isActive ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-950/20 border-slate-900 opacity-40'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 font-mono font-semibold w-6">
                            #{originalIdx + 1}
                          </span>
                          
                          {isEditing ? (
                            <select
                              value={editingOutcome}
                              onChange={(e) => setEditingOutcome(e.target.value as Outcome)}
                              className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                              {ALL_OUTCOMES.map(o => (
                                <option key={o} value={o}>{o.toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${color.bg} ${color.text} border ${color.border}`}>
                              {item.outcome.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditingOutcome(''); }}
                                className="p-1 text-slate-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title={t('editRow')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title={t('deleteRow')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
