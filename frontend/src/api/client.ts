export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  home_currency: string;
  period_type: 'weekly' | 'biweekly' | 'monthly' | 'custom_days' | 'manual' | 'cycle' | 'daily' | 'yearly' | 'custom' | 'all_time';
  period_anchor_date?: string | null;
  expected_next_income_date?: string | null;
  custom_period_from?: string | null;
  custom_period_to?: string | null;
  income_pattern?: string | null;
  main_goal: 'see_spending' | 'make_last' | 'save';
  savings_target: number; // minor units
  opening_balance: number; // minor units
  base_income: number; // minor units
  vault_balance: number; // minor units
  vault_goal: number; // minor units — piggybank savings target
  auto_sweep_leftovers: boolean;
  current_cycle_id: number | null;
  theme: 'light' | 'dark';
  accent: string;
  onboarding_completed: boolean;
  lifestyle_meal_plan: boolean;
  lifestyle_daily_meals: number;
  lifestyle_meal_cost: number;
}

export interface Category {
  id: number;
  user_id: string | null;
  name: string;
  icon_key: string;
  kind: 'needs' | 'wants';
  is_default: boolean;
}

export interface Transaction {
  id: number;
  user_id: string;
  type: 'expense' | 'income';
  amount: number; // minor units
  currency: string;
  exchange_rate: number;
  converted_amount: number; // minor units
  category_id?: number | null;
  category_name?: string | null;
  category_icon?: string | null;
  note?: string | null;
  occurred_at: string;
  date?: string;
}

export interface BudgetCategory {
  category_id: number;
  category_name: string;
  icon_key: string;
  kind: 'needs' | 'wants';
  allocated_amount: number; // minor units
  spent_amount: number;     // minor units
  remaining_amount: number; // minor units
  percentage_used: number;
}

export interface BudgetGuardrail {
  limit: number;      // minor units
  is_explicit: boolean;
  spent: number;      // minor units
  remaining: number;  // minor units
}

export interface ActiveBudget {
  id: number;
  name: string;
  cycle_type: 'monthly' | 'weekly' | 'biweekly' | 'allowance' | 'custom';
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  total_amount: number; // minor units
  spent: number;        // minor units
  remaining: number;    // minor units
  percentage_used: number;
  status_caption: string;
  days_remaining: number;
  total_days: number;
  tx_count_in_cycle: number;
  daily: BudgetGuardrail;
  weekly: BudgetGuardrail;
  savings_target: number; // minor units
  vault_balance: number;  // minor units
  upcoming_subscriptions_reserved?: number; // minor units reserved before daily spend
  categories: BudgetCategory[];
  has_category_allocations: boolean;
  unallocated_amount: number; // minor units
}

export interface ActiveBudgetResponse {
  has_budget: boolean;
  budget: ActiveBudget | null;
}

export interface BudgetSuggestion {
  cycle_type: string;
  start_date: string;
  end_date: string;
  total_funds: number;
  total_amount: number;
  daily_limit: number;
  weekly_limit: number;
  savings_target: number;
  allocations: {
    category_id: number;
    category_name: string;
    icon_key: string;
    kind: 'needs' | 'wants';
    allocated_amount: number;
  }[];
  goal?: string;
  advice_title?: string;
  advice_subtitle?: string;
  advice_message?: string;
}

export interface InsightCategory {
  category_name: string;
  icon_key: string;
  kind: 'needs' | 'wants';
  total: number;
  count: number;
  percentage: number;
}

export interface WeeklyBar {
  week_label: string;
  sub_label: string;
  from: string;
  to: string;
  total_spent: number;
}

export interface CycleComparison {
  has_comparison: boolean;
  current_cycle_spent: number;
  previous_cycle_spent: number;
  diff_amount: number;
  diff_percentage: number;
  status: 'spending_less' | 'spending_more' | 'equal' | 'neutral';
  insight_text: string;
}

export interface FoodSplitMetric {
  amount: number;
  percentage: number;
}

export interface FoodSplit {
  total_food_spent: number;
  food_court: FoodSplitMetric;
  outside_dining: FoodSplitMetric;
  provisions: FoodSplitMetric;
}

export interface MealPlanInsight {
  weekly_target: number;
  is_set: boolean;
  this_week_food_spent: number;
  remaining_meal_budget: number;
  zero_spend_days_count: number;
  days_elapsed: number;
  stash_savings: number;
  week_label: string;
}

