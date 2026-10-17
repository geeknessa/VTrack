import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  UploadCloud,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Receipt,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { CoinBuddy } from './CoinBuddy';

export interface ScannedTransactionItem {
  id: string;
  selected: boolean;
  date: string;
  description: string;
  amountMinor: number; // in kobo
  type: 'expense' | 'income';
  category_id: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const StatementReceiptScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document Choice: 'receipt' | 'bank_statement'
  const [docType, setDocType] = useState<'receipt' | 'bank_statement'>('receipt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ScannedTransactionItem[]>([]);

  // Fetch user categories for dropdown
  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchApi<{ categories: any[] }>('/api/categories'),
    enabled: isOpen,
  });

  const categories = catData?.categories || [];

  // Batch import mutation
  const importMutation = useMutation({
    mutationFn: async (payload: any[]) =>
      fetchApi<{ message: string; count: number }>('/api/transactions/batch', {
        method: 'POST',
        body: JSON.stringify({ transactions: payload }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (onImportComplete) onImportComplete();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to import transactions.');
    },
  });

  if (!isOpen) return null;

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage('Image size is too large (max 12MB).');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setStatusText(
      docType === 'bank_statement'
        ? 'Scanning bank statement transactions with Gemini Vision...'
        : 'Reading receipt details and totals with Gemini Vision...'
    );

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataUrl = await base64Promise;

      const res = await fetchApi<{
        success: boolean;
        transactions: Array<{
          id: string;
          date: string;
          description: string;
          amount: number;
          type: 'expense' | 'income';
          category_id: number | null;
        }>;
      }>('/api/transactions/ai-scan', {
        method: 'POST',
        body: JSON.stringify({
          image: dataUrl,
          mimeType: file.type,
          docType,
        }),
      });

      if (!res?.transactions || res.transactions.length === 0) {
        setErrorMessage(
          docType === 'bank_statement'
            ? 'No bank statement transactions detected. Please ensure debits/credits and amounts are clear.'
            : 'No receipt items detected. Please ensure the store name and prices are visible.'
        );
      } else {
        setItems(
          res.transactions.map((tx) => ({
            id: tx.id || `tx-${Math.random()}`,
            selected: true,
            date: tx.date || new Date().toISOString().split('T')[0],
            description: tx.description || 'Transaction',
            amountMinor: tx.amount || 0,
            type: tx.type || 'expense',
            category_id: tx.category_id || (categories[0]?.id || null),
          }))
        );
      }
    } catch (err: any) {
      console.error('Document scan error:', err);
      setErrorMessage(err.message || 'Vision analysis failed. Please try another photo.');
    } finally {
      setIsProcessing(false);
      setStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateItem = (id: string, field: keyof ScannedTransactionItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddRow = () => {
    const newItem: ScannedTransactionItem = {
      id: `manual-${Date.now()}`,
      selected: true,
      date: new Date().toISOString().split('T')[0],
      description: 'New Transaction',
      amountMinor: 100000, // ₦1,000 in kobo
      type: 'expense',
      category_id: categories[0]?.id || null,
    };
    setItems((prev) => [newItem, ...prev]);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const selectedItems = items.filter((i) => i.selected && i.amountMinor > 0);
  const totalSelectedMinor = selectedItems.reduce((acc, i) => acc + (i.amountMinor || 0), 0);

  const handleImport = async () => {
    if (selectedItems.length === 0) {
      setErrorMessage('Please select at least one transaction to import.');
      return;
    }

    const payload = selectedItems.map((item) => ({
      type: item.type,
      amount: item.amountMinor,
      currency: 'NGN',
      category_id: item.category_id,
      note: item.description.trim(),
      occurred_at: item.date ? `${item.date}T12:00:00Z` : new Date().toISOString(),
    }));

    importMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                Receipt & Bank Statement Importer
              </h3>
              <p className="text-xs text-text-muted">
                Scan bank alerts, PDF statements, or receipts into editable transactions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg transition-colors btn-tap"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Segmented Choice: Receipt vs Bank Statement */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-main flex items-center justify-between">
              <span>Choose Document Type:</span>
              <span className="text-[11px] text-text-muted font-normal">
                Switch anytime to import another document
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-bg border border-border rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setDocType('receipt');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all btn-tap flex items-center justify-center gap-2 ${
                  docType === 'receipt'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Receipt className="w-4 h-4" />
                <span>Store / POS Receipt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDocType('bank_statement');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all btn-tap flex items-center justify-center gap-2 ${
                  docType === 'bank_statement'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Bank Statement / Alert</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone if no items yet */}
          {items.length === 0 && (
            <div className="card-base p-8 border-dashed border-2 border-border/80 flex flex-col items-center justify-center text-center space-y-4 bg-bg/50 hover:bg-bg/80 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
                disabled={isProcessing}
              />

              {isProcessing ? (
                <div className="space-y-3 flex flex-col items-center">
                  <CoinBuddy mood="counting" size={64} />
                  <div className="flex items-center gap-2 text-accent font-bold text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{statusText}</span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    AI is extracting merchants, amounts, and dates...
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-heading font-black text-text-main text-sm">
                      {docType === 'bank_statement'
                        ? 'Upload Bank Statement or Transfer Alert'
                        : 'Upload Receipt or POS Slip'}
                    </h4>
                    <p className="text-xs text-text-muted max-w-sm mt-1.5">
                      {docType === 'bank_statement'
                        ? 'Snap or upload a screenshot of your bank statement, mobile bank app (Kuda, Opay, GTBank, etc.), or debit/credit alert.'
                        : 'Upload a supermarket receipt, cafeteria bill, or POS payment slip.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Choose Photo or Screenshot</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red/10 border border-red/20 rounded-xl flex items-center gap-2 text-xs font-bold text-red">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Transactions Review & Edit Table */}
          {items.length > 0 && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-accent-soft/30 border border-accent/20 rounded-xl">
                <div>
                  <h4 className="font-heading font-black text-text-main text-sm flex items-center gap-2">
                    <span>Review & Edit Extracted Transactions</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white font-bold">
                      {selectedItems.length} of {items.length} selected
                    </span>
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Edit names, amounts, categories, or delete unneeded rows before importing.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text-main text-xs font-bold hover:border-accent transition-colors btn-tap flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-main text-xs font-bold transition-colors btn-tap flex items-center gap-1"
                    title="Upload another document"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Another</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Select all & items header */}
              <div className="flex items-center justify-between px-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-text-main cursor-pointer">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((i) => i.selected)}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="accent-accent w-3.5 h-3.5 rounded"
                  />
                  <span>Select All</span>
                </label>
                <span className="text-xs font-tabular font-bold text-accent">
                  Total: ₦{(totalSelectedMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Transactions List */}
              <div className="bg-bg border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors ${
                      item.selected ? 'hover:bg-surface/50' : 'opacity-50 bg-bg'
                    }`}
                  >
                    {/* Row Left: Checkbox + Date + Description */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => handleUpdateItem(item.id, 'selected', e.target.checked)}
                        className="accent-accent w-4 h-4 rounded shrink-0"
                      />

                      {/* Date */}
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)}
                        className="bg-surface border border-border text-[11px] font-bold rounded-lg px-2 py-1.5 text-text-main focus:outline-none focus:border-accent shrink-0"
                      />

                      {/* Description / Merchant Name */}
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        placeholder="Description (e.g. Zulkys Cafe, Uber, Groceries)..."
                        className="flex-1 bg-surface border border-border text-xs font-bold text-text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent min-w-[140px]"
                      />
                    </div>

                    {/* Row Right: Amount + Type + Category + Delete */}
                    <div className="flex items-center gap-2 pl-6 md:pl-0 flex-wrap">
                      {/* Amount */}
                      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-2 py-1">
                        <span className="text-[11px] font-bold text-accent">₦</span>
                        <input
                          type="number"
                          step="any"
                          value={item.amountMinor > 0 ? item.amountMinor / 100 : ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItem(item.id, 'amountMinor', Math.round(val * 100));
                          }}
                          placeholder="0.00"
                          className="w-20 bg-transparent text-xs font-bold font-tabular text-text-main focus:outline-none"
                        />
                      </div>

                      {/* Type Toggle: Expense vs Income */}
                      <select
                        value={item.type}
                        onChange={(e) => handleUpdateItem(item.id, 'type', e.target.value as any)}
                        className={`text-[11px] font-bold rounded-lg px-2 py-1.5 border border-border focus:outline-none focus:border-accent ${
                          item.type === 'income'
                            ? 'bg-green/10 text-green border-green/30'
                            : 'bg-surface text-text-muted'
                        }`}
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>

                      {/* Category Selector */}
                      <select
                        value={item.category_id || ''}
                        onChange={(e) =>
                          handleUpdateItem(
                            item.id,
                            'category_id',
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        className="bg-surface border border-border text-text-muted text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent max-w-[140px]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      {/* Remove Row */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-text-muted hover:text-red transition-colors btn-tap"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border flex items-center justify-between shrink-0 bg-surface">
          <p className="text-[11px] text-text-muted">
            {items.length > 0
              ? `${selectedItems.length} transaction${selectedItems.length === 1 ? '' : 's'} selected for import.`
              : 'Supports bank alerts, statement screenshots, and store receipts.'}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importMutation.isPending}
              className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main transition-colors btn-tap"
            >
              Cancel
            </button>

            {items.length > 0 && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importMutation.isPending || selectedItems.length === 0}
                className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Import Selected ({selectedItems.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
