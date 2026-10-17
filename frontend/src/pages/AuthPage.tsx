import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { strings } from '../i18n/strings';
import { CoinBuddy } from '../components/CoinBuddy';
import { ArrowRight, AlertCircle, CheckCircle2, ChevronLeft, KeyRound, Info, Eye, EyeOff } from 'lucide-react';
import { fetchApi, setTabSessionToken } from '../api/client';
import { AppFooter } from '../components/AppFooter';

export const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const prefilledEmail = (location.state as any)?.email || '';
  const prefilledMsg = (location.state as any)?.message || null;

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(prefilledMsg);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAgreedToTerms, setLoginAgreedToTerms] = useState(false);
  const [registerAgreedToTerms, setRegisterAgreedToTerms] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const isEmailTaken = Boolean(
    error && (error.toLowerCase().includes('already in use') || error.toLowerCase().includes('already exists'))
  );

  // If launched with ?isolated=true, ensure clean isolated session storage
  useEffect(() => {
    const isIsolated = new URLSearchParams(window.location.search).get('isolated') === 'true';
    if (isIsolated) {
      setTabSessionToken(null);
    }
  }, []);

  // Autofocus password if arriving with prefilled email
  useEffect(() => {
    if (prefilledEmail) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [prefilledEmail]);

  // Password Recovery State
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setInfoMsg(null);

    if (!email || !password) {
      setError(strings.errors.fieldRequired);
      return;
    }

    if (!loginAgreedToTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to log in.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || strings.auth.authErrorDefault);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setInfoMsg(null);

    if (!email || !password || !confirmPassword) {
      setError(strings.errors.fieldRequired);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and try again.");
      return;
    }

    if (password.length < 6 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      setError("Password must be at least 6 characters and include a number and an uppercase letter.");
      return;
    }

    if (!registerAgreedToTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, name || undefined);
    } catch (err: any) {
      setError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setInfoMsg(null);

    if (!email) {
      setError('Please enter your email address to receive a recovery code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchApi<{ message: string; recoveryCode?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (res.recoveryCode) {
        setRecoveryCode(res.recoveryCode);
      }
      setSuccessMsg(res.message || 'Recovery code generated! Check your email or enter the code below.');
      setRecoveryStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to request recovery code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setInfoMsg(null);

    if (!recoveryCode || !newPassword) {
      setError('Both recovery code and new password are required.');
      return;
    }

    if (newPassword.length < 6 || !/\d/.test(newPassword) || !/[A-Z]/.test(newPassword)) {
      setError('Password must be at least 6 characters and contain an uppercase letter and a number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetchApi<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: recoveryCode,
          new_password: newPassword
        })
      });
      setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.');
      setMode('login');
      setPassword('');
      setRecoveryStep(1);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please check your recovery code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buddyMood = isEmailTaken 
    ? 'worried' 
    : mode === 'forgot' 
      ? 'worried' 
      : mode === 'register' 
        ? 'happy' 
        : 'waving';

  const buddySpeech = isEmailTaken
    ? "This email is already in use! Log in or try another email."
    : mode === 'forgot'
      ? "Don't worry, let's get you back in!"
      : mode === 'register'
        ? "Welcome! Let's get your VTrack account ready."
        : "Welcome back to VTrack!";

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col justify-center items-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6 flex-1 flex flex-col justify-center relative py-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <CoinBuddy mood={buddyMood} size={90} speech={buddySpeech} />
          <h1 className="text-3xl font-heading font-bold text-text-main mt-4">
            {strings.app.name}
          </h1>
          <p className="text-sm text-text-muted">{strings.app.tagline}</p>
        </div>

        {/* Auth Card */}
        <div className="card-base p-6 bg-surface border border-border">
          {mode === 'login' ? (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-heading font-black text-text-main">
                  Sign In
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Access your allowance, runway & campus food logs
                </p>
              </div>

              {/* Info Alert (e.g. from onboarding redirect) */}
              {infoMsg && (
                <div className="mb-4 p-3 bg-accent-soft border border-accent/20 text-accent text-xs font-semibold rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Success Alert */}
              {successMsg && (
                <div className="mb-4 p-3 bg-green/10 border border-green text-green text-xs font-semibold rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Actionable Error Alert */}
              {error && (
                <div className="mb-4 p-3 bg-red/10 border border-red text-red text-xs font-semibold rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                    {strings.auth.emailLabel}
                  </label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={strings.auth.emailPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                      {strings.auth.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); setInfoMsg(null); setRecoveryStep(1); }}
                      className="text-[10px] font-bold text-accent hover:text-accent-hover btn-tap"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={strings.auth.passwordPlaceholder}
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
                </div>

                <div className="flex items-start gap-2 pt-1 pb-1">
                  <input
                    type="checkbox"
                    id="login-agree-terms"
                    checked={loginAgreedToTerms}
                    onChange={(e) => {
                      setLoginAgreedToTerms(e.target.checked);
                      if (error && error.includes('Terms')) setError(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent cursor-pointer accent-accent shrink-0"
                  />
                  <label htmlFor="login-agree-terms" className="text-xs text-text-muted cursor-pointer select-none leading-relaxed">
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
                  className="w-full mt-2 py-3 bg-accent text-white font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span>{strings.auth.loginBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Clean New Account Link */}
              <div className="mt-6 pt-5 border-t border-border text-center">
                <p className="text-xs text-text-muted">
                  New to VTrack?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="font-bold text-accent hover:underline btn-tap"
                  >
                    Create Account & Setup
                  </button>
                </p>
              </div>
            </>
          ) : mode === 'register' ? (
            /* Quick Account Registration */
            <>
              <div className="mb-4">
                <h2 className="text-xl font-heading font-black text-text-main">
                  Create Account
                </h2>
                <p className="text-xs text-text-muted mt-1">
                  Start tracking your student budget in seconds
                </p>
              </div>

              {/* Onboarding Setup Card Callout */}
              <div className="p-4 rounded-xl bg-accent-soft/40 border border-accent/20 space-y-3 mb-4">
                <p className="text-xs font-bold text-text-main">60-Second Guided Setup (Recommended)</p>
                <p className="text-[11px] text-text-muted">
                  Configure your allowance and goals so VTrack personalizes your daily runway and meal budget.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/onboarding')}
                  className="w-full py-2.5 px-3 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Launch Guided Setup Wizard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Actionable Error Alert */}
              {error && (
                <div className="mb-4 p-3.5 bg-red/10 border border-red/30 text-red text-xs font-semibold rounded-xl space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2 text-red">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{error}</span>
                  </div>
                  {isEmailTaken && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setError(null);
                          setPassword('');
                          setInfoMsg('An account with this email exists. Please enter your password to sign in.');
                          setTimeout(() => passwordInputRef.current?.focus(), 50);
                        }}
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

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                    Username or Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                    {strings.auth.emailLabel}
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
                    placeholder={strings.auth.emailPlaceholder}
                    className={`w-full px-3.5 py-2.5 rounded-lg border bg-bg text-text-main focus:outline-none text-sm transition-colors ${
                      isEmailTaken 
                        ? 'border-red focus:border-red ring-1 ring-red/20' 
                        : 'border-border focus:border-accent'
                    }`}
                  />
                  {isEmailTaken && (
                    <p className="text-[11px] text-red font-semibold mt-1">
                      This email is already registered to a VTrack account.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                    {strings.auth.passwordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
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
                  {/* Password Requirements Checklist — only shows when typing */}
                  {password.length > 0 && (
                    <div className="space-y-0.5 pl-1 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className={`text-[10px] font-bold flex items-center gap-1.5 ${password.length >= 6 ? 'text-green' : 'text-text-muted'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center border ${password.length >= 6 ? 'border-green bg-green-soft' : 'border-border'}`}>
                          {password.length >= 6 && <span className="w-1 h-1 bg-green rounded-full" />}
                        </div>
                        At least 6 characters
                      </div>
                      <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/\d/.test(password) ? 'text-green' : 'text-text-muted'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center border ${/\d/.test(password) ? 'border-green bg-green-soft' : 'border-border'}`}>
                          {/\d/.test(password) && <span className="w-1 h-1 bg-green rounded-full" />}
                        </div>
                        Contains a number
                      </div>
                      <div className={`text-[10px] font-bold flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-green' : 'text-text-muted'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center border ${/[A-Z]/.test(password) ? 'border-green bg-green-soft' : 'border-border'}`}>
                          {/[A-Z]/.test(password) && <span className="w-1 h-1 bg-green rounded-full" />}
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
                    id="register-agree-terms"
                    checked={registerAgreedToTerms}
                    onChange={(e) => {
                      setRegisterAgreedToTerms(e.target.checked);
                      if (error && error.includes('Terms')) setError(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-border text-accent focus:ring-accent cursor-pointer accent-accent shrink-0"
                  />
                  <label htmlFor="register-agree-terms" className="text-xs text-text-muted cursor-pointer select-none leading-relaxed">
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
                  className="w-full mt-2 py-3 bg-accent text-white font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Creating Account...' : strings.auth.signupBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Link to Guided Wizard */}
              <div className="mt-6 pt-5 border-t border-border text-center">
                <p className="text-xs text-text-muted">
                  Want to customize your runway and goals first?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding')}
                    className="font-bold text-accent hover:underline btn-tap"
                  >
                    Open Onboarding Wizard
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* Forgot Password Flow */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main btn-tap"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to login</span>
                </button>
                <span className="text-xs font-bold text-accent flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Account Recovery</span>
                </span>
              </div>

              {/* Alerts */}
              {successMsg && (
                <div className="p-3 bg-green/10 border border-green text-green text-xs font-semibold rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red/10 border border-red text-red text-xs font-semibold rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                      Enter your account email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
                    />
                    <p className="text-[11px] text-text-muted mt-1.5">
                      We'll generate a secure 6-digit recovery code for you.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-accent text-white font-bold rounded-xl btn-tap flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Generating Code...' : 'Get Recovery Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                      6-Digit Recovery Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="e.g. 123456"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-text-main font-bold tracking-widest text-center text-lg focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Create your new password"
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-border bg-bg text-text-main focus:outline-none focus:border-accent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main transition-colors btn-tap"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">
                      Must be 6+ chars, with a number and uppercase letter.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep(1)}
                      className="py-2.5 px-4 bg-bg border border-border rounded-xl text-xs font-bold text-text-muted hover:text-text-main btn-tap"
                    >
                      Resend Code
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 bg-accent text-white font-bold rounded-xl btn-tap text-xs disabled:opacity-50"
                    >
                      {isSubmitting ? 'Resetting Password...' : 'Save New Password & Log In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Standardized Unified Footer */}
        <AppFooter className="pt-2" />
      </div>
    </div>
  );
};
