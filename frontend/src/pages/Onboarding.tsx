import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi, setTabSessionToken } from '../api/client';
import { CoinBuddy } from '../components/CoinBuddy';
import { strings } from '../i18n/strings';
import { ArrowRight, Goal, Search, TrendingUp, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AppFooter } from '../components/AppFooter';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collected State
  const [goal, setGoal] = useState<'see_spending' | 'make_last' | 'save'>('see_spending');
  const [currency, setCurrency] = useState('NGN');
  const [periodType, setPeriodType] = useState<'weekly' | 'biweekly' | 'monthly' | 'custom_days' | 'manual'>('manual');
  const [baseIncome, setBaseIncome] = useState<string>('');
  
  // Auth state for final step
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const emailInputRef = React.useRef<HTMLInputElement>(null);

  const isEmailTaken = Boolean(
    error && (error.toLowerCase().includes('already in use') || error.toLowerCase().includes('already exists'))
  );

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError(strings.errors.fieldRequired);
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      return;
    }

    if (!agreedToTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to finish setup.");
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    try {
      // Custom register call with onboarding settings payload
      const settingsPayload = {
        main_goal: goal,
        home_currency: currency,
        period_type: periodType,
        base_income: baseIncome ? parseInt(baseIncome, 10) * 100 : 0
      };
      
      const regRes = await fetchApi<{ token?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, settings: settingsPayload })
      });
      if (regRes?.token) {
        setTabSessionToken(regRes.token);
      }
      
      await refreshAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2">
        <CoinBuddy mood="waving" size={80} speech="Hi! I'm Coin Buddy. I'm here to help you manage your allowance." />
        <h2 className="text-xl font-heading font-bold mt-4">{strings.onboarding.step1Title}</h2>
        <p className="text-sm text-text-muted">{strings.onboarding.step1Subtitle}</p>
      </div>

      <div className="space-y-3 mt-8">
        {[
          { id: 'see_spending', icon: Search, title: strings.onboarding.goalSeeSpendingTitle, desc: strings.onboarding.goalSeeSpendingDesc },
          { id: 'make_last', icon: TrendingUp, title: strings.onboarding.goalMakeLastTitle, desc: strings.onboarding.goalMakeLastDesc },
          { id: 'save', icon: Goal, title: strings.onboarding.goalSaveTitle, desc: strings.onboarding.goalSaveDesc },
        ].map((item) => {
          const isSelected = goal === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setGoal(item.id as any); setTimeout(nextStep, 300); }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all btn-tap flex gap-4 ${
                isSelected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-dark'
              }`}
            >
              <div className={`p-2 rounded-full h-10 w-10 flex items-center justify-center shrink-0 ${isSelected ? 'bg-accent text-white' : 'bg-bg text-text-muted'}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${isSelected ? 'text-accent' : 'text-text-main'}`}>{item.title}</h3>
                <p className="text-xs text-text-muted mt-0.5 leading-snug">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2">
        <CoinBuddy mood="happy" size={70} speech="Awesome choice! Let's get the boring details out of the way." />
        <h2 className="text-xl font-heading font-bold mt-4">{strings.onboarding.step2Title}</h2>
      </div>

      <div className="card-base p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            {strings.onboarding.currencyLabel}
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3.5 py-3 rounded-lg border border-border bg-bg text-text-main font-semibold focus:outline-none focus:border-accent"
          >
            <option value="NGN">₦ Nigerian Naira (NGN)</option>
            <option value="USD">$ US Dollar (USD)</option>
            <option value="GBP">£ British Pound (GBP)</option>
            <option value="EUR">€ Euro (EUR)</option>
            <option value="KES">KSh Kenyan Shilling (KES)</option>
            <option value="GHS">GH₵ Ghanaian Cedi (GHS)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-2">
        <CoinBuddy mood="counting" size={70} speech="How often does your money usually arrive?" />
        <h2 className="text-xl font-heading font-bold mt-4">{strings.onboarding.step3Title}</h2>
      </div>

      <div className="card-base p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
            {strings.onboarding.periodLabel}
          </label>
          <div className="space-y-2">
            {[
              { id: 'weekly', label: strings.onboarding.periodWeekly },
              { id: 'monthly', label: strings.onboarding.periodMonthly },
              { id: 'manual', label: strings.onboarding.periodManual },
            ].map(p => (
              <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${periodType === p.id ? 'border-accent bg-accent-soft' : 'border-border bg-bg'}`}>
                <input
                  type="radio"
                  name="periodType"
                  value={p.id}
                  checked={periodType === p.id}
                  onChange={(e) => setPeriodType(e.target.value as any)}
                  className="accent-accent w-4 h-4"
                />
                <span className={`text-sm font-semibold ${periodType === p.id ? 'text-accent' : 'text-text-main'}`}>{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {periodType !== 'manual' && (
          <div className="pt-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Expected Base Income ({currency})
            </label>
            <input
              type="number"
              value={baseIncome}
              onChange={(e) => setBaseIncome(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3.5 py-3 rounded-lg border border-border bg-bg text-text-main font-semibold focus:outline-none focus:border-accent"
            />
            <p className="text-[10px] text-text-muted mt-1.5 leading-snug">
              This helps set your baseline budget. You can always change this later or add extra income as it arrives.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderFinalStep = () => (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 relative">
      <div className="text-center space-y-2 pt-6">
        <CoinBuddy 
          mood={isEmailTaken ? 'worried' : 'celebrating'} 
          size={80} 
          speech={isEmailTaken ? "This email is already in use! Log in or try another email." : "All set! Let's lock this in so you don't lose it."} 
        />
        <h2 className="text-xl font-heading font-bold mt-4">Save Your Profile</h2>
        <p className="text-sm text-text-muted">Create an account to securely sync your budget across devices.</p>
      </div>

      <div className="card-base p-6 bg-surface">
        {error && (
          <div className="mb-4 p-3.5 bg-red/10 border border-red/30 text-red rounded-xl space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red" />
              <span className="leading-snug">{error}</span>
            </div>
            {isEmailTaken && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
                <button
                  type="button"
                  onClick={() => navigate('/login', { state: { email, message: 'This email is already in use. Please enter your password to sign in.' } })}
                  className="px-3.5 py-1.5 bg-accent text-white font-bold rounded-lg hover:bg-accent-hover transition-colors btn-tap text-xs shadow-none flex items-center gap-1.5"
                >
                  <span>Log In Instead</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('');
                    setError(null);
                    setTimeout(() => emailInputRef.current?.focus(), 50);
                  }}
                  className="px-3 py-1.5 bg-bg border border-border text-text-main font-bold rounded-lg hover:border-accent transition-colors btn-tap text-xs"
                >
                  Try Another Email
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleFinish} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Username or Nickname
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should Coin Buddy call you?"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Email Address
            </label>
            <input
              ref={emailInputRef}
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (isEmailTaken) setError(null);
              }}
              placeholder="student@uni.edu"
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-bg text-text-main focus:outline-none text-sm transition-colors ${
                isEmailTaken 
                  ? 'border-red focus:border-red ring-1 ring-red/20' 
                  : 'border-border focus:border-accent'
              }`}
            />
            {isEmailTaken && (
              <p className="text-[11px] text-red font-semibold mt-1">
                An account with this email already exists. Log in or try another email.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main transition-colors btn-tap"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Requirements Checklist — only shows when user starts typing */}
            {password.length > 0 && (
              <div className="space-y-1 pl-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${password.length >= 6 ? 'text-green' : 'text-text-muted'}`}>
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${password.length >= 6 ? 'border-green bg-green-soft' : 'border-border'}`}>
                    {password.length >= 6 && <span className="w-1.5 h-1.5 bg-green rounded-full" />}
                  </div>
                  At least 6 characters
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/\d/.test(password) ? 'text-green' : 'text-text-muted'}`}>
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${/\d/.test(password) ? 'border-green bg-green-soft' : 'border-border'}`}>
                    {/\d/.test(password) && <span className="w-1.5 h-1.5 bg-green rounded-full" />}
                  </div>
                  Contains a number
                </div>
                <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-green' : 'text-text-muted'}`}>
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${/[A-Z]/.test(password) ? 'border-green bg-green-soft' : 'border-border'}`}>
                    {/[A-Z]/.test(password) && <span className="w-1.5 h-1.5 bg-green rounded-full" />}
                  </div>
                  Contains an uppercase letter
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your password"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main transition-colors btn-tap"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-[11px] text-red font-semibold mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 pt-1 pb-1">
            <input
              type="checkbox"
              id="onboarding-agree-terms"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (error && error.includes('Terms')) setError(null);
              }}
              className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent cursor-pointer accent-accent shrink-0"
            />
            <label htmlFor="onboarding-agree-terms" className="text-xs text-text-muted cursor-pointer select-none leading-relaxed">
              I accept the{' '}
              <button
                type="button"
                onClick={() => navigate('/terms')}
                className="text-accent font-bold hover:underline"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => navigate('/privacy')}
                className="text-accent font-bold hover:underline"
              >
                Privacy Policy
              </button>
              .
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-3 py-3 bg-accent text-white font-bold rounded-xl btn-tap flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Finish Setup'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-bold text-text-muted hover:text-text-main btn-tap"
            >
              Already registered? <span className="text-accent hover:underline">Log in instead</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center py-0 md:py-10 px-0 md:px-4">
      <div className="w-full max-w-lg md:max-w-xl mx-auto flex flex-col min-h-[100dvh] md:min-h-0 md:bg-surface md:border md:border-border md:rounded-3xl p-6 md:p-10 relative">
      {/* Global Navigation Header Buttons */}
      <button 
        onClick={step === 1 ? () => window.history.back() : prevStep} 
        className="absolute top-6 left-6 p-2 text-text-muted hover:text-text-main bg-surface md:bg-bg rounded-full border border-border btn-tap z-10"
        title="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <button 
        type="button"
        onClick={() => navigate('/login')} 
        className="absolute top-6 right-6 text-xs font-bold text-text-muted hover:text-text-main btn-tap z-10"
      >
        Already have an account? <span className="text-accent hover:underline">Log in</span>
      </button>

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 pt-6 pb-8">
        {[1, 2, 3, 4].map(idx => (
          <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${step === idx ? 'w-8 bg-accent' : step > idx ? 'w-4 bg-accent/40' : 'w-4 bg-border'}`} />
        ))}
      </div>

      <div className="flex-1 mt-4">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderFinalStep()}
      </div>

      {/* Unified Bottom Navigation (Only for steps 1-3) */}
      {step < 4 && (
        <div className="mt-auto pt-6 pb-2 flex justify-between items-center w-full px-2">
          <button 
            onClick={() => setStep(4)} 
            className="px-4 py-2 text-sm font-bold tracking-wide text-text-muted hover:text-text-main transition-colors btn-tap"
          >
            Skip
          </button>
          
          <button 
            onClick={nextStep} 
            className="px-8 py-3 text-sm font-bold bg-accent text-white rounded-full hover:bg-accent-hover transition-all btn-tap shadow-none border border-accent"
          >
            Next
          </button>
        </div>
      )}
      </div>

      {/* Unified Global Footer */}
      <AppFooter className="pt-4" />
    </div>
  );
};