export interface InsightsResponse {
  period: {
    from: string | null;
    to: string | null;
    total_spent: number;
  };
  categories: InsightCategory[];
  weekly_bars: WeeklyBar[];
  cycle_comparison: CycleComparison;
  top_purchases: Transaction[];
  food_split: FoodSplit;
  meal_plan: MealPlanInsight;
}

export interface SubscriptionCatalogItem {
  id: number;
  name: string;
  icon_key: string;
  default_amount: number;
  default_currency: string;
}

export interface UserSubscription {
  id: number;
  name: string;
  catalog_id?: number | null;
  amount: number; // minor units
  currency: string;
  billing_day: number;
  cycle: 'monthly' | 'yearly';
  trial_ends_on?: string | null;
  status: 'active' | 'cancelled' | 'trial';
  icon_key: string;
  category_id?: number | null;
  category_name?: string | null;
  last_renewed_at?: string | null;
  created_at: string;
  next_renewal_date: string;
  days_until_renewal: number;
  is_renewing_soon: boolean;
  is_renewing_today: boolean;
  is_trial: boolean;
  trial_days_remaining?: number | null;
}

export interface SubscriptionAlert {
  id: number;
  name: string;
  amount: number;
  currency: string;
  days_until_renewal: number;
  is_renewing_today: boolean;
  is_trial: boolean;
  trial_days_remaining?: number | null;
  icon_key: string;
}

export interface SubscriptionsResponse {
  summary: {
    monthly_total: number;
    yearly_total: number;
    active_count: number;
  };
  upcoming_alerts: SubscriptionAlert[];
  subscriptions: UserSubscription[];
}

export interface FoodVendor {
  id: number;
  name: string;
  location?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  icon_key: string;
  item_count: number;
  min_price: number;
  max_price: number;
}

export interface CheaperOption {
  item_id?: number;
  dish_name?: string;
  vendor_name?: string;
  price?: number;
  savings?: number;
  is_best_price?: boolean;
  competing_vendors_count?: number;
  competitor_name?: string;
  savings_vs_competitor?: number;
}

export interface MenuItem {
  id: number;
  vendor_id: number | null;
  vendor_name?: string | null;
  vendor_location?: string | null;
  vendor_icon?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  name: string;
  price: number;
  currency: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  is_provisions: boolean;
  category?: string | null;
  stock_quantity?: number;
  unit?: string;
  created_at?: string;
  cheaper_option?: CheaperOption | null;
}

export interface ProvisionsSummaryResponse {
  items: MenuItem[];
  total_items_count: number;
  total_units_in_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_savings_minor: number;
  month_savings_minor: number;
  week_savings_minor: number;
  meals_eaten: number;
  benchmark_per_meal?: number;
  recent_restocks: {
    id: number;
    amount: number;
    note: string;
    occurred_at: string;
    currency: string;
  }[];
  recent_logs: {
    id: number;
    item_name: string;
    quantity: number;
    estimated_savings: number;
    consumed_at: string;
  }[];
}

export interface MealPlan {
  id: number;
  plan_date: string;
  meal_time: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'treat' | string;
  menu_item_id?: number | null;
  item_name?: string | null;
  item_price?: number | null;
  custom_item_name?: string | null;
  is_provisions_stash: boolean;
  estimated_price: number;
  is_logged: boolean;
  transaction_id?: number | null;
  vendor_name?: string | null;
  category_name?: string | null;
}

export interface MealPlanResponse {
  from: string;
  to: string;
  summary: {
    total_estimated: number;
    provisions_meals_count: number;
    paid_meals_count: number;
    total_meals: number;
  };
  plans: MealPlan[];
}

export const TAB_SESSION_KEY = 'vtrack_tab_session_token';

export function getTabSessionToken(): string | null {
  try {
    return sessionStorage.getItem(TAB_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setTabSessionToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TAB_SESSION_KEY, token);
    } else {
      sessionStorage.removeItem(TAB_SESSION_KEY);
    }
  } catch (err) {
    console.error('Failed to update tab session token:', err);
  }
}

const BASE_URL = (((import.meta as any).env?.VITE_API_URL as string) || '').replace(/\/$/, '');

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const tabToken = getTabSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(tabToken ? { 'x-session-token': tabToken } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    credentials: 'include',
    headers,
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data?.error?.message || 'An error occurred. Please try again.';
    const err = new Error(errorMsg);
    (err as any).data = data;
    (err as any).status = res.status;
    throw err;
  }

  return data as T;
}
