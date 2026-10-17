import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CoinBuddy } from './CoinBuddy';
import { fetchApi } from '../api/client';

interface StashSheetProps {
  onClose: () => void;
  initialMode?: 'stash' | 'withdraw';
}

export const StashSheet: React.FC<StashSheetProps> = ({ onClose, initialMode = 'stash' }) => {
  const { settings, fetchSettings } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'stash' | 'withdraw'>(initialMode);
  const [amountStr, setAmountStr] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const curr = settings?.home_currency === 'NGN' ? '₦' : (settings?.home_currency || '₦');
  const vaultBalanceMajor = (settings?.vault_balance || 0) / 100;
  const vaultGoalMajor = (settings?.vault_goal || 0) / 100;
  const hasGoal = vaultGoalMajor > 0;
  const pct = hasGoal ? Math.min(Math.round((vaultBalanceMajor / vaultGoalMajor) * 100), 100) : 0;

  const mutation = useMutation({
    mutationFn: async ({ amountMinor, targetMode }: { amountMinor: number; targetMode: 'stash' | 'withdraw' }) => {
      const endpoint = targetMode === 'stash' ? '/api/vault/stash' : '/api/vault/withdraw';
      return fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountMinor,
          currency: settings?.home_currency || 'NGN'
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      fetchSettings();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to update Piggybank. Please try again.');
    }
  });

  const handlePadPress = (val: string) => {
    setErrorMessage('');
    if (val === 'del') {
      setAmountStr(prev => prev.slice(0, -1));
    } else {
      if (amountStr.length < 7) {
        setAmountStr(prev => prev === '0' ? val : prev + val);
      }
    }
  };

  const handleMaxPress = () => {
    if (mode === 'withdraw' && vaultBalanceMajor > 0) {
      setErrorMessage('');
      setAmountStr(String(vaultBalanceMajor));
    }
  };

  const handleSave = () => {
    setErrorMessage('');
    if (!amountStr) return;
    const amountFloat = parseFloat(amountStr);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    if (mode === 'withdraw' && amountFloat > vaultBalanceMajor) {
      setErrorMessage(`Cannot withdraw more than your Piggybank balance (${curr}${new Intl.NumberFormat('en-US').format(vaultBalanceMajor)}).`);
      return;
    }

    const minorAmount = Math.round(amountFloat * 100);
    mutation.mutate({ amountMinor: minorAmount, targetMode: mode });
  };

  const amountFloat = parseFloat(amountStr || '0');
  const isOverWithdraw = mode === 'withdraw' && amountFloat > vaultBalanceMajor;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-md rounded-t-3xl md:rounded-3xl border-t md:border border-border p-5 pb-8 animate-in slide-in-from-bottom-full md:slide-in-from-bottom-8 duration-300">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-text-main">
              {mode === 'stash' ? 'Stash in Piggybank' : 'Withdraw from Piggybank'}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Available balance: {curr}{new Intl.NumberFormat('en-US').format(vaultBalanceMajor)}
              {hasGoal && mode === 'stash' && ` · ${pct}% of ${curr}${new Intl.NumberFormat('en-US').format(vaultGoalMajor)} goal`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main bg-bg rounded-full btn-tap">
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="flex bg-bg rounded-xl p-1 border border-border mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('stash');
              setAmountStr('');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${
              mode === 'stash'
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Stash Away</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('withdraw');
              setAmountStr('');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${
              mode === 'withdraw'
                ? 'bg-accent text-white'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Withdraw / Unstash</span>
          </button>
        </div>

        {/* Goal progress bar (if stash mode and goal set) */}
        {hasGoal && mode === 'stash' && (
          <div className="mb-4 w-full h-1.5 bg-bg rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {(errorMessage || isOverWithdraw) && (
          <div className="mb-3 p-2.5 rounded-xl bg-red/10 border border-red/20 text-red text-xs font-bold text-center">
            {errorMessage || `Amount exceeds available balance (${curr}${new Intl.NumberFormat('en-US').format(vaultBalanceMajor)})`}
          </div>
        )}

        {/* Display Amount */}
        <div className="text-center mb-4 relative">
          <div className="absolute right-0 top-0 hidden md:block">
            <CoinBuddy mood={mode === 'stash' ? 'happy' : 'worried'} size={50} />
          </div>
          <span className="text-xl font-bold text-text-muted mr-1 align-top mt-2 inline-block">
            {curr}
          </span>
          <span className={`text-6xl font-heading font-bold tracking-tight font-tabular ${isOverWithdraw ? 'text-red' : 'text-accent'}`}>
            {amountStr || '0'}
          </span>

          <p className="text-xs font-bold text-text-muted mt-2">
            {mode === 'stash'
              ? 'Will be locked away in your Piggybank'
              : 'Will be returned to your active spending balance'}
          </p>

          {mode === 'withdraw' && vaultBalanceMajor > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleMaxPress}
                className="px-3 py-1 bg-bg border border-border rounded-lg text-xs font-bold text-accent hover:bg-border transition-colors btn-tap"
              >
                Max ({curr}{new Intl.NumberFormat('en-US').format(vaultBalanceMajor)})
              </button>
            </div>
          )}

          <div className="mt-3 p-2.5 bg-bg rounded-lg border border-border inline-block max-w-[280px]">
            <p className="text-[10px] text-text-muted leading-snug">
              <strong>Note:</strong> VTrack tracks numbers only. Remember to transfer the matching funds in your bank app.
            </p>
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((key) => (
            <button
              key={key}
              onClick={() => handlePadPress(key)}
              className="p-3.5 rounded-2xl bg-bg border border-border text-lg font-bold font-tabular text-text-main hover:bg-border transition-colors btn-tap active:scale-95"
            >
              {key === 'del' ? '⌫' : key}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!amountStr || isOverWithdraw || mutation.isPending}
          className="w-full py-3.5 rounded-2xl bg-accent text-white font-bold text-base hover:bg-accent-hover transition-colors disabled:opacity-50 btn-tap shadow-none"
        >
          {mutation.isPending
            ? (mode === 'stash' ? 'Stashing...' : 'Withdrawing...')
            : (mode === 'stash' ? 'Stash in Piggybank' : 'Withdraw to Spending')}
        </button>
      </div>
    </div>
  );
};
