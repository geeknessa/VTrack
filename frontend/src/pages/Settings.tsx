import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Save, ChevronLeft, PiggyBank, Calendar, CheckCircle2, SlidersHorizontal, Download, Trash2, AlertTriangle, X, Share2, Copy, Check, ShieldCheck, FileText, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { exportFinancialStatementPdf } from '../utils/pdfExport';

export const Settings: React.FC = () => {
  const { user, settings, updateSettings, logout } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Data & Privacy state
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Share Statement state
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Local state for settings form
  const [currency, setCurrency] = useState(settings?.home_currency || 'NGN');
  const [periodType, setPeriodType] = useState<string>(settings?.period_type || 'cycle');
  const [goal, setGoal] = useState(settings?.main_goal || 'see_spending');
  const [baseIncome, setBaseIncome] = useState(
    settings?.base_income ? String(settings.base_income / 100) : ''
  );
  const [autoSweep, setAutoSweep] = useState(settings?.auto_sweep_leftovers || false);
  const [vaultGoal, setVaultGoal] = useState(
    settings?.vault_goal ? String(settings.vault_goal / 100) : ''
  );
  const [periodAnchorDate, setPeriodAnchorDate] = useState(
    settings?.period_anchor_date ? String(settings.period_anchor_date).split('T')[0] : ''
  );
  const [nextIncomeDate, setNextIncomeDate] = useState(
    settings?.expected_next_income_date ? String(settings.expected_next_income_date).split('T')[0] : ''
  );
  const [customFrom, setCustomFrom] = useState(
    settings?.custom_period_from ? String(settings.custom_period_from).split('T')[0] : ''
  );
  const [customTo, setCustomTo] = useState(
    settings?.custom_period_to ? String(settings.custom_period_to).split('T')[0] : ''
  );

  // Calculate live countdown for allowance preview
  let cycleDaysRemaining: number | null = null;
  if (nextIncomeDate) {
    const [ey, em, ed] = nextIncomeDate.split('-').map(Number);
    const end = new Date(ey, em - 1, ed, 23, 59, 59);
    const diff = end.getTime() - new Date().getTime();
    cycleDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportFinancialStatementPdf(user, settings);
    } catch (err: any) {
      alert(err.message || 'Failed to generate fine PDF statement.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/transactions/export`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Could not export transactions.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vtrack_transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download transaction export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Password is required to confirm account deletion.');
      return;
    }
    setIsDeleting(true);
    try {
      await fetchApi('/api/auth/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword })
      });
      await logout();
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account. Double check your password.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateShareLink = async () => {
    setIsGeneratingLink(true);
    try {
      const res = await fetchApi<{ share_link: { token: string } }>('/api/share-links', {
        method: 'POST'
      });
      const url = `${window.location.origin}/share/${res.share_link.token}`;
      setShareLink(url);
    } catch (err: any) {
      alert(err.message || 'Failed to generate statement share link.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateSettings({
        home_currency: currency,
        period_type: periodType as any,
        main_goal: goal as any,
        base_income: baseIncome ? Math.round(parseFloat(baseIncome) * 100) : 0,
        auto_sweep_leftovers: autoSweep,
        vault_goal: vaultGoal ? Math.round(parseFloat(vaultGoal) * 100) : 0,
        period_anchor_date: periodAnchorDate || null,
        expected_next_income_date: nextIncomeDate || null,
        custom_period_from: customFrom || null,
        custom_period_to: customTo || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const curr = currency === 'NGN' ? '₦' : currency;

  return (
    <div className="min-h-screen pt-8 px-4 pb-24 md:pb-12 md:pt-12 w-full animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 text-text-muted hover:text-text-main bg-surface rounded-full border border-border btn-tap"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-main">Settings</h1>
              <p className="text-xs text-text-muted mt-0.5">Customize your budget cycle and tracking preferences</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-bold rounded-xl btn-tap hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm shadow-none"
          >
            {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* ── Responsive 2-column Grid on Desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* ════ LEFT COLUMN: Tracking Cycle & Budget ════ */}
          <div className="space-y-6">

            {/* Dedicated Budget Planner Quick Link */}
            <div className="card-base p-5 bg-surface border border-accent/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-main">Budget Planner</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Set up your spending limits, safe daily pace, and category breakdowns.
                  </p>
                </div>
              </div>
              <Link
                to="/budget/new"
                className="shrink-0 px-3.5 py-2 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent-hover transition-colors btn-tap"
              >
                Open Planner
              </Link>
            </div>

            {/* Tracking Period & Budget Cycle */}
            <div className="card-base p-5 bg-surface border border-border space-y-5">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Calendar className="w-4 h-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Tracking Period &amp; Cycle
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">Tracking Cycle</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                >
                  <option value="cycle">Allowance Cycle (Between pay dates)</option>
                  <option value="monthly">Monthly (Calendar Month)</option>
                  <option value="weekly">Weekly (Monday – Sunday)</option>
                  <option value="biweekly">Biweekly (Every 2 Weeks)</option>
                  <option value="daily">Daily (Day by Day)</option>
                  <option value="yearly">Yearly (Full Year)</option>
                  <option value="custom">Custom Date Range</option>
                  <option value="all_time">All Time (Entire History)</option>
                </select>
                <p className="text-[11px] text-text-muted mt-1.5 leading-snug">
                  This choice determines which cycle is displayed on your home dashboard and activity feed.
                </p>
              </div>

              {/* Allowance Cycle specific fields */}
              {periodType === 'cycle' && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">
                      Cycle Anchor Date (Deposit Date)
                    </label>
                    <input
                      type="date"
                      value={periodAnchorDate}
                      onChange={(e) => setPeriodAnchorDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                    />
                    <p className="text-[10px] text-text-muted mt-1">When this allowance cycle began.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">
                      Expected Next Allowance Date
                    </label>
                    <input
                      type="date"
                      value={nextIncomeDate}
                      onChange={(e) => setNextIncomeDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                    />
                    <p className="text-[10px] text-text-muted mt-1">When your next top-up or allowance arrives.</p>
                  </div>

                  {cycleDaysRemaining !== null && (
                    <div className="p-3 bg-accent-soft rounded-xl border border-accent/20 flex items-center justify-between">
                      <span className="text-xs font-bold text-accent">Countdown to next allowance</span>
                      <span className="text-xs font-bold font-tabular text-accent bg-white/60 px-2 py-0.5 rounded-full">
                        {cycleDaysRemaining} days remaining
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Date Range specific fields */}
              {periodType === 'custom' && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">Start Date</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-bg cursor-pointer hover:bg-surface transition-colors">
                <input
                  type="checkbox"
                  checked={autoSweep}
                  onChange={(e) => setAutoSweep(e.target.checked)}
                  className="accent-accent w-4 h-4 rounded"
                />
                <div className="flex-1">
                  <span className="block text-xs font-bold text-text-main">Auto-Sweep Leftovers</span>
                  <span className="block text-[10px] text-text-muted leading-tight mt-0.5">
                    Automatically stash unspent money into your Piggybank at the end of each cycle.
                  </span>
                </div>
              </label>
            </div>

            {/* Currency & Baseline Income */}
            <div className="card-base p-5 bg-surface border border-border space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted border-b border-border pb-3">
                Currency &amp; Baseline Budget
              </p>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">Home Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                >
                  <option value="NGN">&#8358; Nigerian Naira (NGN)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                  <option value="GBP">&#163; British Pound (GBP)</option>
                  <option value="EUR">&#8364; Euro (EUR)</option>
                  <option value="KES">KSh Kenyan Shilling (KES)</option>
                  <option value="GHS">GH&#8373; Ghanaian Cedi (GHS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">
                  Expected Base Income ({curr})
                </label>
                <input
                  type="number"
                  value={baseIncome}
                  onChange={(e) => setBaseIncome(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent font-tabular"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Used as your baseline budget when no income has been logged yet this cycle.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">Primary Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent"
                >
                  <option value="see_spending">See where my money goes</option>
                  <option value="make_last">Make my money last (Track runway)</option>
                  <option value="save">Save up for something (Build savings)</option>
                </select>
              </div>
            </div>

          </div>

          {/* ════ RIGHT COLUMN: Piggybank, Account & Actions ════ */}
          <div className="space-y-6">

            {/* Account Info */}
            <div className="card-base p-5 bg-surface border border-border space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Account Profile</p>
              <div className="flex items-center gap-3 pt-1">
                <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-base">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-text-main text-sm">{user?.name || user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-text-muted">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Piggybank Goal */}
            <div className="card-base p-5 bg-surface border border-border space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <PiggyBank className="w-4 h-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Piggybank Savings Goal</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted mb-2">
                  Savings Target ({curr})
                </label>
                <input
                  type="number"
                  value={vaultGoal}
                  onChange={(e) => setVaultGoal(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-sm focus:outline-none focus:border-accent font-tabular"
                />
                <p className="text-[10px] text-text-muted mt-1 leading-snug">
                  The target savings goal displayed around your piggy bank on the dashboard.
                </p>
              </div>

              {vaultGoal && parseFloat(vaultGoal) > 0 && (
                <div className="p-3.5 bg-bg rounded-xl border border-border space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-accent">
                      {curr}{new Intl.NumberFormat('en-US').format((settings?.vault_balance || 0) / 100)} saved
                    </span>
                    <span className="text-text-muted">
                      {curr}{new Intl.NumberFormat('en-US').format(parseFloat(vaultGoal))} goal
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          Math.round(((settings?.vault_balance || 0) / (parseFloat(vaultGoal) * 100)) * 100),
                          100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sponsor / Parent Statement */}
            <div className="card-base p-5 bg-surface border border-border space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Share2 className="w-4 h-4 text-accent" />
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Sponsor &amp; Parent Statement
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-text-main mb-1">Share Verified Overview</p>
                <p className="text-xs text-text-muted mb-3 leading-relaxed">
                  Generate a secure read-only statement link to share your budget runway and spending transparency with a parent or sponsor.
                </p>

                {shareLink ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 p-2 bg-bg border border-border rounded-xl">
                      <input
                        type="text"
                        readOnly
                        value={shareLink}
                        className="bg-transparent text-xs font-semibold text-text-main flex-1 outline-none truncate font-tabular px-1"
                      />
                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="px-3 py-1.5 bg-accent text-white font-bold rounded-lg text-xs hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1 shrink-0"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-green font-bold">
                      Link active for 30 days &middot; Can be viewed without an account.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateShareLink}
                    disabled={isGeneratingLink}
                    className="w-full py-2.5 px-4 bg-bg border border-border hover:border-accent text-text-main font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-xs transition-colors disabled:opacity-50"
                  >
                    <Share2 className="w-4 h-4 text-accent" />
                    <span>{isGeneratingLink ? 'Generating Link...' : 'Create Shareable Statement Link'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Data & Privacy (NDPR / GDPR) */}
            <div className="card-base p-5 bg-surface border border-border space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted border-b border-border pb-3">
                Data &amp; Privacy (NDPR / GDPR)
              </p>

              <div>
                <p className="text-xs font-bold text-text-main mb-1">Export Financial Statement</p>
                <p className="text-xs text-text-muted mb-3">
                  Download a certified, beautifully formatted PDF financial statement complete with allowance totals, category breakdowns, and transaction history.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="flex-1 py-2.5 px-4 bg-accent text-white hover:bg-accent-hover font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-xs transition-colors disabled:opacity-50 shadow-none"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExporting ? 'Generating PDF...' : 'Download Statement (.PDF)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                    className="py-2.5 px-3 bg-bg border border-border hover:border-accent text-text-muted hover:text-text-main font-semibold rounded-xl btn-tap flex items-center justify-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                    title="Export raw spreadsheet data in CSV format"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-text-muted" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-text-main mb-1">Legal &amp; Compliance</p>
                <p className="text-xs text-text-muted mb-2.5">
                  Review how your allowance records are secured and our student service terms.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/privacy')}
                    className="py-2.5 px-3 bg-bg border border-border hover:border-accent text-text-main font-bold rounded-xl btn-tap flex items-center justify-between text-xs transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      <span>Privacy Policy</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/terms')}
                    className="py-2.5 px-3 bg-bg border border-border hover:border-accent text-text-main font-bold rounded-xl btn-tap flex items-center justify-between text-xs transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" />
                      <span>Terms of Service</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <p className="text-xs font-bold text-red mb-1">Danger Zone</p>
                <p className="text-xs text-text-muted mb-3">
                  Permanently erase your account, tracked budgets, transactions, and settings.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2.5 px-4 bg-red/10 hover:bg-red/20 text-red border border-red/20 font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-xs transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete My Account</span>
                </button>
              </div>
            </div>

            {/* Save Button (Mobile & Desktop) */}
            <div className="card-base p-5 bg-surface border border-border space-y-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3.5 bg-accent text-white font-bold rounded-xl btn-tap flex justify-center items-center gap-2 hover:bg-accent-hover transition-colors disabled:opacity-50 text-sm shadow-none"
              >
                {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : saveSuccess ? 'Saved successfully!' : 'Save Settings'}
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full py-3 text-red bg-red/10 hover:bg-red/15 font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-xs transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Log Out of VTrack
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-border p-6 shadow-none animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5 text-red">
                <div className="w-9 h-9 rounded-xl bg-red/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-text-main">Delete Account?</h3>
                  <p className="text-xs text-red font-semibold">This action cannot be undone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                className="p-1.5 text-text-muted hover:text-text-main rounded-lg bg-bg border border-border btn-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              All of your transactions, active budgets, food inventory, and savings history will be permanently deleted from our servers immediately.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              {deleteError && (
                <div className="p-2.5 rounded-xl bg-red/10 border border-red/20 text-red text-xs font-bold">
                  {deleteError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-muted mb-1.5">
                  Confirm your password to proceed
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-semibold text-xs focus:outline-none focus:border-red"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="flex-1 py-2.5 bg-bg border border-border text-text-muted hover:text-text-main font-bold rounded-xl text-xs btn-tap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 py-2.5 bg-red text-white hover:bg-red-600 font-bold rounded-xl text-xs btn-tap disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Deleting...' : 'Permanently Delete'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
