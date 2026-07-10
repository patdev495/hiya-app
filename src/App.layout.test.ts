import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
const settingsSource = readFileSync(join(process.cwd(), 'src', 'components', 'SettingsModal.tsx'), 'utf8');
const modeCardSource = readFileSync(join(process.cwd(), 'src', 'components', 'ModeCard.tsx'), 'utf8');

describe('App layout', () => {
  it('keeps decision data and entry workflow above analysis and opens settings as a header modal', () => {
    const opsPanelIndex = appSource.indexOf('data-layout="top-ops-panel"');
    const modeGridIndex = appSource.indexOf('data-layout="mode-probability-grid"');
    const recordPanelIndex = appSource.indexOf('data-layout="record-outcome-panel"');
    const historyPanelIndex = appSource.indexOf('data-layout="top-history-panel"');
    const dashboardGridIndex = appSource.indexOf('data-layout="dashboard-grid"');
    const settingsTriggerIndex = appSource.indexOf('data-layout="settings-trigger"');
    const headerEndIndex = appSource.indexOf('</header>');
    const settingsModalIndex = appSource.indexOf('<SettingsModal');

    expect(settingsTriggerIndex).toBeGreaterThan(-1);
    expect(settingsTriggerIndex).toBeLessThan(headerEndIndex);
    expect(settingsModalIndex).toBeGreaterThan(headerEndIndex);
    expect(opsPanelIndex).toBeGreaterThan(-1);
    expect(modeGridIndex).toBeGreaterThan(opsPanelIndex);
    expect(recordPanelIndex).toBeGreaterThan(modeGridIndex);
    expect(historyPanelIndex).toBeGreaterThan(recordPanelIndex);
    expect(dashboardGridIndex).toBeGreaterThan(recordPanelIndex);

    expect(appSource).toContain("const predictionModes: PredictionMode[] = ['absolute', 'relative', 'decay']");
    expect(modeCardSource).toContain('modePrediction.probabilities');
    expect(appSource).toContain('const modeSignal = modeSignals[mode];');
    expect(modeCardSource).toContain('const isRecommendedTarget = modeSignal.targets?.includes(outcome) ?? false;');
    expect(appSource).toContain('setPreviewMode(previewMode === mode ? null : mode)');
    expect(appSource).toContain('const [isSettingsOpen, setIsSettingsOpen] = useState(false)');
    expect(settingsSource).toContain('fixed inset-0 z-50');
    expect(appSource).toContain('data-layout="hot-regime-header"');
    expect(appSource).toContain('{regimeLargeCount}/{regimeWindow}');
    expect(appSource).toContain('hotRegimeWindow');
    expect(appSource).toContain('hotRegimeThreshold');
  });

  it('shows return delta compared with the previous entered turn', () => {
    expect(appSource).toContain('const previousModeReturns = {');
    expect(appSource).toContain('const modeReturnDelta = Math.round((modeReturn - previousModeReturns[mode]) * 100) / 100;');
    expect(modeCardSource).toContain('const deltaTone = modeReturnDelta > 0');
    expect(modeCardSource).toContain("{modeReturnDelta > 0 ? '+' : ''}{modeReturnDelta}");
  });

  it('uses full history for mode current streaks instead of the sliding return window', () => {
    expect(appSource).toContain('const modeStreakBacktests = {');
    expect(appSource).toContain("calculateBacktest(historyOutcomes, { ...config, predictionMode: 'absolute'");
    expect(appSource).toContain('modeStreakBacktest={modeStreakBacktests[mode]}');
    expect(modeCardSource).toContain('modeStreakBacktest.currentWinStreak');
    expect(modeCardSource).toContain('modeStreakBacktest.currentLossStreak');
  });

  it('allows the automatic evaluation window to start at one turn', () => {
    const labelIndex = settingsSource.indexOf("{t('autoModeWindowLabel')}");
    const nextRangeIndex = settingsSource.indexOf('type="range"', labelIndex);
    const rangeSnippet = settingsSource.slice(nextRangeIndex, settingsSource.indexOf('/>', nextRangeIndex));

    expect(rangeSnippet).toContain('min="1"');
    expect(rangeSnippet).toContain('max="50"');
    expect(rangeSnippet).toContain('step="1"');
  });
});
