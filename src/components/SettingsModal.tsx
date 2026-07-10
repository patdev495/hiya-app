import type { Config } from '../types';
import type { Language } from '../locales';
import { ALL_OUTCOMES } from '../predictionEngine';
import type { DeckWindowStats } from '../types';
import { Sliders, Sparkles, RotateCcw } from 'lucide-react';
import { OUTCOME_COLORS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  onConfigChange: (config: Config) => void;
  language: Language;
  t: (key: any) => string;
  deckWindowStats: DeckWindowStats;
  onSetLanguage: (lang: Language) => void;
  onLoadDemo: () => void;
  onClearHistory: () => void;
  historyLength: number;
}

export default function SettingsModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
  language,
  t,
  deckWindowStats,
  onSetLanguage,
  onLoadDemo,
  onClearHistory,
  historyLength,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      data-layout="settings-modal"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-white">
            <Sliders className="w-4 h-4 text-indigo-400" />
            {t('modelConfig')}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 cursor-pointer hover:border-slate-600 hover:text-white"
          >
            CLOSE
          </button>
        </div>

        {/* Configuration Settings */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            {t('modelConfig')}
          </h3>

          <div className="space-y-6">

            {/* Mobile Actions: Language & Operations (only visible on mobile) */}
            <div className="md:hidden space-y-4 pb-4 border-b border-slate-800/80">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Ngôn ngữ / Language
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSetLanguage('en')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      language === 'en'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ENGLISH
                  </button>
                  <button
                    onClick={() => onSetLanguage('vi')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      language === 'vi'
                        ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TIẾNG VIỆT
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onLoadDemo}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-300 bg-slate-950/60 border border-slate-800 rounded-lg hover:border-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {t('loadDemo')}
                </button>
                <button
                  onClick={onClearHistory}
                  disabled={historyLength === 0}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('resetApp')}
                </button>
              </div>
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
                  onChange={(e) =>
                    onConfigChange({ ...config, decayFactor: parseFloat(e.target.value) })
                  }
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
                onClick={() =>
                  onConfigChange({ ...config, useRegimeAdjuster: !config.useRegimeAdjuster })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useRegimeAdjuster
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useRegimeAdjuster ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('adjusterDesc')}</p>
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
                onClick={() =>
                  onConfigChange({ ...config, useDeckAdjuster: !config.useDeckAdjuster })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useDeckAdjuster
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useDeckAdjuster ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('deckAdjusterDesc')}</p>
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
                  onChange={(e) =>
                    onConfigChange({ ...config, deckSize: parseInt(e.target.value) })
                  }
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
                      const ratioTone =
                        stats.ratioPercent > 100
                          ? 'text-rose-400'
                          : stats.ratioPercent < 100
                            ? 'text-emerald-400'
                            : 'text-slate-400';

                      return (
                        <div
                          key={outcome}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs"
                        >
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
                onClick={() =>
                  onConfigChange({ ...config, useAdaptiveSafety: !config.useAdaptiveSafety })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useAdaptiveSafety
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useAdaptiveSafety ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('adaptiveSafetyDesc')}</p>
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
                onClick={() =>
                  onConfigChange({ ...config, useAutoModeSwitch: !config.useAutoModeSwitch })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useAutoModeSwitch
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useAutoModeSwitch ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('autoModeSwitchDesc')}</p>

              {config.useAutoModeSwitch && (
                <div className="mt-4 border-t border-slate-800/40 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('autoModeWindowLabel')}
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {config.autoModeWindow || 3} {t('autoSpins')}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={config.autoModeWindow || 3}
                    onChange={(e) =>
                      onConfigChange({ ...config, autoModeWindow: parseInt(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Hot Regime */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                Hot Regime
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500 uppercase">Window</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {config.hotRegimeWindow || 15}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={config.hotRegimeWindow || 15}
                    onChange={(e) =>
                      onConfigChange({ ...config, hotRegimeWindow: parseInt(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500 uppercase">Threshold</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {config.hotRegimeThreshold || 4}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={config.hotRegimeThreshold || 4}
                    onChange={(e) =>
                      onConfigChange({ ...config, hotRegimeThreshold: parseInt(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Hot khi số con lớn trong cửa sổ đạt ngưỡng cấu hình.
              </p>
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
                    onClick={() => onConfigChange({ ...config, historyWindow: preset })}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      config.historyWindow === preset
                        ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    {preset} {t('presetSpins')}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2">{t('windowDesc')}</p>
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
                onChange={(e) =>
                  onConfigChange({ ...config, priorStrength: parseInt(e.target.value) })
                }
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
                onChange={(e) =>
                  onConfigChange({ ...config, maxOrder: parseInt(e.target.value) })
                }
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
                onChange={(e) =>
                  onConfigChange({ ...config, minSupport: parseInt(e.target.value) })
                }
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>1 ({t('lowSupport')})</span>
                <span>10 ({t('highSupport')})</span>
              </div>
            </div>

            {/* Bankroll Capital Setting */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {t('bankrollLabel')}
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {(config.bankroll || 1000000).toLocaleString()}
                </span>
              </div>
              <input
                type="number"
                value={config.bankroll || 1000000}
                onChange={(e) =>
                  onConfigChange({
                    ...config,
                    bankroll: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Adaptive RTP Adjuster */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  {t('useRtpAdaptation')}
                </label>
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  RTP Adapt
                </span>
              </div>
              <button
                onClick={() =>
                  onConfigChange({ ...config, useRtpAdaptation: !config.useRtpAdaptation })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useRtpAdaptation
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useRtpAdaptation ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('useRtpAdaptationDesc')}</p>

              {config.useRtpAdaptation && (
                <div className="mt-4 space-y-4 border-t border-slate-800/40 pt-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {t('theoreticalRtpLabel')}
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {config.theoreticalRtp || 96}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="80"
                      max="100"
                      step="1"
                      value={config.theoreticalRtp || 96}
                      onChange={(e) =>
                        onConfigChange({ ...config, theoreticalRtp: parseInt(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {t('rtpWindowLabel')}
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {config.rtpWindow || 100} {t('presetSpins')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="10"
                      value={config.rtpWindow || 100}
                      onChange={(e) =>
                        onConfigChange({ ...config, rtpWindow: parseInt(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {t('rtpSensitivityLabel')}
                      </label>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {config.rtpSensitivity !== undefined ? config.rtpSensitivity : 1.0}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="5.0"
                      step="0.1"
                      value={config.rtpSensitivity !== undefined ? config.rtpSensitivity : 1.0}
                      onChange={(e) =>
                        onConfigChange({
                          ...config,
                          rtpSensitivity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Adaptive Kelly Capital Management */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  {t('useKellyCriterion')}
                </label>
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  Kelly sizing
                </span>
              </div>
              <button
                onClick={() =>
                  onConfigChange({ ...config, useKellyCriterion: !config.useKellyCriterion })
                }
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  config.useKellyCriterion
                    ? 'bg-indigo-600 border-indigo-500 text-white font-black'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                {config.useKellyCriterion ? t('enabledOn') : t('disabledOff')}
              </button>
              <p className="text-[10px] text-slate-500 mt-2">{t('useKellyCriterionDesc')}</p>

              {config.useKellyCriterion && (
                <div className="mt-4 border-t border-slate-800/40 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('kellyMultiplierLabel')}
                    </label>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {config.kellyMultiplier !== undefined ? config.kellyMultiplier : 0.25}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.00"
                    step="0.05"
                    value={config.kellyMultiplier !== undefined ? config.kellyMultiplier : 0.25}
                    onChange={(e) =>
                      onConfigChange({
                        ...config,
                        kellyMultiplier: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0.05 (Low risk)</span>
                    <span>1.00 (Full Kelly)</span>
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
