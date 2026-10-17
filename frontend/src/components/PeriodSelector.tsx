import React from 'react';
import { usePeriod } from '../context/PeriodContext';
import { PeriodMode } from '../utils/period';
import { strings } from '../i18n/strings';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PeriodSelectorProps {
  className?: string;
  compact?: boolean;
}

const MODES: { key: PeriodMode; label: string }[] = [
  { key: 'cycle', label: strings.period.cycle },
  { key: 'daily', label: strings.period.daily },
  { key: 'weekly', label: strings.period.weekly },
  { key: 'biweekly', label: strings.period.thisBiweek },
  { key: 'monthly', label: strings.period.monthly },
  { key: 'yearly', label: strings.period.yearly },
  { key: 'custom', label: strings.period.custom },
  { key: 'all_time', label: strings.period.allTime },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ className = '', compact = false }) => {
  const {
    mode,
    period,
    customFrom,
    customTo,
    setMode,
    stepPrev,
    stepNext,
    resetOffset,
    setCustomRange,
  } = usePeriod();

  return (
    <div className={`card-base p-3 md:p-4 bg-surface border border-border space-y-3 ${className}`}>
      {/* ── Top Preset Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {MODES.map(item => {
          const isActive = mode === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setMode(item.key)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all btn-tap ${
                isActive
                  ? 'bg-accent text-white font-bold shadow-none'
                  : 'bg-bg text-text-muted hover:text-text-main border border-border font-semibold'
              }`}
            >
              {item.label}
              {item.key === 'cycle' && period.daysRemaining !== undefined && mode === 'cycle' && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
                  {period.daysRemaining}d
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Period Navigator / Info Row ── */}
      <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2 min-h-[36px]">
        {/* Steppable periods (daily, weekly, biweekly, monthly, yearly) */}
        {period.canStep && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <button
                onClick={stepPrev}
                title="Previous period"
                className="p-1.5 rounded-lg border border-border bg-bg text-text-muted hover:text-text-main transition-colors btn-tap"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={stepNext}
                title="Next period"
                className="p-1.5 rounded-lg border border-border bg-bg text-text-muted hover:text-text-main transition-colors btn-tap"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {!period.isCurrent && (
                <button
                  onClick={resetOffset}
                  title="Jump to current"
                  className="flex items-center gap-1 text-[11px] font-bold text-accent bg-accent-soft border border-accent/20 px-2 py-1 rounded-lg hover:bg-accent/15 transition-colors btn-tap"
                >
                  <RotateCcw className="w-3 h-3" />
                  {strings.period.resetCurrent}
                </button>
              )}
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-text-main truncate max-w-[240px] md:max-w-none">
                {period.label}
              </p>
              {period.subLabel && !compact && (
                <p className="text-[10px] text-text-muted truncate">
                  {period.subLabel}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Allowance Cycle */}
        {mode === 'cycle' && (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-main">
                  {period.label}
                </p>
                {period.subLabel && !compact && (
                  <p className="text-[10px] text-text-muted">{period.subLabel}</p>
                )}
              </div>
            </div>

            <div>
              {period.badge ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-accent-soft text-accent border border-accent/20">
                  {period.badge}
                </span>
              ) : !period.hasCycleConfigured ? (
                <Link
                  to="/settings"
                  className="text-xs font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
                >
                  {strings.period.cycleConfigureHint} &rarr;
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {/* Custom Range Selector */}
        {mode === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 w-full justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-text-muted">{strings.period.from}:</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomRange(e.target.value, undefined)}
                  className="px-2.5 py-1 rounded-lg border border-border bg-bg text-text-main text-xs font-semibold focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-bold text-text-muted">{strings.period.to}:</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomRange(undefined, e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-border bg-bg text-text-main text-xs font-semibold focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            {period.subLabel && (
              <p className="text-[11px] font-bold text-accent">{period.label}</p>
            )}
          </div>
        )}

        {/* All Time */}
        {mode === 'all_time' && (
          <div className="flex items-center justify-between w-full">
            <p className="text-xs font-bold text-text-main">{strings.period.allTime}</p>
            <p className="text-[11px] text-text-muted">{period.subLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
};
