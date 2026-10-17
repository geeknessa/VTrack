import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Check } from 'lucide-react';
import { Transaction, fetchApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface EditTransactionSheetProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditTransactionSheet: React.FC<EditTransactionSheetProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const { settings } = useAuth();
  const queryClient = useQueryClient();

  const [amountStr, setAmountStr] = useState('');
  const [txCurrency, setTxCurrency] = useState('NGN');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchApi<{ categories: any[] }>('/api/categories'),
  });

  const categories = categoriesData?.categories || [];

  useEffect(() => {
    if (transaction) {
      setAmountStr(String(transaction.amount / 100));
      setTxCurrency(transaction.currency || settings?.home_currency || 'NGN');
      setSelectedCategoryId(transaction.category_id || null);
      setNote(transaction.note || '');
      setDate(transaction.occurred_at ? transaction.occurred_at.split('T')[0] : '');
      setType(transaction.type);
      setShowConfirmDelete(false);
    }
  }, [transaction, settings]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) return;
      const amountMinor = Math.round(parseFloat(amountStr) * 100);
      let occurredAtVal: string | undefined = undefined;
      if (date) {
        if (transaction.occurred_at && date === transaction.occurred_at.split('T')[0]) {
          occurredAtVal = transaction.occurred_at;
        } else {
          const orig = new Date(transaction.occurred_at || new Date());
          const [y, m, d] = date.split('-').map(Number);
          occurredAtVal = new Date(y, m - 1, d, orig.getHours(), orig.getMinutes(), orig.getSeconds()).toISOString();
        }
      }
      return fetchApi(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          type,
          amount: amountMinor,
          currency: txCurrency,
          category_id: type === 'expense' ? selectedCategoryId : null,
          note: note.trim() || null,
          occurred_at: occurredAtVal,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) return;
      return fetchApi(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      onClose();
    },
  });

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card-base p-6 bg-surface border border-border w-full max-w-lg space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-base font-heading font-black text-text-main">
              Edit Transaction
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Fix an amount, change category, or remove this entry
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main bg-bg rounded-full border border-border btn-tap"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-text-muted">Amount</label>
            <select
              value={txCurrency}
              onChange={(e) => setTxCurrency(e.target.value)}
              className="bg-bg border border-border text-[11px] font-bold text-text-main rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:border-accent"
            >
              <option value="NGN">₦ NGN</option>
              <option value="USD">$ USD</option>
              <option value="GBP">£ GBP</option>
              <option value="EUR">€ EUR</option>
              <option value="CAD">CA$ CAD</option>
              <option value="KES">KSh KES</option>
              <option value="GHS">GH₵ GHS</option>
            </select>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
              {txCurrency === 'NGN' ? '₦' : txCurrency === 'USD' ? '$' : txCurrency === 'GBP' ? '£' : txCurrency === 'EUR' ? '€' : txCurrency === 'CAD' ? 'CA$' : txCurrency}
            </span>
            <input
              type="number"
              step="any"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-lg font-heading font-black text-text-main font-tabular focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Category Picker (if expense) */}
        {type === 'expense' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted block">Category</label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {categories.map(cat => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors btn-tap ${
                      isSelected
                        ? 'bg-accent text-white border-accent'
                        : 'bg-bg text-text-muted border-border hover:border-accent/40'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Note & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted block">Note</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Lunch with friends"
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted block">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2 border-t border-border">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateMutation.mutate()}
              disabled={!amountStr || updateMutation.isPending}
              className="flex-1 py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent-hover transition-colors btn-tap disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>

            {!showConfirmDelete ? (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="px-4 py-2.5 bg-surface border border-red/30 text-red rounded-xl text-xs font-bold hover:bg-red/5 transition-colors btn-tap flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2.5 bg-red text-white rounded-xl text-xs font-bold hover:bg-red/90 transition-colors btn-tap flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete?'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
