import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Check,
  Calendar as CalendarIcon,
  FileText,
  Utensils,
  Bus,
  Book,
  HeartPulse,
  Home,
  Wifi,
  Coffee,
  PartyPopper,
  Shirt,
  Laptop,
  Receipt,
  Store,
  ShoppingBag,
  Delete,
  Edit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchApi, Transaction, MenuItem } from '../api/client';
import { EditTransactionSheet } from '../components/EditTransactionSheet';
import { StatementReceiptScannerModal } from '../components/StatementReceiptScannerModal';

function getCategoryIcon(name?: string | null) {
  const n = (name || '').toLowerCase();
  if (n.includes('food court') || n.includes('cafeteria')) return <Store className="w-5 h-5" />;
  if (n.includes('outside dining') || n.includes('dining')) return <Coffee className="w-5 h-5" />;
  if (n.includes('provision') || n.includes('snack')) return <ShoppingBag className="w-5 h-5" />;
  if (n.includes('food') || n.includes('grocer') || n.includes('burger')) return <Utensils className="w-5 h-5" />;
  if (n.includes('transport') || n.includes('bus') || n.includes('commute')) return <Bus className="w-5 h-5" />;
  if (n.includes('academic') || n.includes('book')) return <Book className="w-5 h-5" />;
  if (n.includes('health') || n.includes('toilet')) return <HeartPulse className="w-5 h-5" />;
  if (n.includes('rent') || n.includes('utilit') || n.includes('home')) return <Home className="w-5 h-5" />;
  if (n.includes('data') || n.includes('airtime') || n.includes('wifi')) return <Wifi className="w-5 h-5" />;
  if (n.includes('snack') || n.includes('coffee') || n.includes('drink')) return <Coffee className="w-5 h-5" />;
  if (n.includes('outing') || n.includes('hangout') || n.includes('party')) return <PartyPopper className="w-5 h-5" />;
  if (n.includes('cloth') || n.includes('fashion') || n.includes('wear')) return <Shirt className="w-5 h-5" />;
  if (n.includes('tech') || n.includes('laptop')) return <Laptop className="w-5 h-5" />;
  return <Receipt className="w-5 h-5" />;
}

