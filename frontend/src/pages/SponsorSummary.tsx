import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ShieldCheck, Receipt, PieChart, ArrowLeft } from 'lucide-react';
import { CoinBuddy } from '../components/CoinBuddy';

interface PublicStatement {
  student_name: string;
  home_currency: string;
  budget: {
    name: string;
    total_amount: number;
    spent: number;
    remaining: number;
    days_remaining: number;
    start_date: string;
    end_date: string;
  } | null;
  categories: {
    category_name: string;
    total: number;
  }[];
  transactions: {
    id: number;
    occurred_at: string;
    type: string;
    amount: number;
    currency: string;
    converted_amount: number;
    note: string | null;
    category_name: string | null;
  }[];
  expires_at: string;
}

function formatMoney(minorUnits: number, currency: string): string {
  const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;
  const major = minorUnits / 100;
  return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major);
}

export const SponsorSummary: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery<PublicStatement>({
    queryKey: ['share-statement', token],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/share-links/public/${token}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Statement link is invalid or expired.');
      }
      return res.json();
    },
    enabled: Boolean(token),
    retry: false
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <CoinBuddy mood="happy" size={70} />
        <p className="mt-4 text-sm font-bold text-text-muted">Loading student statement...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
        <CoinBuddy mood="worried" size={70} />
        <h2 className="text-xl font-heading font-bold text-text-main mt-4">Link Unavailable</h2>
        <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
          {(error as Error)?.message || 'This financial statement link may have expired or been revoked.'}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl text-xs hover:bg-accent-hover transition-colors btn-tap"
        >
          Return to VTrack
        </Link>
      </div>
    );
  }

  const { student_name, home_currency, budget, categories, transactions } = data;
  const curr = home_currency === 'NGN' ? '₦' : home_currency;
  const totalBudget = budget?.total_amount || 0;
  const totalSpent = budget?.spent || categories.reduce((sum, c) => sum + Number(c.total), 0);
  const remaining = budget ? budget.remaining : 0;
  const pctUsed = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

  return (
    <div className="min-h-screen bg-bg py-8 px-4 sm:px-6 md:px-8 text-text-main">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Top Bar (Hidden during Print) ── */}
        <div className="print:hidden flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 bg-surface border border-border rounded-xl text-text-muted hover:text-text-main transition-colors btn-tap"
              title="VTrack Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">VTrack Student Report</span>
              <p className="text-xs font-semibold text-text-main">Parent &amp; Sponsor Verified Statement</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white font-bold rounded-xl text-xs hover:bg-accent-hover transition-colors btn-tap"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>

        {/* ── Formal Header ── */}
        <div className="card-base p-6 bg-surface border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Read-Only Statement</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main">
                {student_name}'s Financial Overview
              </h1>
              <p className="text-xs text-text-muted mt-1">
                Student expense tracking report generated from VTrack &middot; Currency: {home_currency}
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-text-muted font-tabular">
              <p className="font-bold text-text-main">Date Generated</p>
              <p>{new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
              {budget?.end_date && (
                <p className="text-[11px] text-text-muted mt-0.5">
                  Cycle ends {new Date(budget.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Key Budget Numbers ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card-base p-5 bg-surface border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Total Allowance</span>
            <p className="text-2xl font-heading font-black text-text-main font-tabular mt-1">
              {totalBudget > 0 ? formatMoney(totalBudget, curr) : 'Self-Paced'}
            </p>
            <p className="text-[11px] text-text-muted mt-1">Allocated budget for cycle</p>
          </div>

          <div className="card-base p-5 bg-surface border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Total Spent</span>
            <p className="text-2xl font-heading font-black text-text-main font-tabular mt-1">
              {formatMoney(totalSpent, curr)}
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              {totalBudget > 0 ? `${pctUsed}% of period allowance` : 'Logged expenditures'}
            </p>
          </div>

          <div className="card-base p-5 bg-surface border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Remaining Balance</span>
            <p className={`text-2xl font-heading font-black font-tabular mt-1 ${remaining < 0 ? 'text-red' : 'text-green'}`}>
              {totalBudget > 0 ? formatMoney(remaining, curr) : 'Healthy'}
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              {budget ? `${budget.days_remaining} days remaining in cycle` : 'Active spending pace'}
            </p>
          </div>
        </div>

        {/* ── Category Spending Breakdown ── */}
        {categories.length > 0 && (
          <div className="card-base p-6 bg-surface border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <PieChart className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                Spending by Category
              </h2>
            </div>

            <div className="space-y-3">
              {categories.map((cat, idx) => {
                const catAmount = Number(cat.total);
                const catPct = totalSpent > 0 ? Math.round((catAmount / totalSpent) * 100) : 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-text-main">{cat.category_name}</span>
                      <span className="font-tabular text-text-muted">
                        {formatMoney(catAmount, curr)} &middot; {catPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(catPct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Transactions Log ── */}
        <div className="card-base p-6 bg-surface border border-border space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Receipt className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
              Recent Verified Log
            </h2>
          </div>

          {transactions.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">No transactions logged in this cycle yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-text-main">{tx.category_name || 'General Spend'}</p>
                    <p className="text-[11px] text-text-muted">
                      {new Date(tx.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {tx.note && ` · ${tx.note}`}
                    </p>
                  </div>
                  <div className="text-right font-tabular">
                    <span className={`font-bold ${tx.type === 'income' ? 'text-green' : 'text-text-main'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.converted_amount || tx.amount, curr)}
                    </span>
                    {tx.currency !== home_currency && (
                      <p className="text-[10px] text-text-muted font-normal">
                        ({tx.currency} {(tx.amount / 100).toFixed(2)})
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Statement Footer ── */}
        <div className="text-center text-[11px] text-text-muted pt-4 space-y-1">
          <p>This statement is generated securely by VTrack for student sponsor transparency.</p>
          <p>All figures reflect student-tracked living, academic, and nourishment expenditures.</p>
        </div>

      </div>
    </div>
  );
};
