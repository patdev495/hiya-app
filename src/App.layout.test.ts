import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

describe('App layout', () => {
  it('keeps decision data and entry workflow above analysis and opens settings as a header modal', () => {
    const opsPanelIndex = appSource.indexOf('data-layout="top-ops-panel"');
    const modeGridIndex = appSource.indexOf('data-layout="mode-probability-grid"');
    const recordPanelIndex = appSource.indexOf('data-layout="record-outcome-panel"');
    const historyPanelIndex = appSource.indexOf('data-layout="top-history-panel"');
    const dashboardGridIndex = appSource.indexOf('data-layout="dashboard-grid"');
    const settingsTriggerIndex = appSource.indexOf('data-layout="settings-trigger"');
    const headerEndIndex = appSource.indexOf('</header>');
    const settingsModalIndex = appSource.indexOf('data-layout="settings-modal"');

    expect(settingsTriggerIndex).toBeGreaterThan(-1);
    expect(settingsTriggerIndex).toBeLessThan(headerEndIndex);
    expect(settingsModalIndex).toBeGreaterThan(headerEndIndex);
    expect(opsPanelIndex).toBeGreaterThan(-1);
    expect(modeGridIndex).toBeGreaterThan(opsPanelIndex);
    expect(recordPanelIndex).toBeGreaterThan(modeGridIndex);
    expect(historyPanelIndex).toBeGreaterThan(recordPanelIndex);
    expect(dashboardGridIndex).toBeGreaterThan(recordPanelIndex);

    const opsSnippet = appSource.slice(opsPanelIndex, dashboardGridIndex);
    expect(appSource).toContain("const predictionModes: PredictionMode[] = ['absolute', 'relative', 'decay']");
    expect(opsSnippet).toContain('modePrediction.probabilities');
    expect(opsSnippet).toContain('const modeSignal = modeSignals[mode];');
    expect(opsSnippet).toContain('const isRecommendedTarget = modeSignal.targets?.includes(outcome) ?? false;');
    expect(opsSnippet).toContain('setPreviewMode(previewMode === mode ? null : mode)');
    expect(appSource).toContain('const [isSettingsOpen, setIsSettingsOpen] = useState(false)');
    expect(appSource).toContain('fixed inset-0 z-50');
    expect(appSource).toContain('data-layout="hot-regime-header"');
    expect(appSource).toContain('{regimeLargeCount}/{regimeWindow}');
    expect(appSource).toContain('hotRegimeWindow');
    expect(appSource).toContain('hotRegimeThreshold');
  });

  it('shows return delta compared with the previous entered turn', () => {
    expect(appSource).toContain('const previousModeReturns = {');
    expect(appSource).toContain('const modeReturnDelta = Math.round((modeReturn - previousModeReturns[mode]) * 100) / 100;');
    expect(appSource).toContain('const deltaTone = modeReturnDelta > 0');
    expect(appSource).toContain('{modeReturnDelta > 0 ? \'+\' : \'\'}{modeReturnDelta}');
  });

  it('allows the automatic evaluation window to start at one turn', () => {
    const labelIndex = appSource.indexOf("{t('autoModeWindowLabel')}");
    const nextRangeIndex = appSource.indexOf('type="range"', labelIndex);
    const rangeSnippet = appSource.slice(nextRangeIndex, appSource.indexOf('/>', nextRangeIndex));

    expect(rangeSnippet).toContain('min="1"');
    expect(rangeSnippet).toContain('max="50"');
    expect(rangeSnippet).toContain('step="1"');
  });
});
