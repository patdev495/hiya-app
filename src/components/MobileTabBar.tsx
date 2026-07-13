import { BarChart3, PlusCircle } from 'lucide-react';

export type MobileTab = 'record' | 'analyze';

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  t: (key: any) => string;
}

export default function MobileTabBar({ activeTab, onTabChange, t }: MobileTabBarProps) {
  return (
    <div
      data-layout="mobile-tab-bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-slate-900 px-6 pt-2"
      style={{
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex justify-around items-center max-w-md mx-auto">
        <button
          onClick={() => onTabChange('record')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'record'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider">{t('tabRecord')}</span>
        </button>

        <button
          onClick={() => onTabChange('analyze')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'analyze'
              ? 'text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-wider">{t('tabAnalyze')}</span>
        </button>
      </div>
    </div>
  );
}
