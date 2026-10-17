import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Filter, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type DurationType = 'monthly' | 'weekly' | 'yearly' | 'cycle' | 'custom' | 'all_time';

export interface SelectedPeriod {
  from?: string; // ISO string
  to?: string;   // ISO string
  label: string;
}

interface ActivityPeriodFilterProps {
  value: SelectedPeriod;
  onChange: (period: SelectedPeriod) => void;
  duration?: DurationType;
  onDurationChange?: (duration: DurationType) => void;
  className?: string;
}

export const ActivityPeriodFilter: React.FC<ActivityPeriodFilterProps> = ({
  value,
  onChange,
  duration: controlledDuration,
  onDurationChange,
  className = '',
}) => {
  const { settings } = useAuth();
  const [internalDuration, setInternalDuration] = useState<DurationType>('monthly');
  const duration = controlledDuration !== undefined ? controlledDuration : internalDuration;

  const updateDuration = (newDur: DurationType) => {
    if (onDurationChange) {
      onDurationChange(newDur);
    }
    setInternalDuration(newDur);
  };

  // Year state for monthly & weekly pagination
  const currentYear = new Date().getFullYear();
  const [activeYear, setActiveYear] = useState<number>(currentYear);

  // Custom date state
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // ── Month Pills Generator ──
  const monthPills = useMemo(() => {
    const list: { id: string; label: string; from: string; to: string }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Generate all 12 months for activeYear descending (Dec down to Jan) or up to current month if current year
    const now = new Date();
    const maxMonth = activeYear === now.getFullYear() ? now.getMonth() : 11;

    for (let m = maxMonth; m >= 0; m--) {
      const fromDate = new Date(activeYear, m, 1, 0, 0, 0, 0);
      const toDate = new Date(activeYear, m + 1, 0, 23, 59, 59, 999);
      list.push({
        id: `${activeYear}-${m}`,
        label: `${monthNames[m]} ${activeYear}`,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      });
    }
    return list;
  }, [activeYear]);

  // ── Week Pills Generator ──
  const weekPills = useMemo(() => {
    const list: { id: string; label: string; isCurrent: boolean; from: string; to: string }[] = [];
    const now = new Date();
    
    // Generate past 12 weeks from today
    for (let i = 0; i < 12; i++) {
      const target = new Date();
      target.setDate(now.getDate() - i * 7);

      const day = target.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(target.getFullYear(), target.getMonth(), target.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

      const monStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const sunStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const label = i === 0 ? `This Week (${monStr} – ${sunStr})` : `${monStr} – ${sunStr}`;

      list.push({
        id: `week-${i}`,
        label,
        isCurrent: i === 0,
        from: monday.toISOString(),
        to: sunday.toISOString(),
      });
    }
    return list;
  }, []);

  // ── Year Pills Generator ──
  const yearPills = useMemo(() => {
    const years = [currentYear, currentYear - 1, currentYear - 2];
    return years.map(y => {
      const fromDate = new Date(y, 0, 1, 0, 0, 0, 0);
      const toDate = new Date(y, 11, 31, 23, 59, 59, 999);
      return {
        id: `year-${y}`,
        label: `${y}`,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      };
    });
  }, [currentYear]);

  // ── Handle duration change from dropdown ──
  const handleDurationChange = (newDur: DurationType) => {
    updateDuration(newDur);

    if (newDur === 'all_time') {
      onChange({ from: undefined, to: undefined, label: 'All Time' });
    } else if (newDur === 'monthly') {
      const first = monthPills[0];
      if (first) onChange({ from: first.from, to: first.to, label: first.label });
    } else if (newDur === 'weekly') {
      const first = weekPills[0];
      if (first) onChange({ from: first.from, to: first.to, label: first.label });
    } else if (newDur === 'yearly') {
      const first = yearPills[0];
      if (first) onChange({ from: first.from, to: first.to, label: first.label });
    } else if (newDur === 'cycle') {
      let fromIso: string | undefined;
      let toIso: string | undefined;
      let label = 'Allowance Cycle';

      if (settings?.period_anchor_date) {
        const [ay, am, ad] = String(settings.period_anchor_date).split('T')[0].split('-').map(Number);
        fromIso = new Date(ay, am - 1, ad, 0, 0, 0, 0).toISOString();
      }
      if (settings?.expected_next_income_date) {
        const [ey, em, ed] = String(settings.expected_next_income_date).split('T')[0].split('-').map(Number);
        toIso = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
      }
      if (fromIso && toIso) {
        const fStr = new Date(fromIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tStr = new Date(toIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        label = `Allowance Cycle (${fStr} – ${tStr})`;
      }
      onChange({ from: fromIso, to: toIso, label });
    }
  };

  // ── Sync duration when value becomes All Time from outside ──
  React.useEffect(() => {
    if (!value.from && !value.to && value.label === 'All Time' && duration !== 'all_time') {
      updateDuration('all_time');
    }
  }, [value.from, value.to, value.label, duration]);

  // ── Custom date apply ──
  const handleApplyCustom = (startStr: string, endStr: string) => {
    if (!startStr && !endStr) return;
    let fromIso: string | undefined;
    let toIso: string | undefined;
    let label = 'Custom Range';

    if (startStr) {
      const [y, m, d] = startStr.split('-').map(Number);
      fromIso = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    }
    if (endStr) {
      const [y, m, d] = endStr.split('-').map(Number);
      toIso = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
    }
    if (startStr && endStr) {
      const s = new Date(startStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = new Date(endStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      label = `${s} – ${e}`;
    }
    onChange({ from: fromIso, to: toIso, label });
  };

  return (
    <div className={`card-base p-3 md:p-4 bg-surface border border-border space-y-3 ${className}`}>
      {/* ── Top Bar: Dropdown + Active Label ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-accent shrink-0" />
          <span className="text-xs font-bold text-text-muted">Filter by:</span>
          <select
            value={duration}
            onChange={(e) => handleDurationChange(e.target.value as DurationType)}
            className="px-3 py-1.5 rounded-xl border border-border bg-bg text-text-main font-bold text-xs focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly</option>
            <option value="cycle">Allowance Cycle</option>
            <option value="custom">Custom Date Range</option>
            <option value="all_time">All Time</option>
          </select>
        </div>

        <div className="text-xs font-bold text-accent bg-accent-soft border border-accent/20 px-3 py-1 rounded-full truncate">
          {value.label}
        </div>
      </div>

      {/* ── Secondary Pills Row ── */}
      {duration === 'monthly' && (
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-text-muted font-bold">Select Month</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveYear(y => y - 1)}
                className="p-1 rounded border border-border bg-bg text-text-muted hover:text-text-main btn-tap"
                title="Previous Year"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-bold text-text-main">{activeYear}</span>
              <button
                onClick={() => setActiveYear(y => Math.min(y + 1, currentYear))}
                disabled={activeYear >= currentYear}
                className="p-1 rounded border border-border bg-bg text-text-muted hover:text-text-main btn-tap disabled:opacity-30"
                title="Next Year"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <select
              value={monthPills.find(p => value.from === p.from && value.to === p.to)?.id || monthPills[0]?.id || ''}
              onChange={(e) => {
                const selected = monthPills.find(p => p.id === e.target.value);
                if (selected) onChange({ from: selected.from, to: selected.to, label: selected.label });
              }}
              className="w-full sm:w-auto appearance-none bg-bg border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer pr-8"
            >
              {monthPills.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {duration === 'weekly' && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs text-text-muted font-bold px-1">Select Week</p>
          <div className="relative">
            <select
              value={weekPills.find(p => value.from === p.from && value.to === p.to)?.id || weekPills[0]?.id || ''}
              onChange={(e) => {
                const selected = weekPills.find(p => p.id === e.target.value);
                if (selected) onChange({ from: selected.from, to: selected.to, label: selected.label });
              }}
              className="w-full sm:w-auto appearance-none bg-bg border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer pr-8"
            >
              {weekPills.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {duration === 'yearly' && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs text-text-muted font-bold px-1">Select Year</p>
          <div className="relative">
            <select
              value={yearPills.find(p => value.from === p.from && value.to === p.to)?.id || yearPills[0]?.id || ''}
              onChange={(e) => {
                const selected = yearPills.find(p => p.id === e.target.value);
                if (selected) onChange({ from: selected.from, to: selected.to, label: selected.label });
              }}
              className="w-full sm:w-auto appearance-none bg-bg border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer pr-8"
            >
              {yearPills.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {duration === 'custom' && (
        <div className="pt-2 border-t border-border flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-text-muted">From:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                handleApplyCustom(e.target.value, customTo);
              }}
              className="px-2.5 py-1 rounded-lg border border-border bg-bg text-text-main text-xs font-semibold focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-text-muted">To:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                handleApplyCustom(customFrom, e.target.value);
              }}
              className="px-2.5 py-1 rounded-lg border border-border bg-bg text-text-main text-xs font-semibold focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {duration === 'cycle' && (
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span>Active cycle calculated from your settings.</span>
          <button
            onClick={() => handleDurationChange('cycle')}
            className="text-xs font-bold text-accent hover:underline btn-tap"
          >
            Refresh cycle
          </button>
        </div>
      )}

      {duration === 'all_time' && (
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span>Viewing all recorded transactions across all time.</span>
        </div>
      )}
    </div>
  );
};
