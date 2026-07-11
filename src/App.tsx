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
import { OUTCOME_COLORS, OUTCOME_LABELS } from './constants';
import {
  getDisplacementLabel,
  getSignalTone,
  formatSignalTarget,
  formatSignalTargets,
  translateReason
} from './utils';
import ModeCard from './components/ModeCard';
import HoverPreviewPanel from './components/HoverPreviewPanel';
import SettingsModal from './components/SettingsModal';
import MobileTabBar, { type MobileTab } from './components/MobileTabBar';
import MobileBottomSheet from './components/MobileBottomSheet';

const LOCAL_STORAGE_HISTORY_KEY = 'wheel_prediction_history_v1';
const LOCAL_STORAGE_CONFIG_KEY = 'wheel_prediction_config_v1';

const DEFAULT_CONFIG: Config = {
  historyWindow: 100,
  maxOrder: 2,
  priorStrength: 20,
  patternStrength: 3,
  minSupport: 5,
  predictionMode: 'relative',
  useRegimeAdjuster: true,
  decayFactor: 0.95,
  useDeckAdjuster: true,
  deckSize: 1000,
  useAdaptiveSafety: true,
  useAutoModeSwitch: true,
  autoModeWindow: 3,
  hotRegimeWindow: 15,
  hotRegimeThreshold: 4,
  bankroll: 1000000,
  theoreticalRtp: 96,
  rtpWindow: 100,
  useRtpAdaptation: true,
  rtpSensitivity: 1.0,
  useKellyCriterion: true,
  kellyMultiplier: 0.25,
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
  const [hoveredMode, setHoveredMode] = useState<PredictionMode | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>('record');
  const [mobileSheetMode, setMobileSheetMode] = useState<PredictionMode | null>(null);

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
        if (parsed.predictionMode === 'decay') {
          parsed.predictionMode = 'pattern';
        }
        if (parsed.useRegimeAdjuster === undefined) {
          parsed.useRegimeAdjuster = false;
        }
        if (parsed.patternStrength === undefined) {
          parsed.patternStrength = 3;
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
          parsed.autoModeWindow = 3;
        }
        if (parsed.hotRegimeWindow === undefined) {
          parsed.hotRegimeWindow = 15;
        }
        if (parsed.hotRegimeThreshold === undefined) {
          parsed.hotRegimeThreshold = 4;
        }
        if (parsed.bankroll === undefined) parsed.bankroll = 1000000;
        if (parsed.theoreticalRtp === undefined) parsed.theoreticalRtp = 96;
        if (parsed.rtpWindow === undefined) parsed.rtpWindow = 100;
        if (parsed.useRtpAdaptation === undefined) parsed.useRtpAdaptation = true;
        if (parsed.rtpSensitivity === undefined) parsed.rtpSensitivity = 1.0;
        if (parsed.useKellyCriterion === undefined) parsed.useKellyCriterion = true;
        if (parsed.kellyMultiplier === undefined) parsed.kellyMultiplier = 0.25;
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
  const autoWindow = config.autoModeWindow || 3;
  const autoHistory = historyOutcomes.slice(-autoWindow);
  const previousAutoHistory = historyOutcomes.slice(0, -1).slice(-autoWindow);
  const modeBacktests = {
    absolute: calculateBacktest(autoHistory, { ...config, predictionMode: 'absolute', useAutoModeSwitch: false, useAdaptiveSafety: false }),
    relative: calculateBacktest(autoHistory, { ...config, predictionMode: 'relative', useAutoModeSwitch: false, useAdaptiveSafety: false }),
    pattern: calculateBacktest(autoHistory, { ...config, predictionMode: 'pattern', useAutoModeSwitch: false, useAdaptiveSafety: false }),
  };
  const modeStreakBacktests = {
    absolute: calculateBacktest(historyOutcomes, { ...config, predictionMode: 'absolute', useAutoModeSwitch: false, useAdaptiveSafety: false }),
    relative: calculateBacktest(historyOutcomes, { ...config, predictionMode: 'relative', useAutoModeSwitch: false, useAdaptiveSafety: false }),
    pattern: calculateBacktest(historyOutcomes, { ...config, predictionMode: 'pattern', useAutoModeSwitch: false, useAdaptiveSafety: false }),
  };
  const modeReturns = {
    absolute: modeBacktests.absolute.estimatedReturn,
    relative: modeBacktests.relative.estimatedReturn,
    pattern: modeBacktests.pattern.estimatedReturn,
  };
  const previousModeReturns = {
    absolute: calculateBacktest(previousAutoHistory, { ...config, predictionMode: 'absolute', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
    relative: calculateBacktest(previousAutoHistory, { ...config, predictionMode: 'relative', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
    pattern: calculateBacktest(previousAutoHistory, { ...config, predictionMode: 'pattern', useAutoModeSwitch: false, useAdaptiveSafety: false }).estimatedReturn,
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

  const hoverConfig = hoveredMode
    ? { ...config, predictionMode: hoveredMode, useAutoModeSwitch: false }
    : activeConfigForPrediction;
  const hoverPrediction = hoveredMode
    ? calculatePrediction(historyOutcomes, hoverConfig)
    : prediction;
  const hoverBettingSignal = hoveredMode
    ? calculateBettingSignal(historyOutcomes, hoverPrediction, hoverConfig)
    : bettingSignal;
  const hoverActiveModeToShow = hoveredMode || activeModeToShow;

  const backtestSummary = calculateBacktest(historyOutcomes, config);
  const deckWindowStats = calculateDeckWindowStats(historyOutcomes, config.deckSize);
  const regimeWindow = config.hotRegimeWindow || 15;
  const regimeThreshold = config.hotRegimeThreshold || 4;
  const regimeLargeCount = historyOutcomes
    .slice(-regimeWindow)
    .filter((outcome) => ['x10', 'x15', 'x25', 'x45'].includes(outcome)).length;
  const isHotRegime = regimeLargeCount >= regimeThreshold;

  // Split history into active (within window) and older
  const activeCount = prediction.activeHistory.length;
  const totalCount = history.length;
  const predictionModes: PredictionMode[] = ['absolute', 'relative', 'pattern'];
  const bestModeReturn = Math.max(...predictionModes.map((mode) => modeReturns[mode]));
  const autoSelectedMode = bettingSignal.activeMode || config.predictionMode;
  const modePredictions = Object.fromEntries(
    predictionModes.map((mode) => [
      mode,
      calculatePrediction(historyOutcomes, { ...config, predictionMode: mode, useAutoModeSwitch: false }),
    ])
  ) as Record<PredictionMode, typeof prediction>;
  const modeSignals = Object.fromEntries(
    predictionModes.map((mode) => [
      mode,
      calculateBettingSignal(
        historyOutcomes,
        modePredictions[mode],
        { ...config, predictionMode: mode, useAutoModeSwitch: false }
      ),
    ])
  ) as Record<PredictionMode, typeof bettingSignal>;

  // --- ENTROPY: Shannon entropy of recent history (normalized 0-100%) ---
  const entropyWindow = regimeWindow; // reuse hotRegimeWindow (default 15)
  const recentForEntropy = historyOutcomes.slice(-entropyWindow);
  const historyEntropy = (() => {
    if (recentForEntropy.length === 0) return 0;
    const counts: Record<string, number> = {};
    for (const o of recentForEntropy) {
      counts[o] = (counts[o] || 0) + 1;
    }
    const n = recentForEntropy.length;
    let h = 0;
    for (const c of Object.values(counts)) {
      const p = c / n;
      if (p > 0) h -= p * Math.log2(p);
    }
    // Normalize: max entropy for 8 outcomes = log2(8) = 3
    return Math.round((h / 3) * 100);
  })();

  // --- MODE CONSENSUS: outcomes recommended by ≥2 modes simultaneously ---
  const modeConsensusTargets = (() => {
    const targetCount: Record<string, number> = {};
    for (const mode of predictionModes) {
      for (const t of modeSignals[mode].targets ?? []) {
        targetCount[t] = (targetCount[t] || 0) + 1;
      }
    }
    return targetCount; // outcome -> how many modes recommend it
  })();

  const getModeLabel = (mode: PredictionMode) => {
    return t(`mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}` as any);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 antialiased pb-24 md:pb-12">
      {/* Premium Gradient Background Glows */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-72 w-72 rounded-full bg-indigo-600/10 blur-[96px] sm:h-96 sm:w-96 sm:blur-[128px]" />
      <div className="pointer-events-none absolute top-10 right-1/4 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-[96px] sm:h-96 sm:w-96 sm:blur-[128px]" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">

        {/* Header */}
        {/* Header */}
        <header className="border-b border-slate-800/80 pb-3 mb-4">
          {/* Row 1: Title & Action controls (Desktop) or Settings Toggle (Mobile) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* On Desktop, show the Live dot next to the title. On Mobile, it wraps with badges. */}
              <div className="hidden md:flex items-center gap-1.5">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
                <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase">{t('liveSystem')}</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white mt-1.5">{t('title')}</h1>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
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
              <button
                data-layout="settings-trigger"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 rounded-lg transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                {t('modelConfig')}
              </button>
            </div>

            {/* Mobile Actions: Only Settings Trigger Button */}
            <div className="flex md:hidden items-center">
              <button
                data-layout="settings-trigger"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center justify-center p-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Badges. Desktop: inline-flex, Mobile: horizontal scrollable container */}
          <div className="mt-3 flex max-w-full min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 md:pb-0">
            {/* Live Dot for Mobile (wrapped here) */}
            <div className="flex shrink-0 md:hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-0.5 text-[10px] font-bold">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
              </span>
              <span className="text-indigo-400 uppercase tracking-wider text-[9px]">{t('liveSystem')}</span>
            </div>

            <div
              data-layout="hot-regime-header"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                isHotRegime
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  : 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              }`}
            >
              <span>{isHotRegime ? t('hotRegime') : t('coldRegime')}</span>
              <span className="font-mono">{regimeLargeCount}/{regimeWindow}</span>
              <span className="text-slate-500">≥ {regimeThreshold}</span>
            </div>

            <div
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                historyEntropy <= 40
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                  : historyEntropy >= 80
                    ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                    : 'border-slate-600/40 bg-slate-800/40 text-slate-400'
              }`}
              title={
                language === 'en'
                  ? `Entropy: ${historyEntropy}% of max. Low = pattern exists. High = chaotic.`
                  : `Entropy: ${historyEntropy}% tối đa. Thấp = có pattern. Cao = hỗn loạn.`
              }
            >
              <span>Entropy</span>
              <span className="font-mono">{historyEntropy}%</span>
            </div>

            {bettingSignal.rtpActual !== undefined && (
              <div
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                  (bettingSignal.rtpDeviation ?? 0) < 0
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
                title={`${t('rtpActualLabel')}: ${bettingSignal.rtpActual}%, ${t('rtpDeviationLabel')}: ${bettingSignal.rtpDeviation}%`}
              >
                <span>RTP: {bettingSignal.rtpActual}%</span>
                <span className="font-mono text-[9px] opacity-80">
                  ({(bettingSignal.rtpDeviation ?? 0) >= 0 ? '+' : ''}{bettingSignal.rtpDeviation}%)
                </span>
              </div>
            )}
          </div>
        </header>

        <div data-layout="top-ops-panel" className="mb-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-6">
          <div className={`bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 ${activeTab === 'predict' ? 'block' : 'hidden'} md:block`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{t('predMode')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('activeModeLabel')}: <span className="text-indigo-300 font-bold uppercase">{getModeLabel(activeModeToShow)}</span></p>
              </div>
              {previewMode && (
                <button
                  onClick={() => setPreviewMode(null)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 cursor-pointer hover:bg-amber-500/20"
                >
                  PREVIEW OFF
                </button>
              )}
            </div>

            <div data-layout="mode-probability-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {predictionModes.map((mode) => {
                const modeReturn = modeReturns[mode];
                const modeReturnDelta = Math.round((modeReturn - previousModeReturns[mode]) * 100) / 100;
                const modePrediction = modePredictions[mode];
                const modeSignal = modeSignals[mode];
                const isPreview = previewMode === mode;
                const isAutoSelected = previewMode === null && config.useAutoModeSwitch && autoSelectedMode === mode;
                const isManualSelected = !config.useAutoModeSwitch && config.predictionMode === mode;
                const isBestMode = modeReturn === bestModeReturn;
                const stateLabel = isPreview
                  ? 'PREVIEW'
                  : isAutoSelected
                    ? 'AUTO'
                    : isManualSelected
                      ? 'ACTIVE'
                      : isBestMode
                        ? 'BEST'
                        : '';

                return (
                  <ModeCard
                    key={mode}
                    mode={mode}
                    modeReturn={modeReturn}
                    modeReturnDelta={modeReturnDelta}
                    modePrediction={modePrediction}
                    modeSignal={modeSignal}
                    modeBacktest={modeBacktests[mode]}
                    modeStreakBacktest={modeStreakBacktests[mode]}
                    modeConsensusTargets={modeConsensusTargets}
                    isPreview={isPreview}
                    isAutoSelected={!!isAutoSelected}
                    isManualSelected={isManualSelected}
                    isBestMode={isBestMode}
                    stateLabel={stateLabel}
                    language={language}
                    config={config}
                    getModeLabel={getModeLabel}
                    onMouseEnter={() => setHoveredMode(mode)}
                    onMouseLeave={() => setHoveredMode(null)}
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setMobileSheetMode(mode);
                      } else {
                        if (config.useAutoModeSwitch) {
                          setPreviewMode(previewMode === mode ? null : mode);
                        } else {
                          updateConfigState({ ...config, predictionMode: mode });
                        }
                      }
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border ${getSignalTone(bettingSignal.action)}`}>
                  {t(`signalAction_${bettingSignal.action}` as Exclude<keyof typeof translations['en'], 'displacementLabels'>)}
                </span>
                <span className="font-mono text-xl font-black text-white">{formatSignalTargets(bettingSignal.targets, bettingSignal.target)}</span>
                <span className="text-xs text-slate-500">{t('stakeLevel')}: <strong className="text-slate-300 uppercase">{bettingSignal.stakeLevel}</strong></span>
              </div>
              <div className="mt-3 space-y-1">
                {bettingSignal.reasons.slice(0, 3).map((reason) => (
                  <div key={reason} className="text-[11px] text-slate-400 flex gap-1.5">
                    <span className="text-indigo-400">•</span>
                    <span>{translateReason(reason, language)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`space-y-4 ${activeTab === 'record' ? 'block' : 'hidden'} md:block`}>
            <div data-layout="record-outcome-panel" className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 relative">
              <h3 className="text-lg font-bold text-white mb-3">{t('recordOutcome')}</h3>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 sm:gap-3">
                {ALL_OUTCOMES.map((o) => {
                  const color = OUTCOME_COLORS[o];
                  const reverseIdx = [...historyOutcomes].reverse().indexOf(o);
                  const drySpins = reverseIdx === -1 ? null : reverseIdx;
                  return (
                    <button
                      key={o}
                      onClick={() => handleAddOutcome(o)}
                      className={`h-[72px] sm:h-16 px-3 border rounded-xl flex flex-col justify-center items-center text-center transition-all duration-200 active:scale-95 cursor-pointer bg-slate-950/60 ${color.border} hover:bg-slate-800 hover:border-slate-600 group relative overflow-hidden`}
                    >
                      <span className="absolute top-1 right-1.5 text-[9px] font-mono text-slate-500">
                        {drySpins !== null ? `-${drySpins}` : '---'}
                      </span>
                      <span className={`text-xs font-black tracking-wide ${color.text}`}>{o.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div data-layout="top-history-panel" className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col max-h-[420px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  {t('spinLog')}
                </h3>
                <span className="text-xs text-slate-500 font-semibold font-mono">{t('logActive')}: {activeCount}/{totalCount}</span>
              </div>
              {history.length === 0 ? (
                <div className="flex-1 py-10 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <History className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">{t('noHistory')}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {[...history].reverse().map((item, reverseIdx) => {
                    const originalIdx = history.length - 1 - reverseIdx;
                    const isActive = originalIdx >= history.length - config.historyWindow;
                    const isEditing = editingId === item.id;
                    const color = OUTCOME_COLORS[item.outcome];
                    return (
                      <div key={item.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-all ${isActive ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-950/20 border-slate-900 opacity-40'}`}>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-xs text-slate-600 font-mono font-semibold">#{originalIdx + 1}</span>
                          {isEditing ? (
                            <select
                              value={editingOutcome}
                              onChange={(e) => setEditingOutcome(e.target.value as Outcome)}
                              className="max-w-[104px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              {ALL_OUTCOMES.map(o => (
                                <option key={o} value={o}>{o.toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`truncate text-xs font-mono font-bold px-2 py-0.5 rounded ${color.bg} ${color.text} border ${color.border}`}>
                              {item.outcome.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="rounded p-1 text-emerald-400 transition-colors hover:bg-emerald-500/10 cursor-pointer"
                                title={t('saveEdit' as any)}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditingOutcome(''); }}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 cursor-pointer"
                                title={t('cancelEdit' as any)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-indigo-400 cursor-pointer"
                                title={t('editRow')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400 cursor-pointer"
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

        <div
          data-layout="mode-performance-bar"
          className="hidden"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {predictionModes.map((mode) => {
              const modeReturn = modeReturns[mode];
              const isPreview = previewMode === mode;
              const isAutoSelected = previewMode === null && config.useAutoModeSwitch && autoSelectedMode === mode;
              const isManualSelected = !config.useAutoModeSwitch && config.predictionMode === mode;
              const isBestMode = modeReturn === bestModeReturn;
              const returnTone = modeReturn > 0
                ? 'text-emerald-400'
                : modeReturn < 0
                  ? 'text-rose-400'
                  : 'text-slate-400';
              const stateLabel = isPreview
                ? 'PREVIEW'
                : isAutoSelected
                  ? 'AUTO'
                  : isManualSelected
                    ? 'ACTIVE'
                    : isBestMode
                      ? 'BEST'
                      : '';

              return (
                <button
                  key={mode}
                  onClick={() => {
                    if (config.useAutoModeSwitch) {
                      setPreviewMode(previewMode === mode ? null : mode);
                    } else {
                      updateConfigState({ ...config, predictionMode: mode });
                    }
                  }}
                  className={`min-h-20 rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer ${isPreview
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
                      : isAutoSelected || isManualSelected
                        ? 'border-indigo-500 bg-indigo-600/15 shadow-[0_0_18px_rgba(99,102,241,0.16)]'
                        : isBestMode
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t('predMode')}
                      </div>
                      <div className="mt-1 truncate text-sm font-black text-white">
                        {getModeLabel(mode)}
                      </div>
                    </div>
                    {stateLabel && (
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${isPreview
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : isAutoSelected || isManualSelected
                            ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        }`}>
                        {stateLabel}
                      </span>
                    )}
                  </div>
                  <div className={`mt-2 font-mono text-2xl font-black ${returnTone}`}>
                    {modeReturn > 0 ? '+' : ''}{modeReturn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          data-layout="record-outcome-panel"
          className="hidden"
        >
          <h3 className="text-lg font-bold text-white mb-2">{t('recordOutcome')}</h3>
          <p className="text-slate-400 text-xs mb-6">
            {t('recordDesc')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
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
                    {drySpins !== null ? `-${drySpins}` : '---'}
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

        {/* Dashboard Grid */}
        <div data-layout="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Column 1 & 2: Predictions & Recording */}
          <div className="lg:col-span-2 space-y-8">
            <div className={`${activeTab === 'predict' ? 'block' : 'hidden'} md:block space-y-8`}>
              {/* Top Highlight Panel (Top Outcome / Confidence) - Hidden in main flow, shown on hover */}
              <div className="hidden">

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
                    {activeModeToShow === 'relative' && prediction.directional ? (
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
                            if (nextItem && activeModeToShow === 'relative') {
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
                      {formatSignalTargets(bettingSignal.targets, bettingSignal.target)}
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
            </div>

            {/* Probability Distribution Cards */}
            <div className={`bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 ${activeTab === 'analyze' ? 'block' : 'hidden'} md:block`}>
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

          </div>

          {/* Column 3: Configuration & History log */}
          <div className="space-y-8">

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              config={config}
              onConfigChange={updateConfigState}
              language={language}
              t={t}
              deckWindowStats={deckWindowStats}
              onSetLanguage={handleSetLanguage}
              onLoadDemo={handleLoadDemo}
              onClearHistory={handleClearHistory}
              historyLength={history.length}
            />

            {/* Backtest Summary Panel */}
            <div className={`bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 ${activeTab === 'analyze' ? 'block' : 'hidden'} md:block`}>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                {t('backtestSummary')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
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
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{language === 'en' ? 'Max Win Streak' : 'Chuỗi thắng max'}</div>
                  <div className="text-xl font-black text-emerald-400">🔥 {backtestSummary.maxConsecutiveWins || 0}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-slate-500">{language === 'en' ? 'Max Loss Streak' : 'Chuỗi thua max'}</div>
                  <div className="text-xl font-black text-rose-400">💀 {backtestSummary.maxConsecutiveLosses || 0}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 col-span-2">
                  <div className="text-slate-500">{t('currentStreak')}</div>
                  <div className={`text-xl font-black ${
                    backtestSummary.currentWinStreak > 0
                      ? 'text-emerald-400'
                      : backtestSummary.currentLossStreak > 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                  }`}>
                    {backtestSummary.currentWinStreak > 0 && `${t('currentWinStreak')} ${backtestSummary.currentWinStreak}`}
                    {backtestSummary.currentLossStreak > 0 && `${t('currentLoseStreak')} ${backtestSummary.currentLossStreak}`}
                    {backtestSummary.currentWinStreak === 0 && backtestSummary.currentLossStreak === 0 && t('noCurrentStreak')}
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
            <div className="hidden">
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

           {/* Hover Preview Panel */}
      <HoverPreviewPanel
        hoveredMode={hoveredMode}
        hoverPrediction={hoverPrediction}
        hoverBettingSignal={hoverBettingSignal}
        hoverActiveModeToShow={hoverActiveModeToShow}
        config={config}
        language={language}
        t={t}
        getModeLabel={getModeLabel}
      />

      {/* Mobile Bottom Sheet (Issue 0006) */}
      <MobileBottomSheet
        isOpen={mobileSheetMode !== null}
        onClose={() => setMobileSheetMode(null)}
        mode={mobileSheetMode}
        prediction={mobileSheetMode ? modePredictions[mobileSheetMode] : null}
        bettingSignal={mobileSheetMode ? modeSignals[mobileSheetMode] : null}
        activeModeToShow={activeModeToShow}
        config={config}
        language={language}
        t={t}
        getModeLabel={getModeLabel}
      />

      {/* Mobile Bottom Tab Bar (Issue 0005) */}
      <MobileTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        t={t}
      />
            </div>
          </div>
        </div>
      </div>
    );
  }
