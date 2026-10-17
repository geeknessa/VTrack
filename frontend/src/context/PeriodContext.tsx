import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { PeriodMode, PeriodCalculation, calculatePeriod } from '../utils/period';

interface PeriodContextValue {
  mode: PeriodMode;
  offset: number;
  customFrom: string;
  customTo: string;
  period: PeriodCalculation;
  setMode: (mode: PeriodMode) => void;
  stepPrev: () => void;
  stepNext: () => void;
  resetOffset: () => void;
  setCustomRange: (from?: string, to?: string) => void;
}

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export const PeriodProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useAuth();

  const getSettingsMode = (): PeriodMode => {
    const pt = settings?.period_type;
    if (pt === 'weekly') return 'weekly';
    if (pt === 'biweekly') return 'biweekly';
    if (pt === 'monthly') return 'monthly';
    if (pt === 'daily') return 'daily';
    if (pt === 'yearly') return 'yearly';
    if (pt === 'custom' || pt === 'custom_days') return 'custom';
    if (pt === 'all_time') return 'all_time';
    return 'cycle';
  };

  const [mode, setModeState] = useState<PeriodMode>(() => getSettingsMode());
  const [offset, setOffset] = useState<number>(0);
  const [customFrom, setCustomFrom] = useState<string>(() => settings?.custom_period_from ? String(settings.custom_period_from).split('T')[0] : '');
  const [customTo, setCustomTo] = useState<string>(() => settings?.custom_period_to ? String(settings.custom_period_to).split('T')[0] : '');

  // Keep in sync when settings change
  React.useEffect(() => {
    if (settings?.period_type) {
      setModeState(getSettingsMode());
    }
    if (settings?.custom_period_from) {
      setCustomFrom(String(settings.custom_period_from).split('T')[0]);
    }
    if (settings?.custom_period_to) {
      setCustomTo(String(settings.custom_period_to).split('T')[0]);
    }
  }, [settings?.period_type, settings?.custom_period_from, settings?.custom_period_to]);

  const setMode = (newMode: PeriodMode) => {
    setModeState(newMode);
    setOffset(0);
  };

  const stepPrev = () => {
    setOffset(prev => prev - 1);
  };

  const stepNext = () => {
    setOffset(prev => prev + 1);
  };

  const resetOffset = () => {
    setOffset(0);
  };

  const setCustomRange = (from?: string, to?: string) => {
    if (from !== undefined) setCustomFrom(from);
    if (to !== undefined) setCustomTo(to);
    setOffset(0);
  };

  const period = useMemo(() => {
    return calculatePeriod(mode, offset, {
      period_anchor_date: settings?.period_anchor_date,
      expected_next_income_date: settings?.expected_next_income_date,
      customFrom,
      customTo,
    });
  }, [mode, offset, settings?.period_anchor_date, settings?.expected_next_income_date, customFrom, customTo]);

  return (
    <PeriodContext.Provider
      value={{
        mode,
        offset,
        customFrom,
        customTo,
        period,
        setMode,
        stepPrev,
        stepNext,
        resetOffset,
        setCustomRange,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
};

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) {
    throw new Error('usePeriod must be used within a PeriodProvider');
  }
  return ctx;
}
