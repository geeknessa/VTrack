import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Landing } from './pages/Landing';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Activity } from './pages/Activity';
import { NewTransaction } from './pages/NewTransaction';
import { Layout } from './components/Layout';
import { CoinBuddy } from './components/CoinBuddy';
import { PeriodProvider } from './context/PeriodContext';

// Code-split larger secondary bundles to optimize initial page load
const FoodMenus = React.lazy(() => import('./pages/FoodMenus').then(m => ({ default: m.FoodMenus })));
const Insights = React.lazy(() => import('./pages/Insights').then(m => ({ default: m.Insights })));
const Subscriptions = React.lazy(() => import('./pages/Subscriptions').then(m => ({ default: m.Subscriptions })));
const BudgetPlanner = React.lazy(() => import('./pages/BudgetPlanner').then(m => ({ default: m.BudgetPlanner })));
const SponsorSummary = React.lazy(() => import('./pages/SponsorSummary').then(m => ({ default: m.SponsorSummary })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-4">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <CoinBuddy mood="happy" size={70} />
        <div className="mt-4 w-48 h-2 bg-border rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-accent animate-pulse" />
        </div>
      </div>
    );
  }

  // Unauthenticated flow
  if (!user) {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<Navigate to="/onboarding" replace />} />
            <Route path="/share/:token" element={<SponsorSummary />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // Authenticated flow
  return (
    <BrowserRouter>
      <PeriodProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/share/:token" element={<SponsorSummary />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="activity" element={<Activity />} />
              <Route path="insights" element={<Insights />} />
              <Route path="menus" element={<FoodMenus />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="budget/new" element={<BudgetPlanner />} />
              <Route path="budget/edit" element={<BudgetPlanner isEdit={true} />} />
            </Route>
            <Route path="/add" element={<NewTransaction />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PeriodProvider>
    </BrowserRouter>
  );
};
