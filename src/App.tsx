import { useState, useEffect } from 'react';
import { calculatePrediction, ALL_OUTCOMES, MULTIPLIERS } from './predictionEngine';
import type { Outcome, Config, HistoryItem } from './types';
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

const getDisplacementLabel = (shift: number): string => {
  if (shift === 0) return 'Stay';
  if (shift === 1) return '+1 (Fwd 1)';
  if (shift === 2) return '+2 (Fwd 2)';
  if (shift === 3) return '+3 (Fwd 3)';
  if (shift === 4) return '±4 (Half)';
  if (shift === 5) return '-3 (Bwd 3)';
  if (shift === 6) return '-2 (Bwd 2)';
  if (shift === 7) return '-1 (Bwd 1)';
  return '';
};

const DEFAULT_CONFIG: Config = {
  historyWindow: 100,
  maxOrder: 2,
  priorStrength: 20,
  minSupport: 5,
  predictionMode: 'absolute',
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
    if (window.confirm('Are you sure you want to clear all spin history?')) {
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
  const prediction = calculatePrediction(historyOutcomes, config);

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
              <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Live Prediction System</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">Wheel Outcome Predictor</h1>
            <p className="text-slate-400 text-sm mt-1">
              Event-driven blended Markov model with Bayesian smoothing
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Load Demo Data
            </button>
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset App
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Predictions & Recording */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Top Highlight Panel (Top Outcome / Confidence) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Top Outcome Highlight */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl" />
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Prediction Lead
                    </span>
                    <span className="text-xs text-slate-500">Event-driven</span>
                  </div>
                  {config.predictionMode === 'relative' && prediction.directional ? (
                    <>
                      <h2 className="text-4xl font-black text-white mt-4 tracking-tight">
                        {prediction.directional.direction === 'forward' && (
                          <span className="text-emerald-400">TIẾN</span>
                        )}
                        {prediction.directional.direction === 'backward' && (
                          <span className="text-rose-400">LÙI</span>
                        )}
                        {prediction.directional.direction === 'stay' && (
                          <span className="text-slate-400">ĐỨNG IM</span>
                        )}
                        {prediction.directional.direction === 'half' && (
                          <span className="text-indigo-400">NỬA VÒNG</span>
                        )}
                      </h2>
                      <p className="text-sm font-semibold text-slate-300 mt-2">
                        {prediction.directional.minSteps > 0 ? (
                          <>Dịch chuyển: Tối thiểu {prediction.directional.minSteps} ô</>
                        ) : (
                          <>Dịch chuyển: Không di chuyển</>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Mục tiêu dự kiến: <strong className={OUTCOME_COLORS[prediction.topOutcome].text}>{prediction.topOutcome.toUpperCase().replace('_', ' ')}</strong>
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
                        Highest Current Probability: {prediction.probabilities[prediction.topOutcome]}%
                      </p>
                    </>
                  )}
                </div>
                
                <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 border-t border-slate-800/50 pt-3">
                  <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <span>
                    Highest current probability only. Not a guaranteed outcome. Each spin remains independent.
                  </span>
                </div>
              </div>

              {/* Confidence Indicator Card */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      Evidence Support
                    </span>
                    <span className="text-xs text-slate-500">min_support = {config.minSupport}</span>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-3">
                    {prediction.confidence === 'high' ? (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Flame className="w-4 h-4 mr-1.5 animate-pulse text-emerald-400" />
                        High Confidence
                      </span>
                    ) : prediction.confidence === 'medium' ? (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Medium Confidence
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Low Confidence
                      </span>
                    )}
                  </div>

                  {/* Active Context Readout */}
                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-slate-400">
                      Active Markov context ({prediction.evidence.matchedOrder}-order):
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {prediction.evidence.activeContext.length === 0 ? (
                        <span className="text-xs text-slate-600 italic">None (Prior probabilities dominant)</span>
                      ) : (
                        prediction.evidence.activeContext.map((c, i) => {
                          const color = OUTCOME_COLORS[c];
                          const nextItem = prediction.evidence.activeContext[i + 1];
                          let shiftLabel = '';
                          if (nextItem && config.predictionMode === 'relative') {
                            const idx1 = ALL_OUTCOMES.indexOf(c);
                            const idx2 = ALL_OUTCOMES.indexOf(nextItem);
                            const shift = (idx2 - idx1 + 8) % 8;
                            shiftLabel = getDisplacementLabel(shift);
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
                      Context seen <strong className="text-slate-300 font-semibold">{prediction.evidence.contextCount}</strong> times in active history.
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-800/50 pt-3 text-xs text-slate-500">
                  {prediction.confidence === 'low' ? (
                    <span>Prior/Base distribution dominates. Patterns are sparse.</span>
                  ) : prediction.confidence === 'medium' ? (
                    <span>Transition support is backed by lower-order patterns.</span>
                  ) : (
                    <span>Strong support found for sequence-specific transitions.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Probability Distribution Cards */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                Predicted Probability Distribution
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
                            Lead
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
              <h3 className="text-lg font-bold text-white mb-2">Record Wheel Outcome</h3>
              <p className="text-slate-400 text-xs mb-6">
                Click a button after each spin. Physical slots are recorded separately.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {ALL_OUTCOMES.map((o) => {
                  const color = OUTCOME_COLORS[o];
                  return (
                    <button
                      key={o}
                      onClick={() => handleAddOutcome(o)}
                      className={`h-16 px-4 border rounded-xl flex flex-col justify-center items-center text-center transition-all duration-200 active:scale-95 cursor-pointer bg-slate-950/60 ${color.border} hover:bg-slate-800 hover:border-slate-600 group`}
                    >
                      <span className={`text-sm font-black tracking-wide ${color.text} group-hover:scale-105 transition-transform`}>
                        {o.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 font-mono">
                        {OUTCOME_LABELS[o]}
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
                Model Configuration
              </h3>
              
              <div className="space-y-6">
                {/* Prediction Mode Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                    Prediction Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateConfigState({ ...config, predictionMode: 'absolute' })}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.predictionMode === 'absolute' ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                    >
                      Absolute (Slot)
                    </button>
                    <button
                      onClick={() => updateConfigState({ ...config, predictionMode: 'relative' })}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.predictionMode === 'relative' ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                    >
                      Relative (Shift)
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {config.predictionMode === 'absolute' 
                      ? 'Analyzes transition patterns of specific slot occurrences.' 
                      : 'Analyzes step displacements (forward/backward/stay) on the circular wheel.'}
                  </p>
                </div>

                {/* Active History Window Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                    Active History Window
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateConfigState({ ...config, historyWindow: preset })}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${config.historyWindow === preset ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'}`}
                      >
                        {preset} Spins
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Only the most recent outcomes are used to calculate transition patterns.
                  </p>
                </div>

                {/* Prior Strength */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Prior Strength
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
                    <span>5 (weak prior)</span>
                    <span>50 (strong prior)</span>
                  </div>
                </div>

                {/* Markov Order */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Markov Order
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
                    <span>1 (order 1)</span>
                    <span>3 (order 3)</span>
                  </div>
                </div>

                {/* Min Support */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Min Support
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
                    <span>1 (low support)</span>
                    <span>10 (high support)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* History Log Panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 flex flex-col max-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  Spin Log
                </h3>
                <span className="text-xs text-slate-500 font-semibold font-mono">
                  Active: {activeCount}/{totalCount}
                </span>
              </div>

              {history.length === 0 ? (
                <div className="flex-1 py-12 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <History className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">No spin history recorded yet</p>
                  <p className="text-xs text-slate-600 mt-1">Click demo data or record spin above</p>
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
                                title="Edit Row"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Delete Row"
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
