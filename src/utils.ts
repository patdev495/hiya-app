import { translations } from './locales';
import type { Language } from './locales';

export const getDisplacementLabel = (shift: number, lang: Language): string => {
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

export const getSignalTone = (action: string): string => {
  if (action === 'skip') return 'bg-slate-800 text-slate-300 border-slate-700';
  if (action === 'normal') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (action === 'probe') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
};

export const formatSignalTarget = (target: string | null): string => {
  return target ? target.replace('_', ' ').toUpperCase() : 'SKIP';
};

export const formatSignalTargets = (targets: string[] | undefined, fallback: string | null): string => {
  const activeTargets = targets && targets.length > 0 ? targets : (fallback ? [fallback] : []);
  return activeTargets.length > 0
    ? activeTargets.map((target) => formatSignalTarget(target)).join(' + ')
    : 'SKIP';
};

export const translateReason = (reason: string, lang: Language): string => {
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