export const NewTransaction: React.FC = () => {
  const { settings } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [txCurrency, setTxCurrency] = useState(settings?.home_currency || 'NGN');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPickingDate, setIsPickingDate] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchApi<{ categories: any[] }>('/api/categories'),
  });

  // Recent transactions list for desktop review
  const { data: recentData } = useQuery({
    queryKey: ['transactions', { limit: 4 }],
    queryFn: () => fetchApi<{ transactions: Transaction[] }>('/api/transactions?limit=4'),
  });

  // Saved menu dishes for quick 1-tap fill
  const { data: menuData } = useQuery({
    queryKey: ['menus', 'items'],
    queryFn: () => fetchApi<{ items: MenuItem[] }>('/api/menus/items'),
  });

  const menuItems = (menuData?.items || []).filter(i => !i.is_provisions && i.price > 0);

  const mutation = useMutation({
    mutationFn: async (tx: any) =>
      fetchApi('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(tx),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAmountStr('');
      setNote('');
      setIsEditingNote(false);
      navigate(-1);
    },
  });

  const categories = categoriesData?.categories || [];
  const recentTransactions = recentData?.transactions || [];
  const curr = settings?.home_currency === 'NGN' ? '₦' : (settings?.home_currency || '₦');

  // Select first category by default
  useEffect(() => {
    if (categories.length > 0 && selectedCategoryId === null && type === 'expense') {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, type]);

  // Keypad click handler
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setAmountStr('');
      return;
    }
    if (val === 'backspace') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (val === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => (prev === '' ? '0.' : prev + '.'));
      return;
    }

    if (amountStr.includes('.')) {
      const parts = amountStr.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (!amountStr.includes('.') && amountStr.length >= 8) return;

    if (amountStr === '0' && val !== '.') {
      setAmountStr(val);
    } else {
      setAmountStr(prev => prev + val);
    }
  };

  // Keyboard typing listener on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingNote || isPickingDate) return;

      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('backspace');
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleKeypadPress('C');
      } else if (e.key === 'Enter') {
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [amountStr, isEditingNote, isPickingDate, selectedCategoryId, note, date, type]);

  const handleSave = () => {
    if (!amountStr) return;
    const amountFloat = parseFloat(amountStr);
    if (isNaN(amountFloat) || amountFloat <= 0) return;

    const minorAmount = Math.round(amountFloat * 100);

    let occurredAtIso: string;
    const todayStr = new Date().toISOString().split('T')[0];
    if (date === todayStr) {
      occurredAtIso = new Date().toISOString();
    } else {
      const now = new Date();
      const [y, m, d] = date.split('-').map(Number);
      const chosen = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      occurredAtIso = chosen.toISOString();
    }

    mutation.mutate({
      type,
      amount: minorAmount,
      currency: txCurrency,
      category_id: type === 'expense' ? selectedCategoryId : null,
      note: note.trim() || null,
      occurred_at: occurredAtIso,
    });
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const txSymbol = txCurrency === 'NGN' ? '₦' : txCurrency === 'USD' ? '$' : txCurrency === 'GBP' ? '£' : txCurrency === 'EUR' ? '€' : txCurrency === 'CAD' ? 'CA$' : txCurrency;
  const isForeignCurrency = txCurrency !== (settings?.home_currency || 'NGN');

  const getDateLabel = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (date === todayStr) return 'Today';
    if (date === yesterdayStr) return 'Yesterday';
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-start py-0 md:py-8 px-0 md:px-6 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-surface border-0 md:border md:border-border md:rounded-3xl flex flex-col min-h-screen md:min-h-0 overflow-hidden">

        {/* ── Top Header ── */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-border bg-surface sticky top-0 z-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 p-2 -ml-2 text-text-muted hover:text-text-main bg-bg rounded-full border border-border btn-tap"
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Type Toggle Pills */}
          <div className="flex bg-bg p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => { setType('expense'); }}
              className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-colors btn-tap ${
                type === 'expense'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => { setType('income'); setSelectedCategoryId(null); }}
              className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-colors btn-tap ${
                type === 'income'
                  ? 'bg-green text-white'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Income
            </button>
          </div>

          <div className="w-8" />
        </div>

        {/* ── Responsive Body (2-Column on Desktop / Tablet, Clean Stack on Mobile) ── */}
        <div className="p-4 sm:p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1">

          {/* ════ LEFT COLUMN: Hero Card & Category Selector ════ */}
          <div className="md:col-span-7 space-y-5">

            {/* Display Hero Card */}
            <div className="card-base p-6 bg-surface border border-border space-y-4 text-center">

              <div className="py-2">
                <div className="flex justify-center items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    {type === 'expense' ? 'Expense Amount' : 'Income Amount'}
                  </span>
                  <select
                    value={txCurrency}
                    onChange={(e) => setTxCurrency(e.target.value)}
                    className="bg-bg border border-border text-[11px] font-bold text-text-main rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:border-accent transition-colors"
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
                <div className="flex justify-center items-baseline gap-1.5">
                  <span className="text-3xl font-heading font-black text-text-muted font-tabular">
                    {txSymbol}
                  </span>
                  <span className="text-5xl sm:text-6xl font-heading font-black tracking-tight font-tabular text-text-main">
                    {amountStr || '0'}
                  </span>
                </div>
                {isForeignCurrency && (
                  <p className="text-[11px] font-semibold text-accent mt-1.5">
                    Will be converted to your home currency ({curr}) automatically
                  </p>
                )}
              </div>

              {/* Selected Category Pill */}
              {type === 'expense' && selectedCategory && (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-soft border border-accent/20 text-accent font-bold text-xs">
                    {getCategoryIcon(selectedCategory.name)}
                    <span>{selectedCategory.name}</span>
                  </div>
                </div>
              )}

              {/* Sub-Pills: [ Today ] [ Add note ] */}
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">

                {/* Date Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPickingDate(v => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface border border-border text-xs font-bold text-text-main hover:border-accent transition-colors btn-tap"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 text-accent" />
                    <span>{getDateLabel()}</span>
                  </button>
                  {isPickingDate && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-surface border border-border p-3 rounded-2xl z-20 animate-in fade-in">
                      <input
                        type="date"
                        value={date}
                        onChange={e => {
                          setDate(e.target.value);
                          setIsPickingDate(false);
                        }}
                        className="bg-bg border border-border rounded-xl px-2 py-1 text-xs font-bold text-text-main"
                      />
                    </div>
                  )}
                </div>

                {/* Note Pill */}
                <button
                  type="button"
                  onClick={() => setIsEditingNote(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-colors btn-tap ${
                    note
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-surface border-border text-text-muted hover:text-text-main'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="max-w-[140px] truncate">{note || 'Add a note'}</span>
                </button>

                {/* Scan Receipt / Statement Pill */}
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-accent/40 bg-accent-soft/30 hover:bg-accent-soft text-accent text-xs font-bold transition-colors btn-tap"
                  title="Scan bank alert, statement, or store receipt"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Scan Receipt / Alert</span>
                </button>

              </div>

              {/* Quick Food Shortcuts from Saved Menus */}
              {type === 'expense' && menuItems.length > 0 && (
                <div className="pt-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none justify-start sm:justify-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider shrink-0 mr-0.5 flex items-center gap-1">
                      <Utensils className="w-3 h-3 text-accent" /> Quick:
                    </span>
                    {menuItems.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setAmountStr((item.price / 100).toString());
                          setNote(`${item.name} from ${item.vendor_name || 'Food Spot'}`);
                          if (item.category_id) {
                            setSelectedCategoryId(item.category_id);
                          }
                          setIsEditingNote(false);
                        }}
                        className="px-2.5 py-1 rounded-full bg-surface border border-border text-[11px] font-bold text-text-main hover:border-accent hover:text-accent whitespace-nowrap transition-colors btn-tap shrink-0"
                        title={`Fill ${item.name} from ${item.vendor_name}`}
                      >
                        <span>{item.name}</span>
                        {item.vendor_name && (
                          <span className="text-[10px] text-text-muted font-normal ml-1">
                            ({item.vendor_name})
                          </span>
                        )}
                        <span className="text-accent font-tabular font-bold ml-1.5">
                          ₦{(item.price / 100).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline Note Input if opened */}
              {isEditingNote && (
                <div className="pt-2 animate-in fade-in">
                  <div className="relative max-w-sm mx-auto">
                    <input
                      type="text"
                      value={note}
                      autoFocus
                      onChange={e => setNote(e.target.value)}
                      placeholder={type === 'expense' ? "e.g. Burger with friends, Uber, Groceries..." : "e.g. Monthly allowance, freelance..."}
                      className="w-full bg-surface border border-accent rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingNote(false)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Category Selector Grid */}
            {type === 'expense' && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted px-1">
                  Choose Category
                </p>
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2.5 pt-1">
                  {categories.map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="flex flex-col items-center gap-1 btn-tap group"
                      >
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-accent text-white scale-105 border-2 border-accent'
                              : 'bg-bg text-text-muted border border-border group-hover:border-accent/40 group-hover:text-text-main'
                          }`}
                        >
                          {getCategoryIcon(cat.name)}
                        </div>
                        <span className={`text-[10px] font-bold max-w-[62px] truncate text-center ${
                          isSelected ? 'text-accent' : 'text-text-muted'
                        }`}>
                          {cat.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ════ RIGHT COLUMN: Tactile Keypad & Recent Entries ════ */}
          <div className="md:col-span-5 space-y-5">

            {/* Tactile Keypad */}
            <div className="card-base p-5 bg-surface border border-border space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-12 sm:h-14 bg-surface hover:bg-surface-hover border border-border rounded-2xl text-xl sm:text-2xl font-heading font-black text-text-main btn-tap flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleKeypadPress('C')}
                  className="h-12 sm:h-14 bg-bg hover:bg-surface border border-border rounded-2xl text-base font-bold text-text-muted btn-tap flex items-center justify-center"
                  title="Clear"
                >
                  C
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 sm:h-14 bg-surface hover:bg-surface-hover border border-border rounded-2xl text-xl sm:text-2xl font-heading font-black text-text-main btn-tap flex items-center justify-center"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('.')}
                  className="h-12 sm:h-14 bg-surface hover:bg-surface-hover border border-border rounded-2xl text-xl sm:text-2xl font-heading font-black text-text-main btn-tap flex items-center justify-center"
                >
                  .
                </button>
              </div>

              {/* Backspace & Submit Row */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  className="h-12 bg-bg hover:bg-surface border border-border rounded-2xl text-text-muted hover:text-text-main btn-tap flex items-center justify-center"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!amountStr || parseFloat(amountStr) <= 0 || mutation.isPending}
                  className={`col-span-3 h-12 rounded-2xl font-bold text-sm btn-tap flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${
                    type === 'expense'
                      ? 'bg-accent text-white hover:bg-accent-hover'
                      : 'bg-green text-white hover:bg-green-soft hover:text-green'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{mutation.isPending ? 'Saving...' : type === 'expense' ? 'Save Expense' : 'Save Income'}</span>
                </button>
              </div>

              <p className="text-[10px] text-text-muted text-center hidden md:block pt-1">
                Tip: You can also use your computer keyboard numbers and Enter key.
              </p>
            </div>

            {/* Desktop Live Recent Entries with Edit/Delete */}
            <div className="hidden md:block card-base p-4 bg-surface border border-border space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Recently Logged
                </p>
                <span className="text-[10px] text-text-muted">Tap to edit</span>
              </div>

              {recentTransactions.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">No entries yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentTransactions.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setEditingTx(t)}
                      className="py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-bg/60 px-2 rounded-xl transition-colors btn-tap group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-text-main truncate max-w-[120px]">
                          {t.note || t.category_name || 'Entry'}
                        </span>
                        <span className="text-[10px] text-text-muted truncate">
                          {t.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-bold font-tabular ${t.type === 'expense' ? 'text-text-main' : 'text-green'}`}>
                          {t.type === 'expense' ? '-' : '+'}
                          {curr}{new Intl.NumberFormat('en-US').format(t.amount / 100)}
                        </span>
                        <Edit2 className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <EditTransactionSheet
          transaction={editingTx}
          isOpen={Boolean(editingTx)}
          onClose={() => setEditingTx(null)}
        />
      )}

      {/* Statement & Receipt Scanner Modal */}
      <StatementReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onImportComplete={() => navigate(-1)}
      />
    </div>
  );
};
