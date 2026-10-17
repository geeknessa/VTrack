import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Utensils,
  Plus,
  Search,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShoppingBag,
  Coffee,
  Store,
  Trash2,
  Edit2,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowLeft,
  Wallet,
  Lightbulb,
  RefreshCw,
  Minus,
  Package,
  Coins,
  ShieldCheck,
  AlertTriangle,
  UtensilsCrossed,
  MapPin,
  Sandwich,
  Soup,
  CookingPot,
  Beef,
  Cookie,
  CupSoda,
  Croissant,
  Gift,
  Flame,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchApi,
  FoodVendor,
  MenuItem,
  MealPlan,
  MealPlanResponse,
  ActiveBudgetResponse,
  ProvisionsSummaryResponse,
} from '../api/client';
import { CoinBuddy } from '../components/CoinBuddy';
import { MenuDigitizerModal } from '../components/MenuDigitizerModal';

export interface SpoilYourselfResponse {
  budget_cushion: number;
  weekly_cushion: number;
  daily_limit: number;
  weekly_limit: number;
  today_spent: number;
  weekly_spent: number;
  is_budget_safe: boolean;
  treats: MenuItem[];
}

export interface FoodCategoryDef {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}

export const FOOD_CATEGORIES: FoodCategoryDef[] = [
  { key: 'Shawarma & Wraps', label: 'Shawarma & Wraps', shortLabel: 'Shawarma', icon: Sandwich, iconBg: 'bg-amber-500/10 text-amber-500' },
  { key: 'Rice Dishes', label: 'Rice Dishes', shortLabel: 'Rice', icon: Soup, iconBg: 'bg-orange-500/10 text-orange-500' },
  { key: 'Pasta & Noodles', label: 'Pasta & Noodles', shortLabel: 'Pasta', icon: CookingPot, iconBg: 'bg-rose-500/10 text-rose-500' },
  { key: 'Burgers & Sandwiches', label: 'Burgers & Sandwiches', shortLabel: 'Burgers', icon: Sandwich, iconBg: 'bg-yellow-500/10 text-yellow-500' },
  { key: 'Wings & Proteins', label: 'Wings & Proteins', shortLabel: 'Proteins', icon: Beef, iconBg: 'bg-red-500/10 text-red-500' },
  { key: 'Extras & Sides', label: 'Extras & Sides', shortLabel: 'Extras', icon: Cookie, iconBg: 'bg-emerald-500/10 text-emerald-500' },
  { key: 'Drinks & Refreshers', label: 'Drinks & Refreshers', shortLabel: 'Drinks', icon: CupSoda, iconBg: 'bg-cyan-500/10 text-cyan-500' },
  { key: 'Pastries & Snacks', label: 'Pastries & Snacks', shortLabel: 'Pastries', icon: Croissant, iconBg: 'bg-pink-500/10 text-pink-500' },
  { key: 'Provisions & Stash', label: 'Provisions & Stash', shortLabel: 'Provisions', icon: ShoppingBag, iconBg: 'bg-blue-500/10 text-blue-500' },
  { key: 'Specialties & Others', label: 'Specialties & Others', shortLabel: 'Specialties', icon: UtensilsCrossed, iconBg: 'bg-purple-500/10 text-purple-500' },
];

export function getItemCategory(item: MenuItem): string {
  if (item.category) return item.category;
  if (item.is_provisions) return 'Provisions & Stash';
  const lower = (item.name || '').toLowerCase();

  // Shawarma & Wraps
  if (/shawarma|wrap|quesadilla|burrito|taco|fajita/i.test(lower)) return 'Shawarma & Wraps';

  // Rice Dishes
  if (/rice|jollof|ofada|ayamase/i.test(lower)) return 'Rice Dishes';

  // Pasta & Noodles
  if (/pasta|spaghetti|ghetti|noodles|noodle|macaroni|alfredo|indomie|ramen|lasagna|bolognese/i.test(lower)) return 'Pasta & Noodles';

  // Burgers & Sandwiches
  if (/burger|sandwich|toast|hotdog|hot dog|chilli dog|panini|sub\b/i.test(lower)) return 'Burgers & Sandwiches';

  // Drinks & Refreshers
  if (/smoothie|shake|milkshake|juice|drink|water|coke|fanta|sprite|pepsi|boba|tea|coffee|malt|zobo|chapman|soda|capri|berryblast|pulpy|schweppes|can\b|bottle|frappe|latte|macchiato|lemonade|cappuccino|espresso|mocha|slush|slushie|slushy|mojito|nutrimilk|smoove|yogurt|fura|kunu|lacasera|five alive|mirinda|teem|energy|red bull|predator|frappuccino/i.test(lower)) return 'Drinks & Refreshers';

  // Pastries & Snacks
  if (/pie|roll|doughnut|donut|cake|waffle|pancake|akara|pap\b|croissant|chin chin|biscuit|pastry|puff|samosa|spring roll|ice cream|cotton candy|popcorn|muffin|chops/i.test(lower)) return 'Pastries & Snacks';

  // Wings & Proteins
  if (/wing|chicken|beef|turkey|fish|meat|asun|suya|gizzard|pork|bbq|ribs|steak|calamari|prawn|shrimp|seafood|liver|goat|kpomo/i.test(lower)) return 'Wings & Proteins';

  // Extras & Sides
  if (/fries|chips|plantain|plaintain|dodo|coleslaw|salad|extra|xtra|portion|topping|ketchup|mayo|dip|syrup|moi moi|moimoi|egg|sausage|sauce|yam|masa|dan wake|semovita|poundo|eba|fufu|garri|bread|beans|ewa|wedges/i.test(lower)) return 'Extras & Sides';

  return 'Specialties & Others';
}

function formatMoney(amountMinor: number, currency: string = 'NGN'): string {
  const major = amountMinor / 100;
  const symbol = currency === 'NGN' ? '₦' : currency + ' ';
  return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major)}`;
}

export const FoodMenus: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuth();
  const currency = settings?.home_currency || 'NGN';

  const [activeTab, setActiveTab] = useState<'menus' | 'planner'>('menus');
  const [selectedHub, setSelectedHub] = useState<'food_court' | 'outside' | 'provisions' | 'all'>('food_court');
  const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
  const [showAllDishesInHub, setShowAllDishesInHub] = useState(false);
  const [priceTierFilter, setPriceTierFilter] = useState<'all' | 'under_2k' | '2k_to_4k' | 'above_4k' | 'provisions'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const weekScheduleScrollRef = useRef<HTMLDivElement>(null);

  // Multi-dish meal combo selection (e.g. 1, 2, 3, or 4 dishes)
  const [selectedDishIds, setSelectedDishIds] = useState<number[]>([]);

  // Manual Add/Edit Dish Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPriceStr, setItemPriceStr] = useState('');
  const [itemVendorId, setItemVendorId] = useState<number | null>(null);
  const [itemMealType, setItemMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [itemIsProvisions, setItemIsProvisions] = useState(false);
  const [itemCategory, setItemCategory] = useState<string>('');
  const [itemStockQuantity, setItemStockQuantity] = useState('0');
  const [itemUnit, setItemUnit] = useState('items');

  // Menu Digitizer (Gemini Vision AI) State
  const [isDigitizerOpen, setIsDigitizerOpen] = useState(false);
  const [digitizerInitialVendorId, setDigitizerInitialVendorId] = useState<number | null>(null);
  const [digitizerInitialCategory, setDigitizerInitialCategory] = useState<'food_court' | 'outside' | 'provisions'>('food_court');

  // Provisions & Stash Inventory States
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [restockAmountStr, setRestockAmountStr] = useState('');
  const [restockNote, setRestockNote] = useState('');
  const [restockDate, setRestockDate] = useState(new Date().toISOString().split('T')[0]);
  const [restockStockDeltas, setRestockStockDeltas] = useState<Record<number, number>>({});
  const [isRestockAddNewOpen, setIsRestockAddNewOpen] = useState(false);
  const [restockNewItemName, setRestockNewItemName] = useState('');
  const [restockNewItemQty, setRestockNewItemQty] = useState('1');
  const [restockNewItemUnit, setRestockNewItemUnit] = useState('packs');
  const [newTripItems, setNewTripItems] = useState<{ name: string; quantity: number; unit: string; meal_type: string }[]>([]);

  // Quick Add Stash Item Modal
  const [isAddStashModalOpen, setIsAddStashModalOpen] = useState(false);
  const [stashItemName, setStashItemName] = useState('');
  const [stashItemQty, setStashItemQty] = useState('5');
  const [stashItemUnit, setStashItemUnit] = useState('packs');
  const [stashItemMealType, setStashItemMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');

  // Stash direct count editing state
  const [editingStockItemId, setEditingStockItemId] = useState<number | null>(null);
  const [editingStockInput, setEditingStockInput] = useState('');

  // Stash search & filter
  const [stashSearchQuery, setStashSearchQuery] = useState('');
  const [stashStatusFilter, setStashStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Inline Price Editing (edit directly in the row without opening modal)
  const [editingPriceItemId, setEditingPriceItemId] = useState<number | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');

  // Add / Edit Spot Modal
  const [isSpotModalOpen, setIsSpotModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<FoodVendor | null>(null);
  const [spotName, setSpotName] = useState('');
  const [spotLocation, setSpotLocation] = useState('');
  const [spotCategory, setSpotCategory] = useState<'food_court' | 'outside' | 'provisions'>('food_court');

  // Delete Spot Confirmation Modal
  const [isDeleteSpotModalOpen, setIsDeleteSpotModalOpen] = useState(false);
  const [spotToDelete, setSpotToDelete] = useState<FoodVendor | null>(null);

  // Meal Planner Week Navigation
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Helper to format local date YYYY-MM-DD without UTC timezone distortion
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate Monday to Sunday of currently viewed week
  const getWeekRange = (offset: number) => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + offset * 7);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return {
      monday,
      sunday,
      fromStr: formatLocalDate(monday),
      toStr: formatLocalDate(sunday),
    };
  };
  const weekRange = getWeekRange(currentWeekOffset);

  // Collapsible Weekly Meals Breakdown Accordion State
  const [isWeekSummaryOpen, setIsWeekSummaryOpen] = useState(false);

  // Plan Selected Dishes Modal State (from Menu items catalog)
  const [isPlanSelectedModalOpen, setIsPlanSelectedModalOpen] = useState(false);
  const [planSelectedDate, setPlanSelectedDate] = useState('');
  const [planSelectedMealTime, setPlanSelectedMealTime] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');

  // Smart Meal Suggestion & Anti-Repetition State
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestTargetDate, setSuggestTargetDate] = useState<string>('');
  const [suggestTargetMealTime, setSuggestTargetMealTime] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner');
  const [suggestTargetSlotLabel, setSuggestTargetSlotLabel] = useState<string>('Evening Meal');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isManualPickerMode, setIsManualPickerMode] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  // Spoil Yourself / Weekend Reward Treat State
  const [isSpoilModalOpen, setIsSpoilModalOpen] = useState(false);
  const [spoilTargetDate, setSpoilTargetDate] = useState<string>('');
  const [spoilCategory, setSpoilCategory] = useState<string>('all');
  const [spoilSearch, setSpoilSearch] = useState<string>('');
  const [isCustomDeliveryMode, setIsCustomDeliveryMode] = useState<boolean>(false);
  const [customDeliveryDish, setCustomDeliveryDish] = useState<string>('');
  const [customDeliveryVendor, setCustomDeliveryVendor] = useState<string>('');
  const [customDeliveryPriceStr, setCustomDeliveryPriceStr] = useState<string>('');

  // Hub membership helper
  const isVendorInHub = (v: FoodVendor, hub: 'food_court' | 'outside' | 'provisions' | 'all') => {
    if (hub === 'all') return true;
    const catName = (v.category_name || '').toLowerCase();
    const loc = (v.location || '').toLowerCase();
    const name = v.name.toLowerCase();
    if (hub === 'food_court') {
      return (
        catName.includes('food court') ||
        loc.includes('campus') ||
        loc.includes('food court') ||
        name.includes('zulky') ||
        name.includes('street food') ||
        name.includes('quintavi') ||
        name.includes('w sauce') ||
        name.includes('yammy') ||
        name.includes('pizza') ||
        name.includes('papa rimz') ||
        name.includes('paparimz') ||
        name.includes('jaj') ||
        name.includes('dot') ||
        name.includes('cherry') ||
        name.includes('chops') ||
        name.includes('11:29') ||
        name.includes('eleven')
      );
    }
    if (hub === 'outside') {
      return catName.includes('outside') || loc.includes('off-campus') || loc.includes('delivery');
    }
    if (hub === 'provisions') {
      return catName.includes('provision') || loc.includes('stash') || name.includes('stash') || name.includes('provision');
    }
    return true;
  };

  // Fetch Vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['menus', 'vendors'],
    queryFn: () => fetchApi<{ vendors: FoodVendor[] }>('/api/menus/vendors'),
  });

  const vendors = vendorsData?.vendors || [];
  const hubVendors = vendors.filter(v => isVendorInHub(v, selectedHub));
  const activeVendor = vendors.find(v => v.id === activeVendorId) || null;

  // Active Budget Query (to check if meals fit within daily allowance)
  const { data: budgetData } = useQuery({
    queryKey: ['budgets', 'active'],
    queryFn: () => fetchApi<ActiveBudgetResponse>('/api/budgets/active'),
  });
  const activeBudget = budgetData?.budget;

  // Effective vendor ID for fetching menu items
  // Effective vendor ID for fetching menu items
  const effectiveVendorId = activeVendorId;

  // Hub-filtered vendor IDs if a hub is chosen without a single vendor
  const hubVendorIds = useMemo(() => {
    if (activeVendorId || selectedHub === 'all') return undefined;
    return vendors.filter(v => isVendorInHub(v, selectedHub)).map(v => v.id);
  }, [activeVendorId, selectedHub, vendors]);

  const hubVendorIdsKey = hubVendorIds ? hubVendorIds.join(',') : '';

  // Fetch Menu Items in Chunks (with Infinite Query & Load More)
  const {
    data: itemsInfiniteData,
    isLoading: itemsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'menus',
      'items',
      {
        vendorId: effectiveVendorId,
        hubVendorIds: hubVendorIdsKey,
        category: selectedCategory,
        priceTier: priceTierFilter,
        search: searchQuery.trim(),
      },
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (effectiveVendorId) {
        params.set('vendor_id', effectiveVendorId.toString());
      } else if (hubVendorIdsKey) {
        params.set('vendor_ids', hubVendorIdsKey);
      }
      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (priceTierFilter && priceTierFilter !== 'all') {
        params.set('price_tier', priceTierFilter);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      params.set('limit', '24');
      params.set('offset', pageParam.toString());

      return fetchApi<{
        items: MenuItem[];
        pagination: {
          total: number;
          limit: number;
          offset: number;
          has_more: boolean;
          next_offset: number;
        };
        category_counts?: Record<string, number>;
      }>(`/api/menus/items?${params.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination?.has_more ? lastPage.pagination.next_offset : undefined;
    },
  });

  const rawItems = useMemo(() => {
    return itemsInfiniteData?.pages.flatMap((page) => page.items) || [];
  }, [itemsInfiniteData]);

  const totalMatchingDishes = itemsInfiniteData?.pages[0]?.pagination?.total ?? rawItems.length;
  const backendCategoryCounts = itemsInfiniteData?.pages[0]?.category_counts || {};

  // All returned items already match vendor, hub, price tier, and category from the server
  const items = rawItems;

  // Category counts for pills (scoped across active vendor/hub/search/price filters)
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    if (Object.keys(backendCategoryCounts).length > 0) {
      Object.entries(backendCategoryCounts).forEach(([cat, count]) => {
        counts.set(cat, count);
      });
      return counts;
    }
    items.forEach((item) => {
      const cat = getItemCategory(item);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return counts;
  }, [backendCategoryCounts, items]);

  // Fetch Menu Items on-demand for manual dish picker in meal planner modal
  const { data: manualSearchData, isLoading: manualSearchLoading } = useQuery({
    queryKey: ['menus', 'manual-picker-items', manualSearch],
    queryFn: () => {
      const p = new URLSearchParams();
      if (manualSearch.trim()) p.set('search', manualSearch.trim());
      p.set('limit', '50');
      return fetchApi<{ items: MenuItem[] }>(`/api/menus/items?${p.toString()}`);
    },
    enabled: isSuggestModalOpen && isManualPickerMode,
  });
  const manualPickerItems = manualSearchData?.items || [];

  // Fetch Provisions Summary & Stock
  const { data: provisionsSummaryData } = useQuery({
    queryKey: ['menus', 'provisions-summary'],
    queryFn: () => fetchApi<ProvisionsSummaryResponse>('/api/menus/provisions/summary'),
  });
  const provisionsSummary = provisionsSummaryData;
  const stashItems = provisionsSummary?.items || [];
  const mealBenchmark = provisionsSummary?.benchmark_per_meal || 200000;

  // Fetch Spoil Yourself Indulgence Data & Live Cushion
  const { data: spoilData, isLoading: spoilLoading } = useQuery({
    queryKey: ['menus', 'spoil-yourself'],
    queryFn: () => fetchApi<SpoilYourselfResponse>('/api/menus/spoil-yourself'),
  });

  const filteredStashItems = useMemo(() => {
    return stashItems.filter((item) => {
      if (stashSearchQuery.trim()) {
        const q = stashSearchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      const qty = item.stock_quantity ?? 0;
      if (stashStatusFilter === 'in_stock' && qty <= 0) return false;
      if (stashStatusFilter === 'low_stock' && (qty <= 0 || qty > 2)) return false;
      if (stashStatusFilter === 'out_of_stock' && qty > 0) return false;
      return true;
    });
  }, [stashItems, stashSearchQuery, stashStatusFilter]);

  // Group items by category for the "all" view
  const groupedCategorySections = useMemo(() => {
    const list: { def: FoodCategoryDef; items: MenuItem[] }[] = [];
    FOOD_CATEGORIES.forEach(def => {
      const catItems = items.filter(it => getItemCategory(it) === def.key);
      if (catItems.length > 0) {
        list.push({ def, items: catItems });
      }
    });

    const knownKeys = new Set(FOOD_CATEGORIES.map(c => c.key));
    const extraItems = items.filter(it => !knownKeys.has(getItemCategory(it)));
    if (extraItems.length > 0) {
      list.push({
        def: {
          key: 'Specialties & Others',
          label: 'Specialties & Others',
          shortLabel: 'Specialties',
          icon: UtensilsCrossed,
          iconBg: 'bg-purple-500/10 text-purple-500',
        },
        items: extraItems,
      });
    }

    return list;
  }, [items]);

  // Selected dishes for multi-dish evening feast / combo
  const [selectedDishesMap, setSelectedDishesMap] = useState<Map<number, MenuItem>>(new Map());

  const toggleDishSelection = (id: number, item?: MenuItem) => {
    setSelectedDishIds(prev => {
      const exists = prev.includes(id);
      setSelectedDishesMap(map => {
        const next = new Map(map);
        if (exists) {
          next.delete(id);
        } else {
          const found = item || rawItems.find(it => it.id === id);
          if (found) next.set(id, found);
        }
        return next;
      });
      return exists ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  const selectedDishes = useMemo(() => {
    return selectedDishIds
      .map(id => selectedDishesMap.get(id) || rawItems.find(it => it.id === id))
      .filter((it): it is MenuItem => Boolean(it));
  }, [selectedDishIds, selectedDishesMap, rawItems]);

  const selectedTotal = selectedDishes.reduce((sum, it) => sum + it.price, 0);

  // Fetch Meal Plans
  const { data: plansData } = useQuery({
    queryKey: ['menus', 'meal-plans', weekRange.fromStr, weekRange.toStr],
    queryFn: () =>
      fetchApi<MealPlanResponse>(`/api/menus/meal-plans?from=${weekRange.fromStr}&to=${weekRange.toStr}`),
  });

  const plans = plansData?.plans || [];
  const planSummary = plansData?.summary || {
    total_estimated: 0,
    provisions_meals_count: 0,
    paid_meals_count: 0,
    total_meals: 0,
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mutations
  const saveSingleItemMutation = useMutation({
    mutationFn: (body: any) => {
      if (editingItem) {
        return fetchApi(`/api/menus/items/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return fetchApi('/api/menus/items', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      closeItemModal();
      showToast(editingItem ? 'Item updated!' : 'New dish added!');
    },
  });

  const quickUpdatePriceMutation = useMutation({
    mutationFn: ({ id, price }: { id: number; price: number }) =>
      fetchApi(`/api/menus/items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ price }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      setEditingPriceItemId(null);
      showToast('Price updated!');
    },
  });

  const handleSaveInlinePrice = (itemId: number) => {
    const val = parseFloat(inlinePriceInput);
    const minor = isNaN(val) ? 0 : Math.max(0, Math.round(val * 100));
    quickUpdatePriceMutation.mutate({ id: itemId, price: minor });
  };

  const handleSaveInlineStock = (itemId: number) => {
    const val = parseInt(editingStockInput, 10);
    const qty = isNaN(val) ? 0 : Math.max(0, val);
    adjustStockMutation.mutate({ id: itemId, quantity: qty });
  };

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/menus/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      showToast('Item deleted.');
    },
  });

  const createSpotMutation = useMutation({
    mutationFn: (body: any) => fetchApi('/api/menus/vendors', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus', 'vendors'] });
      setIsSpotModalOpen(false);
      setEditingSpot(null);
      setSpotName('');
      setSpotLocation('');
      showToast('Food spot added!');
      if (data?.vendor?.id) {
        setActiveVendorId(data.vendor.id);
      }
    },
  });

  const editSpotMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      fetchApi(`/api/menus/vendors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus', 'vendors'] });
      setIsSpotModalOpen(false);
      setEditingSpot(null);
      setSpotName('');
      setSpotLocation('');
      showToast('Food spot updated!');
    },
  });

  const deleteSpotMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/menus/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      setIsDeleteSpotModalOpen(false);
      if (spotToDelete && activeVendorId === spotToDelete.id) {
        setActiveVendorId(null);
      }
      setSpotToDelete(null);
      showToast('Food spot deleted.');
    },
  });

  // Modal open/close helpers
  const openAddSpot = (cat?: 'food_court' | 'outside' | 'provisions') => {
    setEditingSpot(null);
    setSpotName('');
    setSpotLocation('');
    setSpotCategory(cat || (selectedHub === 'provisions' ? 'provisions' : selectedHub === 'outside' ? 'outside' : 'food_court'));
    setIsSpotModalOpen(true);
  };

  const openEditSpot = (v: FoodVendor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSpot(v);
    setSpotName(v.name);
    setSpotLocation(v.location || '');
    const catLower = (v.category_name || '').toLowerCase();
    let cat: 'food_court' | 'outside' | 'provisions' = 'food_court';
    if (catLower.includes('outside') || (v.location || '').toLowerCase().includes('off-campus')) {
      cat = 'outside';
    } else if (catLower.includes('provision') || v.name.toLowerCase().includes('stash')) {
      cat = 'provisions';
    }
    setSpotCategory(cat);
    setIsSpotModalOpen(true);
  };

  const confirmDeleteSpot = (v: FoodVendor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSpotToDelete(v);
    setIsDeleteSpotModalOpen(true);
  };

  const openAddItem = (defaultVendorId?: number, defaultMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setEditingItem(null);
    setItemName('');
    setItemPriceStr('');
    setItemVendorId(defaultVendorId || (activeVendorId || vendors[0]?.id || null));
    setItemMealType(defaultMealType || 'lunch');
    setItemIsProvisions(selectedHub === 'provisions');
    setItemCategory(selectedCategory !== 'all' ? selectedCategory : (selectedHub === 'provisions' ? 'Provisions & Stash' : ''));
    setItemStockQuantity('5');
    setItemUnit('packs');
    setIsItemModalOpen(true);
  };

  const openDigitizer = (defaultVendorId?: number | null, cat?: 'food_court' | 'outside' | 'provisions') => {
    setDigitizerInitialVendorId(defaultVendorId !== undefined ? defaultVendorId : (activeVendorId || null));
    setDigitizerInitialCategory(cat || (selectedHub === 'outside' ? 'outside' : selectedHub === 'provisions' ? 'provisions' : 'food_court'));
    setIsDigitizerOpen(true);
  };

  const handleDigitizerSave = async (digitizedItems: any[], vendorId: number | null) => {
    try {
      await fetchApi('/api/menus/items', {
        method: 'POST',
        body: JSON.stringify({ items: digitizedItems, vendor_id: vendorId }),
      });
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      showToast(`Saved ${digitizedItems.length} dishes to menu!`);
      setIsDigitizerOpen(false);
    } catch (err: any) {
      console.error('Failed to save digitized menu items:', err);
      showToast(err.message || 'Failed to save menu items.');
      throw err;
    }
  };

  // Stock Adjustment Mutation (+ / - delta or direct count)
  const adjustStockMutation = useMutation({
    mutationFn: ({ id, delta, quantity }: { id: number; delta?: number; quantity?: number }) =>
      fetchApi<any>(`/api/menus/items/${id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ delta, quantity }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['menus', 'provisions-summary'] });
      setEditingStockItemId(null);
      if (data?.item?.name) {
        showToast(`${data.item.name} stock: ${data.item.stock_quantity} ${data.item.unit || 'left'}`);
      }
    },
  });

  // Provisions Restock Expense Mutation (records transaction & updates stock)
  const restockExpenseMutation = useMutation({
    mutationFn: (body: any) =>
      fetchApi('/api/menus/provisions/restock', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['menus', 'provisions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      setIsRestockModalOpen(false);
      setRestockAmountStr('');
      setRestockNote('');
      setRestockStockDeltas({});
      setNewTripItems([]);
      showToast(data.message || 'Provisions restock recorded!');
    },
  });

  // 1-Tap Log Expense Mutation
  const logExpenseMutation = useMutation({
    mutationFn: (itemId: number) => fetchApi<any>(`/api/menus/items/${itemId}/log-expense`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['menus', 'provisions-summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      showToast(data.message || 'Meal logged to expenses!');
    },
  });

  // 1-Tap Log Multi-Dish Meal Order Mutation
  const logComboMutation = useMutation({
    mutationFn: async (itemIds: number[]) => {
      for (const id of itemIds) {
        await fetchApi(`/api/menus/items/${id}/log-expense`, { method: 'POST' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      showToast(`Logged ${selectedDishIds.length} dishes to expenses!`);
      setSelectedDishIds([]);
    },
  });

  // Plan Meal Mutation
  const planMealMutation = useMutation({
    mutationFn: (body: any) => fetchApi('/api/menus/meal-plans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      showToast('Meal planned successfully!');
    },
  });

  // Handle Planning Combo of Selected Dishes from Menu Catalog
  const handlePlanSelectedCombo = () => {
    if (selectedDishIds.length === 0) return;
    const names = selectedDishes.map((d) => d.name).join(' + ');
    const hasProvisions = selectedDishes.every((d) => d.is_provisions || d.price === 0);
    planMealMutation.mutate({
      plan_date: planSelectedDate || formatLocalDate(new Date()),
      meal_time: planSelectedMealTime,
      menu_item_id: selectedDishIds.length === 1 ? selectedDishIds[0] : null,
      custom_item_name: names,
      estimated_price: selectedTotal,
      is_provisions_stash: hasProvisions,
    });
    setIsPlanSelectedModalOpen(false);
    setSelectedDishIds([]);
    setActiveTab('planner');
    showToast(`Added "${names}" to Meal Planner!`);
  };

  // Log Planned Meal Mutation
  const logPlanExpenseMutation = useMutation({
    mutationFn: (planId: number) => fetchApi(`/api/menus/meal-plans/${planId}/log-expense`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      showToast(data.message || 'Meal logged to expenses!');
    },
  });

  // Delete Planned Meal
  const deletePlanMutation = useMutation({
    mutationFn: (planId: number) => fetchApi(`/api/menus/meal-plans/${planId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      showToast('Planned meal removed.');
    },
  });

  // Smart Suggestion Mutation & Handlers
  const autoPlanWeekMutation = useMutation({
    mutationFn: (body: { start_date: string; budget_per_day?: number }) =>
      fetchApi<{ message: string; plans: any[] }>('/api/menus/auto-plan-week', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      showToast(data.message || 'Smart 7-day budget meal plan generated!');
    },
  });

  const fetchSuggestions = async (dateStr: string, mealTime: string) => {
    setIsLoadingSuggestions(true);
    try {
      const dailyBudget = activeBudget?.daily?.remaining || activeBudget?.daily?.limit || (mealBenchmark ? mealBenchmark * 2 : 0);
      const url = dailyBudget > 0
        ? `/api/menus/smart-suggestions?target_date=${dateStr}&meal_time=${mealTime}&budget_limit=${dailyBudget}`
        : `/api/menus/smart-suggestions?target_date=${dateStr}&meal_time=${mealTime}`;
      const res = await fetchApi<{ suggestions: any[] }>(url);
      setSuggestions(res.suggestions || []);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const openSmartSuggestModal = (dateStr: string, mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack', label: string) => {
    setSuggestTargetDate(dateStr);
    setSuggestTargetMealTime(mealTime);
    setSuggestTargetSlotLabel(label);
    setIsManualPickerMode(false);
    setManualSearch('');
    setIsSuggestModalOpen(true);
    fetchSuggestions(dateStr, mealTime);
  };

  const applySuggestion = (item: any) => {
    planMealMutation.mutate({
      plan_date: suggestTargetDate,
      meal_time: suggestTargetMealTime,
      menu_item_id: item.id,
      custom_item_name: item.name,
      estimated_price: item.price,
      is_provisions_stash: item.is_provisions,
    });
    setIsSuggestModalOpen(false);
  };

  const openSpoilModal = (targetDate?: string) => {
    if (targetDate) {
      setSpoilTargetDate(targetDate);
    } else {
      const sat = new Date(weekRange.monday);
      sat.setDate(sat.getDate() + 5);
      setSpoilTargetDate(formatLocalDate(sat));
    }
    setSpoilCategory('all');
    setSpoilSearch('');
    setIsCustomDeliveryMode(false);
    setIsSpoilModalOpen(true);
  };

  const planTreatDish = (item: MenuItem) => {
    planMealMutation.mutate({
      plan_date: spoilTargetDate || formatLocalDate(new Date()),
      meal_time: 'treat',
      menu_item_id: item.id,
      custom_item_name: item.name,
      estimated_price: item.price,
      is_provisions_stash: false,
    });
    setIsSpoilModalOpen(false);
    showToast(`Added ${item.name} to Weekend Treat schedule!`);
  };

  const logTreatDirectlyMutation = useMutation({
    mutationFn: (itemId: number) => fetchApi(`/api/menus/items/${itemId}/log-expense`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      showToast(data?.message || 'Treat logged to expenses! Enjoy your reward.');
      setIsSpoilModalOpen(false);
    },
  });

  const handlePlanCustomOnlineTreat = async (logDirectly: boolean = false) => {
    if (!customDeliveryDish.trim()) {
      showToast('Please enter a dish name.');
      return;
    }
    const priceMinor = Math.round((parseFloat(customDeliveryPriceStr) || 0) * 100);
    const vendorLabel = customDeliveryVendor.trim() ? ` (${customDeliveryVendor.trim()})` : '';
    const fullName = `${customDeliveryDish.trim()}${vendorLabel}`;
    const targetDate = spoilTargetDate || formatLocalDate(new Date());

    try {
      if (logDirectly) {
        const res = await fetchApi<{ plan: MealPlan }>('/api/menus/meal-plans', {
          method: 'POST',
          body: JSON.stringify({
            plan_date: targetDate,
            meal_time: 'treat',
            custom_item_name: fullName,
            estimated_price: priceMinor,
            is_provisions_stash: false,
          }),
        });
        if (res?.plan?.id) {
          logPlanExpenseMutation.mutate(res.plan.id);
        }
      } else {
        planMealMutation.mutate({
          plan_date: targetDate,
          meal_time: 'treat',
          custom_item_name: fullName,
          estimated_price: priceMinor,
          is_provisions_stash: false,
        });
      }
      setIsSpoilModalOpen(false);
      setCustomDeliveryDish('');
      setCustomDeliveryVendor('');
      setCustomDeliveryPriceStr('');
    } catch (err) {
      console.error('Failed to plan custom delivery treat:', err);
      showToast('Failed to save treat plan.');
    }
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemPriceStr((item.price / 100).toString());
    setItemVendorId(item.vendor_id);
    setItemMealType(item.meal_type as any);
    setItemIsProvisions(item.is_provisions);
    setItemCategory(item.category || getItemCategory(item));
    setItemStockQuantity(item.stock_quantity !== undefined ? item.stock_quantity.toString() : '0');
    setItemUnit(item.unit || 'items');
    setIsItemModalOpen(true);
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemCategory('');
    setItemStockQuantity('0');
    setItemUnit('items');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    const numPrice = itemIsProvisions ? 0 : Math.round((parseFloat(itemPriceStr) || 0) * 100);
    saveSingleItemMutation.mutate({
      name: itemName.trim(),
      price: numPrice,
      vendor_id: itemVendorId,
      meal_type: itemMealType,
      is_provisions: itemIsProvisions || numPrice === 0,
      category: itemCategory || undefined,
      stock_quantity: itemIsProvisions ? Math.max(0, parseInt(itemStockQuantity, 10) || 0) : undefined,
      unit: itemIsProvisions ? (itemUnit.trim() || 'items') : undefined,
      currency: 'NGN',
    });
  };

  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(restockAmountStr);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid expense amount');
      return;
    }
    const minorAmount = Math.round(val * 100);
    const stock_updates = Object.entries(restockStockDeltas)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ item_id: parseInt(id, 10), add_quantity: qty }));

    restockExpenseMutation.mutate({
      amount: minorAmount,
      currency: 'NGN',
      note: restockNote.trim() || 'Hostel Provisions Restock',
      occurred_at: restockDate ? new Date(restockDate).toISOString() : new Date().toISOString(),
      stock_updates,
      new_items: newTripItems,
    });
  };

  const handleSaveStashItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stashItemName.trim()) return;
    const qty = parseInt(stashItemQty, 10) || 0;
    saveSingleItemMutation.mutate({
      name: stashItemName.trim(),
      price: 0,
      currency: 'NGN',
      meal_type: stashItemMealType,
      is_provisions: true,
      category: 'Provisions & Stash',
      stock_quantity: Math.max(0, qty),
      unit: stashItemUnit || 'packs',
    });
    setIsAddStashModalOpen(false);
    setStashItemName('');
    setStashItemQty('5');
  };

  // Generate 7 days for the weekly planner
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekRange.monday.getFullYear(), weekRange.monday.getMonth(), weekRange.monday.getDate() + i);
    const dateStr = formatLocalDate(d);
    const isToday = formatLocalDate(new Date()) === dateStr;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMonth = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { dateStr, dayName, dayMonth, isToday };
  });

  // Render single dish card (used in both grouped sections and single category views)
  const renderDishCard = (item: MenuItem) => {
    const isSelected = selectedDishIds.includes(item.id);

    return (
      <div
        key={item.id}
        className={`p-3 sm:p-3.5 rounded-2xl bg-surface border transition-all flex items-center justify-between gap-2.5 group shadow-xs ${isSelected
          ? 'bg-accent-soft/30 border-accent shadow-sm ring-1 ring-accent/30'
          : 'border-border hover:border-accent/40 hover:bg-bg/40'
          }`}
      >
        {/* Left: Combo Checkbox + Food Item Name + Price BESIDE it + Category Badge */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => toggleDishSelection(item.id)}
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors btn-tap ${isSelected
              ? 'bg-accent border-accent text-white shadow-xs'
              : 'border-border bg-surface hover:border-accent text-transparent'
              }`}
            title={isSelected ? 'Remove from meal order' : 'Add to meal order'}
          >
            <Check className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Food Item Name */}
            <h4 className="font-heading font-black text-text-main text-xs sm:text-sm">
              {item.name}
            </h4>

            {/* Price / Amount BESIDE Food Item (Never under!) - 1-Tap Inline Number Edit */}
            {item.is_provisions ? (
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className="font-heading font-black font-tabular text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  ₦0
                </span>
                <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-1.5 py-0.5 text-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustStockMutation.mutate({ id: item.id, delta: -1 });
                    }}
                    disabled={(item.stock_quantity ?? 0) <= 0 || adjustStockMutation.isPending}
                    className="p-0.5 text-text-muted hover:text-text-main disabled:opacity-30 rounded hover:bg-bg transition-colors"
                    title="Reduce stock by 1"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-xs text-text-main px-1">
                    {item.stock_quantity ?? 0} {item.unit || 'left'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustStockMutation.mutate({ id: item.id, delta: 1 });
                    }}
                    disabled={adjustStockMutation.isPending}
                    className="p-0.5 text-text-muted hover:text-text-main rounded hover:bg-bg transition-colors"
                    title="Add 1 to stock"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : editingPriceItemId === item.id ? (
              <div
                className="inline-flex items-center gap-1 bg-surface border-2 border-accent rounded-xl px-2 py-0.5 shadow-md animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs font-black text-accent">₦</span>
                <input
                  type="number"
                  autoFocus
                  value={inlinePriceInput}
                  onChange={(e) => setInlinePriceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveInlinePrice(item.id);
                    } else if (e.key === 'Escape') {
                      setEditingPriceItemId(null);
                    }
                  }}
                  placeholder="0"
                  className="w-16 sm:w-20 bg-bg border border-border/80 rounded-lg px-1.5 py-0.5 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => handleSaveInlinePrice(item.id)}
                  disabled={quickUpdatePriceMutation.isPending}
                  className="p-0.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors btn-tap"
                  title="Save price (Enter)"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPriceItemId(null)}
                  className="p-0.5 rounded-lg hover:bg-bg text-text-muted hover:text-text-main transition-colors btn-tap"
                  title="Cancel (Esc)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPriceItemId(item.id);
                  setInlinePriceInput(item.price ? (item.price / 100).toString() : '');
                }}
                className="font-heading font-black font-tabular text-xs sm:text-sm text-accent bg-accent-soft hover:bg-accent hover:text-white px-2 py-0.5 rounded-lg border border-accent/25 transition-all shrink-0 flex items-center gap-1 group/price cursor-pointer btn-tap shadow-xs"
                title="Click pencil to edit number right here"
              >
                <span>
                  {item.is_provisions ? (
                    '₦0'
                  ) : !item.price || item.price === 0 ? (
                    <span className="text-text-muted/70 font-normal italic text-xs">
                      No price yet
                    </span>
                  ) : (
                    formatMoney(item.price, currency)
                  )}
                </span>
                <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover/price:opacity-100" />
              </button>
            )}

            {/* Vendor / Restaurant Name if in hub-wide browse mode */}
            {!activeVendorId && item.vendor_name && (
              <span className="text-[10px] font-bold text-text-muted bg-surface border border-border px-1.5 py-0.5 rounded-md truncate max-w-[110px]">
                {item.vendor_name}
              </span>
            )}

            {/* Cheaper Option Alternative Pill */}
            {item.cheaper_option?.savings && item.cheaper_option.savings > 0 ? (
              <span className="text-[10px] font-bold text-orange-950 bg-orange-100 border border-orange-300 px-1.5 py-0.5 rounded-md truncate max-w-[130px]">
                Save {formatMoney(item.cheaper_option.savings, currency)}
              </span>
            ) : item.cheaper_option?.is_best_price ? (
              <span className="text-[10px] font-bold text-green bg-green/10 border border-green/20 px-1.5 py-0.5 rounded-md">
                Best Price
              </span>
            ) : null}
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => logExpenseMutation.mutate(item.id)}
            disabled={logExpenseMutation.isPending}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1 shadow-xs"
            title="Log this meal to expenses now"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Log</span>
          </button>
          <button
            type="button"
            onClick={() => openEditItem(item)}
            className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
            title="Edit dish"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => deleteItemMutation.mutate(item.id)}
            className="p-1.5 text-text-muted hover:text-red rounded-lg hover:bg-bg transition-colors"
            title="Delete dish"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pt-6 px-4 pb-24 md:pb-8 md:pt-10 w-full animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 bg-text-main text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-3">
            <CheckCircle2 className="w-4 h-4 text-accent" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Food, Menus & Eating Plan
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main mt-0.5">
              Food & Menus
            </h1>
            <p className="text-xs text-text-muted mt-1 max-w-xl">
              Nile University Food Court menus with live prices. Plan meals, track hostel provisions stash (₦0 spent), and log expenses with 1 tap.
            </p>
          </div>
        </div>

        {/* ── Main View Switcher ── */}
        <div className="flex rounded-xl bg-surface p-1 border border-border max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab('menus')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${activeTab === 'menus'
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-muted hover:text-text-main'
              }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Menus & Food Spots</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('planner')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 btn-tap ${activeTab === 'planner'
              ? 'bg-accent text-white shadow-sm'
              : 'text-text-muted hover:text-text-main'
              }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Weekly Meal Planner</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: MENUS & FOOD SPOTS                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'menus' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── Section Hub Switcher (Clean Responsive Grid — No Horizontal Scrolling) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'food_court' as const,
                  icon: Store,
                  label: 'Campus Food Court',
                  count: `${vendors.filter(v => isVendorInHub(v, 'food_court')).length} spots`,
                },
                {
                  id: 'outside' as const,
                  icon: Coffee,
                  label: 'Outside & Delivery',
                  count: `${vendors.filter(v => isVendorInHub(v, 'outside')).length} spots`,
                },
                {
                  id: 'provisions' as const,
                  icon: ShoppingBag,
                  label: 'Provisions Stash',
                  count: provisionsSummary ? `${provisionsSummary.total_units_in_stock} in stock` : 'Room Stock',
                },
                {
                  id: 'all' as const,
                  icon: Utensils,
                  label: 'All Food Spots',
                  count: `${totalMatchingDishes} dishes`,
                },
              ].map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => {
                    setSelectedHub(hub.id);
                    setActiveVendorId(null);
                    setShowAllDishesInHub(hub.id === 'all');
                  }}
                  className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between gap-2 btn-tap ${selectedHub === hub.id
                    ? 'bg-accent text-white border-accent shadow-sm ring-2 ring-accent/30'
                    : 'bg-surface border-border text-text-main hover:border-accent/40'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <hub.icon className="w-4 h-4" />
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedHub === hub.id ? 'bg-white/20 text-white' : 'bg-bg text-text-muted'
                        }`}
                    >
                      {hub.count}
                    </span>
                  </div>
                  <span className="text-xs font-bold leading-tight truncate">{hub.label}</span>
                </button>
              ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VIEW A: DEDICATED PROVISIONS STASH & INVENTORY VIEW            */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {selectedHub === 'provisions' ? (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Provisions Hero Header & Quick Actions */}
                <div className="card-base p-4 sm:p-5 bg-surface border-2 border-emerald-500/30 rounded-2xl shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs border border-emerald-500/20">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="font-heading font-black text-text-main text-base sm:text-lg">
                          Hostel & Room Provisions Stash
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5 max-w-xl">
                          Items already in your hostel room. Eating from your stash saves you ~{formatMoney(mealBenchmark, currency)} every meal compared to eating out. Record grocery trips to update stock!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsRestockModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
                        title="Record supermarket/store restock trip and expense"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Record Restock Expense</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStashItemName('');
                          setStashItemQty('5');
                          setStashItemUnit('packs');
                          setIsAddStashModalOpen(true);
                        }}
                        className="px-3 py-2 rounded-xl bg-surface border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors btn-tap flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Stash Item</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Metrics & Savings Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-border/60">
                    {/* Card 1: Month Savings */}
                    <div className="p-3 rounded-xl bg-bg border border-border flex flex-col justify-between">
                      <div className="flex items-center justify-between text-text-muted text-[11px] font-bold">
                        <span>Saved This Month</span>
                        <Coins className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <p className="font-heading font-black text-sm sm:text-base text-emerald-600 font-tabular mt-1">
                        {formatMoney(provisionsSummary?.month_savings_minor ?? 0, currency)}
                      </p>
                      <span className="text-[10px] text-text-muted mt-0.5 truncate">
                        {provisionsSummary?.meals_eaten ?? 0} stash meals eaten
                      </span>
                    </div>

                    {/* Card 2: Total Units In Stock */}
                    <div className="p-3 rounded-xl bg-bg border border-border flex flex-col justify-between">
                      <div className="flex items-center justify-between text-text-muted text-[11px] font-bold">
                        <span>Total Units In Room</span>
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <p className="font-heading font-black text-sm sm:text-base text-text-main font-tabular mt-1">
                        {provisionsSummary?.total_units_in_stock ?? 0} units
                      </p>
                      <span className="text-[10px] text-text-muted mt-0.5 truncate">
                        Across {stashItems.length} pantry items
                      </span>
                    </div>

                    {/* Card 3: Stock Health */}
                    <div className="p-3 rounded-xl bg-bg border border-border flex flex-col justify-between">
                      <div className="flex items-center justify-between text-text-muted text-[11px] font-bold">
                        <span>Stock Health</span>
                        {(provisionsSummary?.out_of_stock_count || 0) > 0 ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                      <p className={`font-heading font-black text-sm sm:text-base mt-1 ${(provisionsSummary?.out_of_stock_count || 0) > 0
                        ? 'text-red'
                        : (provisionsSummary?.low_stock_count || 0) > 0
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                        }`}>
                        {(provisionsSummary?.out_of_stock_count || 0) > 0
                          ? `${provisionsSummary?.out_of_stock_count} Out of Stock`
                          : (provisionsSummary?.low_stock_count || 0) > 0
                            ? `${provisionsSummary?.low_stock_count} Running Low`
                            : 'Well Stocked'}
                      </p>
                      <span className="text-[10px] text-text-muted mt-0.5 truncate">
                        {(provisionsSummary?.out_of_stock_count || 0) > 0
                          ? 'Restock trip needed soon'
                          : `${provisionsSummary?.low_stock_count || 0} low stock items`}
                      </span>
                    </div>

                    {/* Card 4: Cost Per Meal */}
                    <div className="p-3 rounded-xl bg-bg border border-border flex flex-col justify-between">
                      <div className="flex items-center justify-between text-text-muted text-[11px] font-bold">
                        <span>Meal Cost</span>
                        <Coins className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="font-heading font-black text-sm sm:text-base text-accent font-tabular mt-1">
                        Room Stash
                      </p>
                      <span className="text-[10px] text-text-muted mt-0.5 truncate">
                        No daily cash spent
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stash Search & Filter Bar */}
                <div className="card-base p-3 bg-surface border border-border rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={stashSearchQuery}
                      onChange={(e) => setStashSearchQuery(e.target.value)}
                      placeholder="Search room stash (noodles, eggs, milo, garri)..."
                      className="w-full bg-bg border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-text-main placeholder:text-text-muted focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto">
                    {[
                      { id: 'all' as const, label: `All (${stashItems.length})` },
                      { id: 'in_stock' as const, label: `In Stock (${stashItems.filter(i => (i.stock_quantity ?? 0) > 0).length})` },
                      { id: 'low_stock' as const, label: `Low Stock (${stashItems.filter(i => (i.stock_quantity ?? 0) > 0 && (i.stock_quantity ?? 0) <= 2).length})` },
                      { id: 'out_of_stock' as const, label: `Out of Stock (${stashItems.filter(i => (i.stock_quantity ?? 0) === 0).length})` },
                    ].map((flt) => (
                      <button
                        key={flt.id}
                        type="button"
                        onClick={() => setStashStatusFilter(flt.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 btn-tap ${stashStatusFilter === flt.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-bg border border-border text-text-muted hover:text-text-main'
                          }`}
                      >
                        {flt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2-Column Responsive Stash Inventory Cards Grid */}
                {filteredStashItems.length === 0 ? (
                  <div className="card-base p-10 text-center bg-surface border border-border rounded-2xl flex flex-col items-center justify-center space-y-3">
                    <CoinBuddy mood="happy" size={70} speech={stashItems.length === 0 ? "Your room stash is currently empty!" : "No items match your search!"} />
                    <p className="text-xs text-text-muted max-w-sm">
                      {stashItems.length === 0
                        ? "You haven't recorded any provisions inventory yet. Whenever you buy groceries or snacks for your hostel room, tap below to log the shopping expense and stock your pantry!"
                        : (stashSearchQuery ? `No provisions found matching "${stashSearchQuery}".` : 'No items found matching this filter.')}
                    </p>
                    {stashItems.length === 0 ? (
                      <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                        <button
                          type="button"
                          onClick={() => setIsRestockModalOpen(true)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 btn-tap flex items-center gap-1.5 shadow-sm"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>Record Restock Expense</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStashItemName('');
                            setStashItemQty('5');
                            setStashItemUnit('packs');
                            setIsAddStashModalOpen(true);
                          }}
                          className="px-4 py-2 bg-surface border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/10 btn-tap flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Stash Item</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStashSearchQuery('');
                          setStashStatusFilter('all');
                        }}
                        className="px-3.5 py-1.5 bg-bg border border-border text-text-main rounded-xl text-xs font-bold hover:border-emerald-500 btn-tap"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    {filteredStashItems.map((item) => {
                      const qty = item.stock_quantity ?? 0;
                      const unit = item.unit || 'items';
                      const isLow = qty > 0 && qty <= 2;
                      const isOut = qty === 0;

                      return (
                        <div
                          key={item.id}
                          className="card-base p-4 bg-surface border border-border rounded-2xl hover:border-emerald-500/50 hover:shadow-sm transition-all duration-200 flex flex-col justify-between gap-3 group"
                        >
                          {/* Top: Item Title, Tags & Health Badge */}
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="font-heading font-black text-text-main text-sm sm:text-base group-hover:text-emerald-600 transition-colors">
                                {item.name}
                              </h3>

                              {/* Health Badge */}
                              {isOut ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red/10 text-red border border-red/20 shrink-0">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                                  Low ({qty})
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                                  In Stock
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px] text-text-muted flex-wrap">
                              <span className="capitalize font-bold px-2 py-0.5 rounded-lg bg-bg border border-border">
                                {item.meal_type || 'snack'}
                              </span>
                              <span>•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                From Room Stash
                              </span>
                            </div>
                          </div>

                          {/* Middle: Stepper & Quick Stock Count Adjuster */}
                          <div className="py-2.5 px-3 rounded-xl bg-bg border border-border flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-text-muted shrink-0">
                              Room Stock:
                            </span>

                            <div className="flex items-center gap-2">
                              {/* [−] button */}
                              <button
                                type="button"
                                onClick={() => adjustStockMutation.mutate({ id: item.id, delta: -1 })}
                                disabled={qty <= 0 || adjustStockMutation.isPending}
                                className="w-7 h-7 rounded-lg bg-surface border border-border text-text-muted hover:text-text-main hover:border-emerald-500/50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none btn-tap"
                                title="Reduce stock by 1"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              {/* Inline tap-to-type number */}
                              {editingStockItemId === item.id ? (
                                <div className="inline-flex items-center gap-1 bg-surface border-2 border-emerald-500 rounded-lg px-1.5 py-0.5 shadow-md">
                                  <input
                                    type="number"
                                    min="0"
                                    autoFocus
                                    value={editingStockInput}
                                    onChange={(e) => setEditingStockInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveInlineStock(item.id);
                                      } else if (e.key === 'Escape') {
                                        setEditingStockItemId(null);
                                      }
                                    }}
                                    className="w-12 bg-bg border border-border/80 rounded px-1 text-xs font-bold text-text-main text-center focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineStock(item.id)}
                                    className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Save count (Enter)"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStockItemId(null)}
                                    className="p-0.5 text-text-muted hover:text-text-main"
                                    title="Cancel"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStockItemId(item.id);
                                    setEditingStockInput(qty.toString());
                                  }}
                                  className="px-2 py-0.5 rounded-lg hover:bg-surface border border-transparent hover:border-border transition-colors flex items-center gap-1 btn-tap"
                                  title="Click to type exact stock count"
                                >
                                  <span className={`font-heading font-black text-sm font-tabular ${isOut ? 'text-red' : isLow ? 'text-amber-600' : 'text-text-main'
                                    }`}>
                                    {qty}
                                  </span>
                                  <span className="text-xs text-text-muted">
                                    {unit}
                                  </span>
                                  <Edit2 className="w-2.5 h-2.5 opacity-40 hover:opacity-100 text-text-muted" />
                                </button>
                              )}

                              {/* [+] button */}
                              <button
                                type="button"
                                onClick={() => adjustStockMutation.mutate({ id: item.id, delta: 1 })}
                                disabled={adjustStockMutation.isPending}
                                className="w-7 h-7 rounded-lg bg-surface border border-border text-text-muted hover:text-text-main hover:border-emerald-500/50 flex items-center justify-center transition-colors btn-tap"
                                title="Add 1 to stock"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom Row: Actions */}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                            {/* Eat 1 button */}
                            <button
                              type="button"
                              onClick={() => logExpenseMutation.mutate(item.id)}
                              disabled={qty <= 0 || logExpenseMutation.isPending}
                              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 btn-tap shadow-xs ${qty > 0
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-bg text-text-muted border border-border opacity-60 cursor-not-allowed'
                                }`}
                              title={qty > 0 ? `Eat 1 from stash, saves ~${formatMoney(mealBenchmark, currency)}` : "Out of stock - please restock first"}
                            >
                              <Utensils className="w-3.5 h-3.5" />
                              <span>{qty > 0 ? 'Eat 1' : 'Out of Stock'}</span>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
                                title="Edit stash item"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItemMutation.mutate(item.id)}
                                className="p-1.5 text-text-muted hover:text-red rounded-lg hover:bg-bg transition-colors"
                                title="Delete stash item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* History Section: Recent Restock Expenses & Recent Stash Meals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  {/* Recent Restock Expenses */}
                  <div className="card-base p-4 bg-surface border border-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-heading font-black text-xs sm:text-sm text-text-main">
                          Recent Restock Trips
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRestockModalOpen(true)}
                        className="text-[11px] font-bold text-emerald-600 hover:underline"
                      >
                        + Log Trip
                      </button>
                    </div>

                    {(!provisionsSummary?.recent_restocks || provisionsSummary.recent_restocks.length === 0) ? (
                      <p className="text-xs text-text-muted py-3 text-center">
                        No shopping restocks recorded yet. Tap "Record Restock Expense" whenever you buy groceries!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {provisionsSummary.recent_restocks.slice(0, 4).map((tx) => (
                          <div key={tx.id} className="p-2.5 rounded-xl bg-bg border border-border/80 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-text-main block truncate">{tx.note || 'Provisions Restock'}</span>
                              <span className="text-[10px] text-text-muted">
                                {new Date(tx.occurred_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <span className="font-heading font-black text-text-main font-tabular shrink-0 text-right">
                              {formatMoney(tx.amount, tx.currency || currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Stash Meals Eaten & Savings */}
                  <div className="card-base p-4 bg-surface border border-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <h4 className="font-heading font-black text-xs sm:text-sm text-text-main">
                          Recent Stash Meals Eaten
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600">
                        {provisionsSummary?.meals_eaten ?? 0} total meals
                      </span>
                    </div>

                    {(!provisionsSummary?.recent_logs || provisionsSummary.recent_logs.length === 0) ? (
                      <p className="text-xs text-text-muted py-3 text-center">
                        No stash meals eaten yet. Tap "Eat 1" on any item above to record a meal!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {provisionsSummary.recent_logs.slice(0, 4).map((log) => (
                          <div key={log.id} className="p-2.5 rounded-xl bg-bg border border-border/80 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-text-main block truncate">{log.item_name}</span>
                              <span className="text-[10px] text-text-muted">
                                {new Date(log.consumed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 shrink-0">
                              +Saved {formatMoney(log.estimated_savings, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VIEW B: RESTAURANT CARDS OVERVIEW (When no spot is clicked yet) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {selectedHub !== 'provisions' && activeVendorId === null && !showAllDishesInHub ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Hub Header & Callout */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      {selectedHub === 'food_court' ? (
                        <Store className="w-5 h-5" />
                      ) : selectedHub === 'outside' ? (
                        <Coffee className="w-5 h-5" />
                      ) : (
                        <ShoppingBag className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-heading font-black text-text-main text-base sm:text-lg">
                        {selectedHub === 'food_court'
                          ? 'Campus Food Court Restaurants'
                          : selectedHub === 'outside'
                            ? 'Outside Dining & Delivery Spots'
                            : 'Hostel & Room Provisions Stash'}
                      </h2>
                      <p className="text-xs text-text-muted">
                        Tap any restaurant card below to open its menu, view prices, and log meals with 1 tap.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openDigitizer(null, selectedHub === 'outside' ? 'outside' : 'food_court')}
                      className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shrink-0 btn-tap flex items-center gap-1.5 shadow-sm"
                      title="Scan menu with Gemini Vision AI"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Scan Menu (AI Vision)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAddSpot(selectedHub === 'all' ? 'food_court' : selectedHub)}
                      className="px-3 py-1.5 rounded-xl bg-accent-soft border border-accent/40 text-xs font-bold text-accent hover:bg-accent/20 transition-colors shrink-0 btn-tap flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Restaurant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAllDishesInHub(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-bg border border-border text-xs font-bold text-text-main hover:border-accent hover:text-accent transition-colors shrink-0 btn-tap flex items-center gap-1.5"
                    >
                      <Utensils className="w-3.5 h-3.5 text-accent" />
                      <span>Browse all dishes ({items.length})</span>
                    </button>
                  </div>
                </div>

                {/* Grid of Saved Restaurants under this section (2-column layout to reduce scrolling) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  {hubVendors.map((v) => {
                    const isZulkys = v.name.toLowerCase().includes('zulky');

                    return (
                      <div
                        key={v.id}
                        onClick={() => setActiveVendorId(v.id)}
                        className="card-base p-4 bg-surface border border-border rounded-2xl hover:border-accent hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
                      >
                        {/* Top row */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {isZulkys ? (
                                <Coffee className="w-6 h-6" />
                              ) : v.category_name?.toLowerCase().includes('provision') || v.name.toLowerCase().includes('stash') ? (
                                <ShoppingBag className="w-6 h-6" />
                              ) : (
                                <Utensils className="w-6 h-6" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => openEditSpot(v, e)}
                                  className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
                                  title={`Edit ${v.name}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => confirmDeleteSpot(v, e)}
                                  className="p-1.5 text-text-muted hover:text-red rounded-lg hover:bg-bg transition-colors"
                                  title={`Delete ${v.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-white">
                                {v.item_count} Dishes
                              </span>
                            </div>
                          </div>

                          <h3 className="font-heading font-black text-text-main text-base group-hover:text-accent transition-colors">
                            {v.name}
                          </h3>
                          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                            <span>{v.location || 'Campus Food Court'}</span>
                          </p>

                          {/* Price range */}
                          <div className="mt-3 py-1.5 px-2.5 rounded-xl bg-bg border border-border/80 flex items-center justify-between text-xs">
                            <span className="text-text-muted text-[11px] font-bold">Price range:</span>
                            <span className="font-heading font-black text-text-main">
                              {v.min_price > 0
                                ? `${formatMoney(v.min_price, currency)} – ${formatMoney(v.max_price, currency)}`
                                : v.max_price > 0
                                ? `${formatMoney(0, currency)} – ${formatMoney(v.max_price, currency)}`
                                : <span className="text-text-muted/70 font-normal italic">No prices yet</span>}
                            </span>
                          </div>
                        </div>

                        {/* Card CTA Footer */}
                        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                          <span className="text-xs font-bold text-accent flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>Open Menu</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11px] text-text-muted">
                            Tap to browse dishes
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* VIEW C: RESTAURANT DEDICATED MENU VIEW (or all dishes list)    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {selectedHub !== 'provisions' && (activeVendorId !== null || showAllDishesInHub) ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Back / Breadcrumb Navigation & Restaurant Switcher Bar */}
                <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  {/* Top Bar on Mobile / Left Group on Desktop */}
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
                    {/* Back Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveVendorId(null);
                        setShowAllDishesInHub(false);
                      }}
                      className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text-main hover:border-accent hover:text-accent transition-colors btn-tap flex items-center gap-1.5 shrink-0 shadow-2xs"
                      title="Back to spots overview"
                    >
                      <ArrowLeft className="w-4 h-4 text-accent shrink-0" />
                      <span className="hidden sm:inline">
                        Back to {selectedHub === 'food_court' ? 'Campus Food Court' : selectedHub === 'outside' ? 'Outside Spots' : 'Provisions'}
                      </span>
                      <span className="sm:hidden font-bold">Back</span>
                    </button>

                    {/* Sibling Restaurant Switcher - Top Right on Mobile */}
                    <div className="sm:hidden flex items-center gap-1.5 shrink-0 max-w-[170px]">
                      <div className="relative w-full">
                        <select
                          value={activeVendorId || 'all'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'all') {
                              setActiveVendorId(null);
                              setShowAllDishesInHub(true);
                            } else {
                              setActiveVendorId(Number(val));
                              setShowAllDishesInHub(false);
                            }
                          }}
                          className="w-full appearance-none bg-bg border border-border rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer truncate"
                        >
                          <option value="all">All Spots ({hubVendors.length})</option>
                          {hubVendors.map((hv) => (
                            <option key={hv.id} value={hv.id}>
                              {hv.name} ({hv.item_count})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Restaurant Info (Desktop inline) */}
                    {activeVendor ? (
                      <div className="hidden sm:flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <h2 className="font-heading font-black text-text-main text-base lg:text-lg truncate">
                            {activeVendor.name}
                          </h2>
                          <p className="text-[11px] text-text-muted truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                            <span>{activeVendor.location || 'Campus Food Court'} • {items.length} dishes</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => openEditSpot(activeVendor)}
                            className="p-1.5 rounded-lg bg-bg border border-border text-text-muted hover:text-text-main transition-colors btn-tap"
                            title="Edit spot name or location"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-accent" />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDeleteSpot(activeVendor)}
                            className="p-1.5 rounded-lg bg-bg border border-border text-text-muted hover:text-red transition-colors btn-tap"
                            title="Delete spot and menu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="hidden sm:block min-w-0">
                        <h2 className="font-heading font-black text-text-main text-base lg:text-lg truncate">
                          All {selectedHub === 'food_court' ? 'Food Court' : selectedHub === 'outside' ? 'Outside' : 'Provisions'} Dishes
                        </h2>
                        <p className="text-[11px] text-text-muted">
                          Browsing {items.length} dishes across {hubVendors.length} spots
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Row 2 on Mobile: Restaurant Title + Meta & Action Buttons */}
                  {activeVendor ? (
                    <div className="sm:hidden flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-heading font-black text-text-main text-base truncate">
                          {activeVendor.name}
                        </h2>
                        <p className="text-[11px] text-text-muted truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                          <span>{activeVendor.location || 'Campus Food Court'} • {items.length} dishes</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditSpot(activeVendor)}
                          className="p-1.5 rounded-lg bg-bg border border-border text-text-muted hover:text-text-main transition-colors btn-tap"
                          title="Edit spot name or location"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-accent" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteSpot(activeVendor)}
                          className="p-1.5 rounded-lg bg-bg border border-border text-text-muted hover:text-red transition-colors btn-tap"
                          title="Delete spot and menu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="sm:hidden pt-2 border-t border-border/60">
                      <h2 className="font-heading font-black text-text-main text-base truncate">
                        All {selectedHub === 'food_court' ? 'Food Court' : selectedHub === 'outside' ? 'Outside' : 'Provisions'} Dishes
                      </h2>
                      <p className="text-[11px] text-text-muted">
                        Browsing {items.length} dishes across {hubVendors.length} spots
                      </p>
                    </div>
                  )}

                  {/* Sibling Restaurant Dropdown Switcher - Desktop */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-text-muted">
                      Switch Spot:
                    </span>
                    <div className="relative">
                      <select
                        value={activeVendorId || 'all'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'all') {
                            setActiveVendorId(null);
                            setShowAllDishesInHub(true);
                          } else {
                            setActiveVendorId(Number(val));
                            setShowAllDishesInHub(false);
                          }
                        }}
                        className="appearance-none bg-bg border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer pr-8"
                      >
                        <option value="all">All Spots ({hubVendors.length})</option>
                        {hubVendors.map((hv) => (
                          <option key={hv.id} value={hv.id}>
                            {hv.name} ({hv.item_count})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Search, Budget Filters, and Actions Toolbar */}
                <div className="card-base p-3 bg-surface border border-border flex flex-col md:flex-row gap-2.5 sm:gap-3 md:items-center md:justify-between shadow-xs">
                  {/* Search bar */}
                  <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search ${activeVendor ? activeVendor.name : 'food court'} dishes...`}
                      className="w-full bg-bg border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Filters & Actions row on mobile, inline on desktop */}
                  <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
                    {/* Price Range Dropdown */}
                    <div className="relative flex-1 md:flex-initial">
                      <select
                        value={priceTierFilter}
                        onChange={(e) => setPriceTierFilter(e.target.value as any)}
                        className="w-full md:w-auto appearance-none bg-bg border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-accent cursor-pointer pr-8"
                      >
                        <option value="all">All Prices</option>
                        <option value="under_2k">Under ₦2,000</option>
                        <option value="2k_to_4k">₦2,000 – ₦4,000</option>
                        <option value="above_4k">₦4,000+</option>
                        <option value="provisions">₦0 Provisions</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {activeBudget && (
                      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-accent-soft/60 border border-accent/20 text-xs font-bold text-accent">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Today's Budget: {formatMoney(activeBudget.daily?.remaining ?? 0, currency)} left</span>
                      </div>
                    )}

                    {/* Scan Menu Button */}
                    <button
                      type="button"
                      onClick={() => openDigitizer(activeVendorId || undefined)}
                      className="px-3 py-1.5 rounded-xl bg-accent-soft border border-accent/40 text-xs font-bold text-accent hover:bg-accent hover:text-white transition-all btn-tap flex items-center gap-1 shrink-0"
                      title="Upload photo to digitize menu for this restaurant"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>Scan Menu</span>
                    </button>

                    {/* Add Dish Button */}
                    <button
                      type="button"
                      onClick={() => openAddItem(activeVendorId || undefined)}
                      className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1 shadow-sm shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Dish</span>
                    </button>
                  </div>
                </div>

                {/* Food Categories Quick Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 btn-tap ${selectedCategory === 'all'
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-accent/40'
                      }`}
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
                    <span>All</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-bg text-text-muted'
                        }`}
                    >
                      {totalMatchingDishes}
                    </span>
                  </button>

                  {FOOD_CATEGORIES.map((cat) => {
                    const count = availableCategories.get(cat.key) || 0;
                    if (count === 0 && selectedCategory !== cat.key) return null;
                    const isCatSelected = selectedCategory === cat.key;

                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCategory(isCatSelected ? 'all' : cat.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 btn-tap ${isCatSelected
                          ? 'bg-accent text-white shadow-xs'
                          : 'bg-surface border border-border text-text-muted hover:text-text-main hover:border-accent/40'
                          }`}
                      >
                        <cat.icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{cat.shortLabel}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${isCatSelected ? 'bg-white/20 text-white' : 'bg-bg text-text-muted'
                            }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Multi-Dish Meal Order & Budget Fit Bar (When 1+ dishes selected) */}
                {selectedDishIds.length > 0 && (
                  <div className="card-base p-4 bg-surface border-2 border-accent rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading font-black text-text-main text-sm sm:text-base">
                            Meal Order ({selectedDishIds.length} {selectedDishIds.length === 1 ? 'dish' : 'dishes'})
                          </h3>
                          <span className="font-heading font-black text-sm sm:text-base text-accent">
                            Total: {formatMoney(selectedTotal, currency)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold mt-0.5">
                          {activeBudget ? (
                            selectedTotal <= (activeBudget.daily?.remaining ?? 0) ? (
                              <span className="text-green flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Fits your daily budget! ({formatMoney((activeBudget.daily?.remaining ?? 0) - selectedTotal, currency)} left today)</span>
                              </span>
                            ) : (
                              <span className="text-orange-600 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Exceeds today's budget by {formatMoney(selectedTotal - (activeBudget.daily?.remaining ?? 0), currency)}</span>
                              </span>
                            )
                          ) : (
                            <span className="text-text-muted">
                              {selectedDishes.map((d) => d.name).join(' + ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDishIds([]);
                          setSelectedDishesMap(new Map());
                        }}
                        className="px-3 py-1.5 rounded-xl border border-border bg-bg text-text-muted hover:text-text-main text-xs font-bold transition-colors btn-tap"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlanSelectedDate(formatLocalDate(new Date()));
                          setPlanSelectedMealTime('lunch');
                          setIsPlanSelectedModalOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-accent-soft text-accent hover:bg-accent hover:text-white text-xs font-bold transition-colors btn-tap flex items-center gap-1.5 shadow-2xs border border-accent/20"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Plan in Schedule</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => logComboMutation.mutate(selectedDishIds)}
                        disabled={logComboMutation.isPending}
                        className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Log Meal Order ({formatMoney(selectedTotal, currency)})</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Items Rendering */}
                {itemsLoading ? (
                  <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 animate-pulse">
                    <div className="h-10 bg-bg rounded-xl" />
                    <div className="h-10 bg-bg rounded-xl" />
                    <div className="h-10 bg-bg rounded-xl" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="card-base p-12 text-center bg-surface border border-border flex flex-col items-center justify-center space-y-4">
                    <CoinBuddy mood="sleepy" size={80} speech="No dishes found in this filter!" />
                    <p className="text-xs text-text-muted max-w-sm">
                      {selectedCategory !== 'all'
                        ? `No dishes found under "${selectedCategory}".`
                        : activeVendor
                          ? `No dishes added for ${activeVendor.name} yet.`
                          : 'No dishes found matching your search.'}
                    </p>
                    <div className="flex items-center gap-3">
                      {selectedCategory !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('all')}
                          className="px-4 py-2 bg-surface border border-border text-text-main rounded-xl text-xs font-bold hover:bg-bg btn-tap transition-colors"
                        >
                          Clear Category Filter
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openAddItem(activeVendorId || undefined)}
                        className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent-hover btn-tap transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Dish</span>
                      </button>
                    </div>
                  </div>
                ) : selectedCategory === 'all' ? (
                  /* ═════════════════════════════════════════════════════════ */
                  /* GROUPED CATEGORY SECTIONS (Shawarma, Rice, Pasta, Extras...) */
                  /* ═════════════════════════════════════════════════════════ */
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {groupedCategorySections.map((section) => (
                      <div key={section.def.key} className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <section.def.icon className="w-4 h-4 text-accent shrink-0" />
                            <h3 className="font-heading font-black text-xs sm:text-sm text-text-main">
                              {section.def.label}
                            </h3>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface border border-border text-text-muted">
                              {section.items.length}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCategory(section.def.key)}
                            className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                          >
                            <span>View all {availableCategories.get(section.def.key) || section.items.length} {section.def.shortLabel}</span>
                            <span>→</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                          {section.items.map(renderDishCard)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ═════════════════════════════════════════════════════════ */
                  /* FILTERED SINGLE CATEGORY 2-COLUMN VIEW                    */
                  /* ═════════════════════════════════════════════════════════ */
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const CatIcon = FOOD_CATEGORIES.find((c) => c.key === selectedCategory)?.icon || UtensilsCrossed;
                          return <CatIcon className="w-4 h-4 text-accent shrink-0" />;
                        })()}
                        <h3 className="font-heading font-black text-xs sm:text-sm text-text-main">
                          {selectedCategory}
                        </h3>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-surface border border-border text-text-muted">
                          {items.length} of {totalMatchingDishes} {totalMatchingDishes === 1 ? 'dish' : 'dishes'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className="text-[11px] font-bold text-accent hover:underline"
                      >
                        ← View All Categories
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      {items.map(renderDishCard)}
                    </div>
                  </div>
                )}

                {/* ═════════════════════════════════════════════════════ */}
                {/* PAGINATION / LOAD MORE FOOTER                       */}
                {/* ═════════════════════════════════════════════════════ */}
                {items.length > 0 && (
                  <div className="pt-6 pb-2 flex flex-col items-center justify-center gap-3 border-t border-border mt-6">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <span>Showing</span>
                      <span className="font-bold text-text-main font-tabular">{items.length}</span>
                      <span>of</span>
                      <span className="font-bold text-text-main font-tabular">{totalMatchingDishes}</span>
                      <span>dishes</span>
                      {selectedCategory !== 'all' && (
                        <span className="text-text-muted/80 font-medium">in {selectedCategory}</span>
                      )}
                    </div>

                    {hasNextPage ? (
                      <button
                        type="button"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-6 py-2.5 rounded-xl border border-border bg-surface text-accent hover:bg-accent-soft text-xs font-bold transition-all btn-tap flex items-center gap-2 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isFetchingNextPage ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                            <span>Loading more dishes...</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span>Load More Dishes (+24)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="px-3.5 py-1.5 rounded-full bg-surface border border-border text-[11px] font-semibold text-text-muted">
                        All {totalMatchingDishes} dishes loaded
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: WEEKLY MEAL PLANNER                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Week Navigator & Summary Card */}
            <div className="card-base p-5 bg-surface border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                    className="p-2 rounded-xl bg-bg border border-border text-text-muted hover:text-text-main transition-colors btn-tap"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="font-heading font-black text-text-main text-sm sm:text-base">
                      {weekDays[0].dayMonth} – {weekDays[6].dayMonth}
                    </h3>
                    <p className="text-[11px] text-text-muted">
                      {currentWeekOffset === 0 ? 'Current Week' : `${Math.abs(currentWeekOffset)} week${Math.abs(currentWeekOffset) > 1 ? 's' : ''} ${currentWeekOffset < 0 ? 'ago' : 'ahead'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                    className="p-2 rounded-xl bg-bg border border-border text-text-muted hover:text-text-main transition-colors btn-tap"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {currentWeekOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentWeekOffset(0)}
                      className="text-xs font-bold text-accent hover:underline ml-2"
                    >
                      Reset to This Week
                    </button>
                  )}
                </div>

                {/* Highlights */}
                <div className="flex items-center gap-3">
                  <div className="bg-bg px-3.5 py-2 rounded-xl border border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Estimated Food Spend
                    </p>
                    <p className="text-base font-heading font-black font-tabular text-accent">
                      {formatMoney(planSummary.total_estimated, currency)}
                    </p>
                  </div>
                  <div className="bg-bg px-3.5 py-2 rounded-xl border border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Provisions Stash (₦0)
                    </p>
                    <p className="text-base font-heading font-black font-tabular text-green">
                      {planSummary.provisions_meals_count} meals
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Spoil Yourself • Weekend Reward & Live Cushion Bar ── */}
            <div className="card-base p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-surface to-accent/10 border-2 border-amber-500/40 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-xs">
                      <Gift className="w-4 h-4" />
                    </span>
                    <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                      Spoil Yourself • Weekend Reward
                    </h3>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      spoilData?.is_budget_safe !== false
                        ? 'bg-green/10 text-green border-green/30'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    }`}>
                      <ShieldCheck className="w-3 h-3" />
                      <span>{spoilData?.is_budget_safe !== false ? 'Budget Safe Cushion' : 'Tight Cushion'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-text-muted max-w-xl">
                    Reward yourself for staying within budget. Add loaded fries, wings, ramen, milkshakes, or order food delivery for the weekend when campus dining is limited.
                  </p>
                  <div className="flex items-center gap-3 pt-0.5 text-xs flex-wrap">
                    <span className="font-bold text-text-main">
                      Weekly Cushion:{' '}
                      <span className="text-amber-500 font-black font-tabular">
                        {spoilData ? formatMoney(spoilData.weekly_cushion, currency) : '₦0'}
                      </span>
                    </span>
                    <span className="text-text-muted">•</span>
                    <span className="text-text-muted">
                      Today's Cushion:{' '}
                      <span className="font-bold text-accent font-tabular">
                        {spoilData ? formatMoney(spoilData.budget_cushion, currency) : '₦0'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => openSpoilModal()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black transition-all btn-tap flex items-center gap-2 shadow-sm"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Spoil Yourself</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Smart Budget Meal Assistant Bar ── */}
            <div className="card-base p-4 sm:p-5 bg-surface border-2 border-accent/40 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-accent text-white shadow-xs">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                      Auto-Plan My Week (All Meals)
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted max-w-xl">
                    Builds a balanced 7-day schedule covering all your daily meals (Meal 1, Meal 2, and Evening Meal) within your budget, rotating across campus spots for exciting variety.
                  </p>
                  <div className="pt-1 text-xs">
                    <span className="font-bold text-accent">
                      {activeBudget?.daily?.remaining != null ? `Today's Budget: ${formatMoney(activeBudget.daily.remaining, currency)} left` : `Target: ~${formatMoney(mealBenchmark * 3, currency)} / day`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = formatLocalDate(new Date());
                      const hr = new Date().getHours();
                      const defaultSlot = hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : 'dinner';
                      const defaultLabel = hr < 11 ? 'Meal 1' : hr < 16 ? 'Meal 2' : 'Evening Meal';
                      openSmartSuggestModal(todayStr, defaultSlot, defaultLabel);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-bg border border-border text-xs font-bold text-text-main hover:border-accent hover:text-accent transition-colors btn-tap flex items-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-accent" />
                    <span>Suggest Today</span>
                  </button>

                  <button
                    type="button"
                    disabled={autoPlanWeekMutation.isPending}
                    onClick={() => {
                      autoPlanWeekMutation.mutate({
                        start_date: weekRange.fromStr,
                        budget_per_day: activeBudget?.daily?.remaining || activeBudget?.daily?.limit || (mealBenchmark ? mealBenchmark * 3 : undefined),
                      });
                    }}
                    className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{autoPlanWeekMutation.isPending ? 'Planning All Meals...' : 'Auto-Plan All Meals'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Weekly Meal Breakdown Accordion */}
            {plans.length > 0 && (
              <div className="card-base bg-surface border border-accent/30 rounded-2xl shadow-xs overflow-hidden transition-all duration-200">
                {/* Accordion Toggle Header */}
                <button
                  type="button"
                  onClick={() => setIsWeekSummaryOpen((prev) => !prev)}
                  className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 text-left hover:bg-bg/60 transition-colors btn-tap"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0" />
                    <h4 className="text-xs font-heading font-black text-text-main">
                      Weekly Meals Breakdown ({plans.length} {plans.length === 1 ? 'meal' : 'meals'} planned)
                    </h4>
                    <span className="text-[11px] font-bold text-accent bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent/20">
                      Est. Spend: {formatMoney(planSummary.total_estimated, currency)}
                    </span>
                    <span className="text-[11px] text-text-muted font-bold hidden sm:inline">
                      {planSummary.provisions_meals_count > 0 && `${planSummary.provisions_meals_count} free stash • `}
                      {planSummary.paid_meals_count} campus orders
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent shrink-0">
                    <span className="text-[11px]">{isWeekSummaryOpen ? 'Hide Breakdown' : 'Show Breakdown'}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isWeekSummaryOpen ? 'rotate-180' : ''
                        }`}
                    />
                  </div>
                </button>

                {/* Expanded Structured View */}
                {isWeekSummaryOpen && (
                  <div className="p-4 pt-2 border-t border-border/60 bg-bg/30 space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                      {weekDays.map((day) => {
                        const dayMealPlans = plans.filter((p) => {
                          if (!p.plan_date) return false;
                          const pDate = p.plan_date.includes('T') ? p.plan_date.split('T')[0] : p.plan_date;
                          return pDate === day.dateStr;
                        });

                        if (dayMealPlans.length === 0) return null;

                        const dayCost = dayMealPlans.reduce(
                          (sum, p) => sum + (p.is_provisions_stash ? 0 : (p.estimated_price || 0)),
                          0
                        );

                        return (
                          <div
                            key={day.dateStr}
                            className="p-3 rounded-xl bg-surface border border-border space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-xs">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="font-heading font-black text-text-main">{day.dayName}</span>
                                <span className="text-[10px] text-text-muted">({day.dayMonth})</span>
                                {day.isToday && (
                                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-accent text-white">
                                    Today
                                  </span>
                                )}
                              </div>
                              <span className="font-heading font-black text-accent text-[11px]">
                                {dayCost > 0 ? formatMoney(dayCost, currency) : 'From Stash'}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {dayMealPlans.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between text-xs gap-2 py-0.5"
                                >
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-muted shrink-0 w-6">
                                      {p.meal_time === 'breakfast' ? 'M1' : p.meal_time === 'lunch' ? 'M2' : p.meal_time === 'dinner' ? 'Eve' : 'Snk'}
                                    </span>
                                    <span className="font-medium text-text-main truncate">
                                      {p.custom_item_name || p.item_name || 'Planned Dish'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="font-tabular font-bold text-[11px] text-text-muted">
                                      {p.is_provisions_stash ? '₦0' : formatMoney(p.estimated_price || 0, currency)}
                                    </span>
                                    {p.is_logged && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-green" title="Logged" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7-Day Food Schedule Header with Controls */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-sm sm:text-base text-text-main">
                  Weekly Food Schedule
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/20">
                  7 Days • All Meals
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const todayEl = weekScheduleScrollRef.current?.querySelector('[data-is-today="true"]');
                    if (todayEl) {
                      todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-border bg-surface text-xs font-bold text-accent hover:bg-accent-soft/50 transition-colors btn-tap flex items-center gap-1 shadow-2xs"
                  title="Scroll to Today's schedule"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Today</span>
                </button>
                <button
                  type="button"
                  onClick={() => weekScheduleScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                  className="p-1.5 rounded-xl border border-border bg-surface text-text-muted hover:text-text-main hover:bg-bg transition-colors btn-tap shadow-2xs"
                  title="Scroll schedule left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => weekScheduleScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                  className="p-1.5 rounded-xl border border-border bg-surface text-text-muted hover:text-text-main hover:bg-bg transition-colors btn-tap shadow-2xs"
                  title="Scroll schedule right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 7-Day Food Schedule Board */}
            <div
              ref={weekScheduleScrollRef}
              className="overflow-x-auto pb-4 pt-1 -mx-2 px-2 sm:-mx-1 sm:px-1 custom-scrollbar snap-x snap-mandatory"
            >
              <div className="grid grid-flow-col auto-cols-[minmax(215px,1fr)] 2xl:grid-cols-7 2xl:auto-cols-auto gap-3.5 min-w-[1260px] 2xl:min-w-0">
                {weekDays.map((day) => {
                  const dayPlans = plans.filter((p) => {
                    if (!p.plan_date) return false;
                    const pDate = p.plan_date.includes('T') ? p.plan_date.split('T')[0] : p.plan_date;
                    return pDate === day.dateStr;
                  });

                  const dayTotal = dayPlans.reduce((sum, p) => {
                    if (p.is_provisions_stash) return sum;
                    const price = (p.menu_item_id && p.item_price !== null && p.item_price !== undefined)
                      ? Number(p.item_price)
                      : Number(p.estimated_price || 0);
                    return sum + price;
                  }, 0);

                  return (
                    <div
                      key={day.dateStr}
                      data-is-today={day.isToday ? 'true' : undefined}
                      className={`card-base p-3.5 bg-surface border flex flex-col justify-between snap-start min-w-[215px] sm:min-w-[225px] 2xl:min-w-0 transition-all rounded-2xl ${day.isToday
                        ? 'border-accent shadow-md ring-2 ring-accent/25 bg-gradient-to-b from-accent/[0.04] to-surface'
                        : 'border-border hover:border-border-hover'
                        }`}
                    >
                      <div>
                        {/* Day Header */}
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/70">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs font-heading font-black ${day.isToday ? 'text-accent' : 'text-text-main'}`}>
                                {day.dayName}
                              </p>
                              {day.isToday && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-white flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  Today
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-text-muted">{day.dayMonth}</p>
                          </div>

                          {/* Day Total at Top Right */}
                          {dayPlans.length > 0 && (
                            <div className="text-right shrink-0">
                              <span
                                className={`text-[10px] font-heading font-black font-tabular px-2 py-0.5 rounded-lg border ${dayTotal > 0
                                  ? 'bg-accent-soft text-accent border-accent/20'
                                  : 'bg-green/10 text-green border-green/20'
                                  }`}
                                title={`Total planned spend for ${day.dayName}: ${formatMoney(dayTotal, currency)}`}
                              >
                                {dayTotal > 0 ? formatMoney(dayTotal, currency) : '₦0'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Flexible Meal Slots */}
                        <div className="space-y-2.5">
                          {[
                            { key: 'breakfast' as const, label: 'Meal 1', timeHint: 'Morning' },
                            { key: 'lunch' as const, label: 'Meal 2', timeHint: 'Afternoon' },
                            { key: 'dinner' as const, label: 'Evening Meal', timeHint: '~5 PM' },
                          ].map((slot) => {
                            const slotPlan = dayPlans.find((p) => p.meal_time === slot.key);

                            return (
                              <div key={slot.key} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                  <span>{slot.label}</span>
                                  <span className="text-[9px] font-semibold text-text-muted/60 lowercase tracking-normal">
                                    {slot.timeHint}
                                  </span>
                                </div>

                              {slotPlan ? (
                                <div
                                  className={`p-2.5 rounded-xl border text-xs group relative transition-all shadow-2xs ${slotPlan.is_logged
                                    ? 'bg-green/5 border-green/30'
                                    : slotPlan.is_provisions_stash
                                      ? 'bg-emerald-500/5 border-emerald-500/30'
                                      : 'bg-surface border-accent/40 shadow-xs ring-1 ring-accent/15'
                                    }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-heading font-black text-text-main text-xs leading-snug line-clamp-2">
                                        {slotPlan.custom_item_name || slotPlan.item_name || 'Planned Dish'}
                                      </p>
                                      {slotPlan.vendor_name ? (
                                        <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5 truncate">
                                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                                          <span className="truncate">{slotPlan.vendor_name}</span>
                                        </p>
                                      ) : slotPlan.is_provisions_stash ? (
                                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5 truncate">
                                          <ShoppingBag className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span>Room Stash</span>
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => openSmartSuggestModal(day.dateStr, slot.key, slot.label)}
                                        className="text-text-muted hover:text-accent p-1 rounded-md hover:bg-bg transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100 btn-tap"
                                        title="Change / re-suggest dish"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deletePlanMutation.mutate(slotPlan.id)}
                                        className="text-text-muted hover:text-red p-1 rounded-md hover:bg-bg transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100 btn-tap"
                                        title="Remove planned meal"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between gap-1">
                                    <span
                                      className={`text-[11px] font-black font-tabular px-1.5 py-0.5 rounded-md ${slotPlan.is_provisions_stash
                                        ? 'bg-green/10 text-green'
                                        : 'bg-accent-soft text-accent'
                                        }`}
                                    >
                                      {slotPlan.is_provisions_stash
                                        ? 'From Stash'
                                        : formatMoney(
                                          slotPlan.menu_item_id && slotPlan.item_price !== null && slotPlan.item_price !== undefined
                                            ? slotPlan.item_price
                                            : slotPlan.estimated_price || 0,
                                          currency
                                        )}
                                    </span>

                                    {slotPlan.is_logged ? (
                                      <span className="text-[10px] font-bold text-green flex items-center gap-0.5 bg-green/10 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Eaten</span>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => logPlanExpenseMutation.mutate(slotPlan.id)}
                                        disabled={logPlanExpenseMutation.isPending}
                                        className="text-[10px] font-bold text-white bg-accent hover:bg-accent-hover px-2.5 py-0.5 rounded-lg transition-colors btn-tap shadow-2xs flex items-center gap-1"
                                        title="Log expense for this meal"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Log</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openSmartSuggestModal(day.dateStr, slot.key, slot.label)}
                                  className="w-full py-2 px-2.5 border border-dashed border-accent/30 hover:border-accent bg-accent/[0.04] hover:bg-accent hover:text-white rounded-xl text-[11px] font-bold text-accent transition-all btn-tap flex items-center justify-center gap-1.5 group shadow-2xs"
                                >
                                  <Plus className="w-3.5 h-3.5 transition-transform group-hover:scale-110 shrink-0" />
                                  <span>Add {slot.label}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Extra Meals on this day (e.g. Weekend Treat / Refreshment) */}
                        {dayPlans
                          .filter((p) => !['breakfast', 'lunch', 'dinner'].includes(p.meal_time))
                          .map((extraPlan) => {
                            const isTreat = extraPlan.meal_time === 'treat';
                            return (
                              <div key={extraPlan.id} className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                  <span className={`flex items-center gap-1 ${isTreat ? 'text-amber-500' : ''}`}>
                                    {isTreat && <Flame className="w-3 h-3 text-amber-500" />}
                                    {isTreat ? 'Weekend Treat' : extraPlan.meal_time}
                                  </span>
                                </div>
                                <div className={`p-2.5 rounded-xl border text-xs group relative shadow-2xs transition-all ${
                                  isTreat
                                    ? 'bg-amber-500/[0.06] border-amber-500/40 ring-1 ring-amber-500/15'
                                    : 'bg-surface border-border'
                                }`}>
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-heading font-black text-text-main text-xs leading-snug line-clamp-2">
                                        {extraPlan.custom_item_name || extraPlan.item_name || 'Planned Treat'}
                                      </p>
                                      {extraPlan.vendor_name ? (
                                        <p className="text-[10px] text-text-muted mt-0.5 truncate flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                                          <span>{extraPlan.vendor_name}</span>
                                        </p>
                                      ) : isTreat ? (
                                        <p className="text-[10px] text-amber-600 font-bold mt-0.5 truncate flex items-center gap-1">
                                          <Flame className="w-3 h-3 text-amber-500 shrink-0" />
                                          <span>Reward Indulgence</span>
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => deletePlanMutation.mutate(extraPlan.id)}
                                      className="text-text-muted hover:text-red p-1 rounded-md hover:bg-bg transition-colors btn-tap"
                                      title="Remove planned treat"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between">
                                    <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                                      isTreat ? 'bg-amber-500/10 text-amber-600' : 'bg-accent-soft text-accent'
                                    }`}>
                                      {formatMoney(extraPlan.estimated_price || 0, currency)}
                                    </span>
                                    {extraPlan.is_logged ? (
                                      <span className="text-[10px] font-bold text-green flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> Eaten
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => logPlanExpenseMutation.mutate(extraPlan.id)}
                                        className={`text-[10px] font-bold text-white px-2.5 py-0.5 rounded-lg btn-tap transition-colors ${
                                          isTreat ? 'bg-amber-500 hover:bg-amber-600' : 'bg-accent hover:bg-accent-hover'
                                        }`}
                                      >
                                        Log
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        {/* Dedicated Weekend Treat Slot on Saturday & Sunday */}
                        {(day.dayName === 'Sat' || day.dayName === 'Sun') && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => openSpoilModal(day.dateStr)}
                              className="w-full py-2 px-2 rounded-xl border border-dashed border-amber-500/50 hover:border-amber-500 bg-amber-500/[0.05] hover:bg-amber-500 hover:text-white text-[11px] font-bold text-amber-600 dark:text-amber-400 transition-all btn-tap flex items-center justify-center gap-1.5 shadow-2xs group"
                            >
                              <Gift className="w-3.5 h-3.5 transition-transform group-hover:scale-110 shrink-0 text-amber-500 group-hover:text-white" />
                              <span>+ Weekend Treat (Spoil Yourself)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick 1-tap: Eat from Provisions Stash for this day */}
                    <div className="mt-3 pt-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => {
                          const emptySlot = ['breakfast', 'lunch', 'dinner'].find(
                            (k) => !dayPlans.some((p) => p.meal_time === k)
                          ) || 'snack';
                          planMealMutation.mutate({
                            plan_date: day.dateStr,
                            meal_time: emptySlot as any,
                            custom_item_name: 'Snacks & Provisions from Stash',
                            estimated_price: 0,
                            is_provisions_stash: true,
                          });
                        }}
                        className="w-full py-1.5 text-[10px] font-bold text-green bg-green/10 hover:bg-green/20 rounded-md transition-colors btn-tap text-center flex items-center justify-center gap-1"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>+ Room Provisions (₦0)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MODALS: DIGITIZER, ADD/EDIT ITEM, ADD SPOT                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}


        {/* 0. Plan Selected Dishes Modal (from Multi-dish selection on Menu items catalog) */}
        {isPlanSelectedModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-accent text-white shadow-xs">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-heading font-black text-text-main text-base">
                      Plan Selected Dishes
                    </h3>
                    <p className="text-xs text-text-muted">
                      Add {selectedDishIds.length} {selectedDishIds.length === 1 ? 'dish' : 'dishes'} into your Weekly Meal Schedule
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlanSelectedModalOpen(false)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Dishes Summary */}
              <div className="p-3 bg-bg rounded-xl border border-border space-y-2">
                <div className="text-xs font-bold text-text-main flex items-center justify-between">
                  <span>Selected Dish Combo:</span>
                  <span className="text-accent font-black">{formatMoney(selectedTotal, currency)}</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {selectedDishes.map((dish) => (
                    <div key={dish.id} className="text-xs text-text-muted flex items-center justify-between py-0.5">
                      <span className="truncate font-bold text-text-main">• {dish.name}</span>
                      <span className="shrink-0 ml-2 font-mono text-accent">
                        {dish.is_provisions ? '₦0' : dish.price > 0 ? formatMoney(dish.price, currency) : 'No price yet'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form to choose day & slot */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Schedule Day</label>
                  <select
                    value={planSelectedDate}
                    onChange={(e) => setPlanSelectedDate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  >
                    {weekDays.map((day) => (
                      <option key={day.dateStr} value={day.dateStr}>
                        {day.dayName} ({day.dayMonth}) {day.isToday ? '— Today' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Meal Slot</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'breakfast' as const, label: 'Meal 1' },
                      { key: 'lunch' as const, label: 'Meal 2' },
                      { key: 'dinner' as const, label: 'Evening Meal' },
                    ].map((slot) => (
                      <button
                        key={slot.key}
                        type="button"
                        onClick={() => setPlanSelectedMealTime(slot.key)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${planSelectedMealTime === slot.key
                          ? 'bg-accent text-white border-accent shadow-xs'
                          : 'bg-bg text-text-muted border-border hover:text-text-main'
                          }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsPlanSelectedModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text-main btn-tap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePlanSelectedCombo}
                  disabled={planMealMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{planMealMutation.isPending ? 'Planning...' : 'Add to Schedule'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Manual Add / Edit Dish Modal */}
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
              <h3 className="font-heading font-black text-text-main text-base">
                {editingItem ? 'Edit Dish' : 'Add Dish to Menu'}
              </h3>

              <form onSubmit={handleSaveItem} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Dish Name</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Jollof Rice + Chicken, Shawarma, Meat Pie"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-text-main">Price (₦ NGN)</label>
                      <span className="text-[10px] text-accent font-bold">Tentative prices easily editable</span>
                    </div>
                    <input
                      type="number"
                      autoFocus={!!editingItem}
                      disabled={itemIsProvisions}
                      value={itemIsProvisions ? '0' : itemPriceStr}
                      onChange={(e) => setItemPriceStr(e.target.value)}
                      placeholder="e.g. 2500"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent disabled:opacity-50"
                    />
                    {/* Quick Preset Chips for rapid editing */}
                    {!itemIsProvisions && (
                      <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none pb-0.5">
                        {[1500, 2000, 2500, 3000, 3500, 4000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setItemPriceStr(preset.toString())}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-bg border border-border text-text-muted hover:text-accent hover:border-accent transition-colors shrink-0"
                          >
                            ₦{preset.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Meal / Time</label>
                    <select
                      value={itemMealType}
                      onChange={(e) => setItemMealType(e.target.value as any)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                    >
                      <option value="dinner">Evening / Main Meal (~5 PM)</option>
                      <option value="lunch">Anytime Meal</option>
                      <option value="snack">Snack / Drink</option>
                      <option value="breakfast">Morning Meal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Food Spot / Vendor</label>
                    <select
                      value={itemVendorId || ''}
                      onChange={(e) => setItemVendorId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                    >
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Category</label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                    >
                      <option value="">Auto-Detect (Smart)</option>
                      {FOOD_CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Provisions Checkbox */}
                <label className="flex items-center gap-2 text-xs font-bold text-text-main cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={itemIsProvisions}
                    onChange={(e) => setItemIsProvisions(e.target.checked)}
                    className="accent-accent w-4 h-4 rounded"
                  />
                  <span>Provisions / Snack Stash (₦0 Spend)</span>
                </label>

                {itemIsProvisions && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-bg rounded-xl border border-border">
                    <div>
                      <label className="text-xs font-bold text-text-main block mb-1">Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={itemStockQuantity}
                        onChange={(e) => setItemStockQuantity(e.target.value)}
                        placeholder="e.g. 8"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-main block mb-1">Unit</label>
                      <input
                        type="text"
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value)}
                        placeholder="e.g. packs, eggs, cans, portions"
                        className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={closeItemModal}
                    className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main btn-tap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveSingleItemMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover btn-tap"
                  >
                    {editingItem ? 'Save Changes' : 'Add Dish'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. Record Provisions Restock & Shopping Expense Modal */}
        {isRestockModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-black text-text-main text-base sm:text-lg flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    <span>Record Provisions Shopping Expense</span>
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Log the money spent on groceries/provisions & replenish your room stock counts!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRestock} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">
                      Total Amount Spent (₦ NGN) <span className="text-red">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">₦</span>
                      <input
                        type="number"
                        required
                        autoFocus
                        value={restockAmountStr}
                        onChange={(e) => setRestockAmountStr(e.target.value)}
                        placeholder="e.g. 15000"
                        className="w-full bg-bg border border-border rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Date</label>
                    <input
                      type="date"
                      value={restockDate}
                      onChange={(e) => setRestockDate(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Store / Trip Note</label>
                  <input
                    type="text"
                    value={restockNote}
                    onChange={(e) => setRestockNote(e.target.value)}
                    placeholder="e.g. Campus Supermarket & Market Provisions"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-text-muted mt-1 block">
                    Logs as an expense under <strong>Snacks & Provisions</strong> in your VTrack transactions & budgets.
                  </span>
                </div>

                {/* Stock Replenishment Section */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-heading font-black text-text-main block">
                        Add to Room Stock from this trip
                      </span>
                      <span className="text-[10px] text-text-muted">
                        Type how many of each item you bought to add to your stock
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRestockAddNewOpen(!isRestockAddNewOpen)}
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isRestockAddNewOpen ? 'Cancel new item' : 'Add new item to trip'}</span>
                    </button>
                  </div>

                  {/* Add New Item inside restock modal */}
                  {isRestockAddNewOpen && (
                    <div className="p-3 bg-bg border border-emerald-500/30 rounded-xl space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-text-main block mb-1">New Item Name</label>
                          <input
                            type="text"
                            value={restockNewItemName}
                            onChange={(e) => setRestockNewItemName(e.target.value)}
                            placeholder="e.g. Corned Beef"
                            className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-text-main block mb-1">Quantity & Unit</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={restockNewItemQty}
                              onChange={(e) => setRestockNewItemQty(e.target.value)}
                              placeholder="3"
                              className="w-16 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main"
                            />
                            <input
                              type="text"
                              value={restockNewItemUnit}
                              onChange={(e) => setRestockNewItemUnit(e.target.value)}
                              placeholder="cans"
                              className="w-20 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-text-main"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!restockNewItemName.trim()) return;
                          setNewTripItems([
                            ...newTripItems,
                            {
                              name: restockNewItemName.trim(),
                              quantity: parseInt(restockNewItemQty, 10) || 1,
                              unit: restockNewItemUnit.trim() || 'items',
                              meal_type: 'snack',
                            },
                          ]);
                          setRestockNewItemName('');
                          setRestockNewItemQty('1');
                          setIsRestockAddNewOpen(false);
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 btn-tap"
                      >
                        Add to restock list
                      </button>
                    </div>
                  )}

                  {/* New items added during this trip */}
                  {newTripItems.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-600">New items being added:</span>
                      {newTripItems.map((ni, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                          <span className="font-bold text-text-main">{ni.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 font-bold">+{ni.quantity} {ni.unit}</span>
                            <button
                              type="button"
                              onClick={() => setNewTripItems(newTripItems.filter((_, i) => i !== idx))}
                              className="text-text-muted hover:text-red"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* List of existing stash items with + input */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {stashItems.map((item) => {
                      const curVal = restockStockDeltas[item.id] || '';
                      return (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-bg border border-border/80 text-xs">
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-text-main block truncate">{item.name}</span>
                            <span className="text-[10px] text-text-muted">
                              Currently in stock: {item.stock_quantity ?? 0} {item.unit || 'items'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-black text-emerald-600">+</span>
                            <input
                              type="number"
                              min="0"
                              value={curVal}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setRestockStockDeltas({
                                  ...restockStockDeltas,
                                  [item.id]: isNaN(val) ? 0 : val,
                                });
                              }}
                              placeholder="0"
                              className="w-14 bg-surface border border-border rounded-lg px-2 py-1 text-xs font-bold text-text-main text-center focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-[11px] text-text-muted w-10 truncate">
                              {item.unit || 'items'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsRestockModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main btn-tap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restockExpenseMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 btn-tap flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Record Expense & Update Stock</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. Quick Add Stash Item Modal */}
        {isAddStashModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-text-main text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  <span>Add Room Stash Item</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddStashModalOpen(false)}
                  className="p-1.5 text-text-muted hover:text-text-main rounded-lg hover:bg-bg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveStashItem} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Stash Item Name</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={stashItemName}
                    onChange={(e) => setStashItemName(e.target.value)}
                    placeholder="e.g. Golden Morn & Milk, Indomie Super Pack, Eggs"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Quantity in Stock</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={stashItemQty}
                      onChange={(e) => setStashItemQty(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main block mb-1">Unit</label>
                    <input
                      type="text"
                      value={stashItemUnit}
                      onChange={(e) => setStashItemUnit(e.target.value)}
                      placeholder="e.g. packs, eggs, bowls, cans"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Meal / Time</label>
                  <select
                    value={stashItemMealType}
                    onChange={(e) => setStashItemMealType(e.target.value as any)}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-emerald-500"
                  >
                    <option value="lunch">Anytime Meal / Lunch</option>
                    <option value="dinner">Evening Meal</option>
                    <option value="breakfast">Morning Meal</option>
                    <option value="snack">Snack / Refreshment</option>
                  </select>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Stash items are <strong>₦0 per meal</strong> because you already bought them. Logging a meal from stash saves you ~{formatMoney(mealBenchmark, currency)} compared to food court!</span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAddStashModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main btn-tap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveSingleItemMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 btn-tap shadow-sm"
                  >
                    Add to Stash
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Add / Edit Spot Modal */}
        {isSpotModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-black text-text-main text-base">
                  {editingSpot ? `Edit "${editingSpot.name}"` : 'Add New Food Spot'}
                </h3>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!spotName.trim()) return;
                  if (editingSpot) {
                    editSpotMutation.mutate({
                      id: editingSpot.id,
                      body: {
                        name: spotName.trim(),
                        location: spotLocation.trim() || null,
                        category: spotCategory,
                        icon_key: spotCategory === 'food_court' ? 'utensils' : spotCategory === 'outside' ? 'coffee' : 'shopping-bag',
                      },
                    });
                  } else {
                    createSpotMutation.mutate({
                      name: spotName.trim(),
                      location: spotLocation.trim() || null,
                      category: spotCategory,
                      icon_key: spotCategory === 'food_court' ? 'utensils' : spotCategory === 'outside' ? 'coffee' : 'shopping-bag',
                    });
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Spot Name</label>
                  <input
                    type="text"
                    required
                    value={spotName}
                    onChange={(e) => setSpotName(e.target.value)}
                    placeholder="e.g. Zulkys Cafe, Quintavi Restaurant, Shawarma Hub"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Location / Details</label>
                  <input
                    type="text"
                    value={spotLocation}
                    onChange={(e) => setSpotLocation(e.target.value)}
                    placeholder="e.g. Campus Food Court, Hall 3, Off-campus"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">Category Hub</label>
                  <select
                    value={spotCategory}
                    onChange={(e) => setSpotCategory(e.target.value as any)}
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                  >
                    <option value="food_court">Campus Food Court</option>
                    <option value="outside">Off-Campus / Outside Dining / Delivery</option>
                    <option value="provisions">Hostel Provisions Stash (₦0 Spend)</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSpotModalOpen(false);
                      setEditingSpot(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main btn-tap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSpotMutation.isPending || editSpotMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover btn-tap"
                  >
                    {editingSpot
                      ? (editSpotMutation.isPending ? 'Saving...' : 'Save Changes')
                      : (createSpotMutation.isPending ? 'Creating...' : 'Create Spot')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. Delete Spot Confirmation Modal */}
        {isDeleteSpotModalOpen && spotToDelete && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-red/10 text-red flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-heading font-black text-text-main text-base">
                  Delete {spotToDelete.name}?
                </h3>
                <p className="text-xs text-text-muted">
                  This will delete this food spot and all dishes recorded under its menu. This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteSpotModalOpen(false);
                    setSpotToDelete(null);
                  }}
                  className="flex-1 py-2 rounded-xl border border-border bg-bg text-text-muted text-xs font-bold hover:text-text-main btn-tap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteSpotMutation.mutate(spotToDelete.id)}
                  disabled={deleteSpotMutation.isPending}
                  className="flex-1 py-2 rounded-xl bg-red text-white text-xs font-bold hover:bg-red/90 btn-tap shadow-sm"
                >
                  {deleteSpotMutation.isPending ? 'Deleting...' : 'Delete Spot'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Smart Meal Suggestion & Anti-Repetition Modal */}
        {isSuggestModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-surface/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-accent text-white shadow-xs">
                      <Utensils className="w-4 h-4" />
                    </span>
                    <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                      Food Recommendations
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text-main">{suggestTargetSlotLabel}</span>
                    <span>•</span>
                    <span>{suggestTargetDate}</span>
                    <span>•</span>
                    <span className="text-accent font-bold">
                      {activeBudget?.daily?.remaining != null 
                        ? `Today's Budget: ${formatMoney(activeBudget.daily.remaining, currency)} left` 
                        : `Daily Target: ~${formatMoney(mealBenchmark * 2, currency)}`}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSuggestModalOpen(false)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle: AI Suggestions vs Search All */}
              <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-border/60 flex items-center justify-between gap-3 bg-bg/50">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsManualPickerMode(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!isManualPickerMode
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                      }`}
                  >
                    Recommended Dishes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManualPickerMode(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isManualPickerMode
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                      }`}
                  >
                    Browse All Campus Dishes
                  </button>
                </div>

                {!isManualPickerMode && (
                  <button
                    type="button"
                    disabled={isLoadingSuggestions}
                    onClick={() => fetchSuggestions(suggestTargetDate, suggestTargetMealTime)}
                    className="flex items-center gap-1 text-[11px] font-bold text-accent hover:text-accent-hover transition-colors btn-tap"
                    title="Reroll suggestions"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
                    <span>Shuffle / Refresh</span>
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
                {!isManualPickerMode ? (
                  isLoadingSuggestions ? (
                    <div className="space-y-3 py-8 text-center">
                      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs font-bold text-text-muted">
                        Finding tasty meals that fit your budget & give you variety...
                      </p>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <p className="text-sm font-bold text-text-main">No suggestions found within this limit.</p>
                      <p className="text-xs text-text-muted">Try increasing your budget or browsing all campus menus.</p>
                      <button
                        type="button"
                        onClick={() => setIsManualPickerMode(true)}
                        className="mt-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold"
                      >
                        Browse All Menus
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-text-muted pb-1">
                        <span className="font-bold">
                          Checked your recent meals to keep your week varied & fresh
                        </span>
                        <span>{suggestions.length} wise picks</span>
                      </div>

                      {suggestions.map((item, idx) => {
                        const price = Number(item.price);
                        const isProvisions = item.is_provisions || price === 0;

                        return (
                          <div
                            key={item.id || idx}
                            className="card-base p-3.5 bg-surface border border-border hover:border-accent/60 transition-all rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-heading font-black text-text-main text-sm">
                                  {item.name}
                                </h4>
                                <span
                                  className={`text-xs font-black font-tabular px-2 py-0.5 rounded-full ${isProvisions
                                    ? 'bg-green/10 text-green'
                                    : 'bg-accent/10 text-accent font-bold'
                                    }`}
                                >
                                  {isProvisions ? '₦0' : formatMoney(price, currency)}
                                </span>
                              </div>

                              <p className="text-xs text-text-muted flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-text-muted/70" />
                                <span className="font-bold text-text-main">{item.vendor_name}</span>
                                {item.vendor_location && (
                                  <>
                                    <span>•</span>
                                    <span>{item.vendor_location}</span>
                                  </>
                                )}
                              </p>

                              {/* Wise Decision Reason Badge */}
                              {item.reason && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-soft/40 border border-accent/20 text-accent text-[11px] font-bold">
                                  <span>{item.reason}</span>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => applySuggestion(item)}
                              className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Choose Meal</span>
                            </button>
                          </div>
                        );
                      })}

                      {/* Quick Option: Provisions Stash */}
                      <div className="mt-4 p-3 rounded-xl bg-green/10 border border-green/20 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-green">Hostel Provisions / Snack Stash</p>
                          <p className="text-[11px] text-text-muted">Already bought snacks, biscuits, or noodles in your room (₦0 spent)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            applySuggestion({
                              id: null,
                              name: 'Hostel Provisions Stash',
                              price: 0,
                              is_provisions: true,
                            });
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-green text-white text-xs font-bold hover:bg-green/90 transition-colors btn-tap"
                        >
                          Select ₦0 Meal
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  // Manual Browse View
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={manualSearch}
                        onChange={(e) => setManualSearch(e.target.value)}
                        placeholder="Search all 590+ campus dishes (e.g. jollof, rice, wings, pasta, shawarma)..."
                        className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
                      {manualSearchLoading ? (
                        <div className="py-8 text-center text-xs font-medium text-text-muted">
                          Loading dishes...
                        </div>
                      ) : manualPickerItems.length === 0 ? (
                        <div className="py-8 text-center text-xs text-text-muted">
                          No dishes found matching your search.
                        </div>
                      ) : (
                        manualPickerItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-bg border border-border hover:border-accent/60 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-main truncate">{item.name}</p>
                              <p className="text-[10px] text-text-muted flex items-center gap-1">
                                <span>{item.vendor_name}</span>
                                <span>•</span>
                                <span className="font-tabular font-bold text-accent">
                                  {item.is_provisions ? '₦0' : item.price > 0 ? formatMoney(item.price, currency) : 'No price yet'}
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => applySuggestion(item)}
                              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors btn-tap shrink-0"
                            >
                              Choose
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. Spoil Yourself • Weekend Reward Treat Modal */}
        {isSpoilModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-gradient-to-r from-amber-500/10 via-surface to-accent/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-amber-500 text-white shadow-xs">
                      <Gift className="w-4 h-4" />
                    </span>
                    <h3 className="font-heading font-black text-text-main text-base sm:text-lg">
                      Spoil Yourself • Weekend Reward
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted">
                    Enjoy comfort food like loaded fries, wings, ramen, or online delivery for staying within your budget. Especially great for weekends when campus dining is limited.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSpoilModalOpen(false)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Live Budget Cushion Bar & Target Day Selector */}
              <div className="p-4 sm:px-5 border-b border-border/70 bg-bg/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 rounded-xl bg-surface border border-border shadow-2xs flex items-center gap-2">
                      <span className="text-[11px] text-text-muted font-bold">Weekly Surplus Cushion:</span>
                      <span className="text-sm font-black font-tabular text-amber-500">
                        {spoilData ? formatMoney(spoilData.weekly_cushion, currency) : '₦0'}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                      spoilData?.is_budget_safe !== false
                        ? 'bg-green/10 text-green border-green/30'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{spoilData?.is_budget_safe !== false ? 'Safe to Indulge Guilt-Free' : 'Tight Cushion'}</span>
                    </span>
                  </div>

                  {/* Day Target Selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-text-muted font-bold shrink-0">Reward Day:</span>
                    {weekDays.map((d) => {
                      const isWeekend = d.dayName === 'Sat' || d.dayName === 'Sun';
                      const isSelected = spoilTargetDate === d.dateStr;
                      return (
                        <button
                          key={d.dateStr}
                          type="button"
                          onClick={() => setSpoilTargetDate(d.dateStr)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-amber-500 text-white shadow-xs'
                              : isWeekend
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-surface text-text-muted hover:text-text-main border border-border'
                          }`}
                        >
                          {d.dayName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mode Toggle: Campus Treats vs Order Online Delivery */}
              <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-border/60 flex items-center justify-between gap-3 bg-surface">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomDeliveryMode(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      !isCustomDeliveryMode
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main hover:bg-bg'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Campus Treats ({spoilData?.treats?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomDeliveryMode(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isCustomDeliveryMode
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main hover:bg-bg'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Order Online (Chowdeck / Glovo / Delivery)</span>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                {isCustomDeliveryMode ? (
                  /* Custom Delivery / Outside Food Form */
                  <div className="space-y-4 max-w-lg mx-auto py-2">
                    <div className="p-4 rounded-2xl bg-amber-500/[0.06] border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-heading font-black text-sm">
                        <ShoppingBag className="w-4 h-4" />
                        <span>Order Food Online / Off-Campus Delivery</span>
                      </div>
                      <p className="text-xs text-text-muted">
                        Ordering from Chowdeck, Glovo, Domino's, or an outside food spot for the weekend? Enter the details below to schedule or log it directly.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-text-muted mb-1">
                          Dish / Order Description *
                        </label>
                        <input
                          type="text"
                          value={customDeliveryDish}
                          onChange={(e) => setCustomDeliveryDish(e.target.value)}
                          placeholder="e.g. Loaded Shawarma Fries, Chicken Katsu Ramen, Large Pepperoni Pizza"
                          className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">
                            Platform / Spot Name
                          </label>
                          <input
                            type="text"
                            value={customDeliveryVendor}
                            onChange={(e) => setCustomDeliveryVendor(e.target.value)}
                            placeholder="e.g. Chowdeck, Glovo, Domino's"
                            className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">
                            Estimated Price (₦) *
                          </label>
                          <input
                            type="number"
                            value={customDeliveryPriceStr}
                            onChange={(e) => setCustomDeliveryPriceStr(e.target.value)}
                            placeholder="e.g. 4500"
                            className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => handlePlanCustomOnlineTreat(false)}
                          className="px-4 py-2.5 rounded-xl bg-surface border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white text-xs font-bold transition-all btn-tap flex items-center gap-1.5 shadow-2xs"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Plan in Schedule ({spoilTargetDate || 'Weekend'})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlanCustomOnlineTreat(true)}
                          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all btn-tap flex items-center gap-1.5 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Log Order Now</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Campus Treats Catalog */
                  <div className="space-y-3">
                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                      {[
                        { key: 'all', label: 'All Treats' },
                        { key: 'loaded_fries', label: 'Loaded Fries' },
                        { key: 'wings_grills', label: 'Wings & Grills' },
                        { key: 'pizza_burgers', label: 'Pizza & Burgers' },
                        { key: 'ramen_noodles', label: 'Ramen & Noodles' },
                        { key: 'milkshakes_slush', label: 'Milkshakes & Slush' },
                        { key: 'shawarma', label: 'Shawarma Combos' },
                      ].map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setSpoilCategory(cat.key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                            spoilCategory === cat.key
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-bg text-text-muted hover:text-text-main border border-border'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={spoilSearch}
                        onChange={(e) => setSpoilSearch(e.target.value)}
                        placeholder="Search treats (e.g. loaded fries, wings, pizza, ramen, milkshake, slush)..."
                        className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Treats Grid */}
                    {spoilLoading ? (
                      <div className="py-12 text-center text-xs text-text-muted animate-pulse">
                        Loading indulgence treats...
                      </div>
                    ) : (
                      <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                        {spoilData?.treats
                          ?.filter((item) => {
                            if (spoilSearch.trim()) {
                              const q = spoilSearch.toLowerCase();
                              const matchName = item.name.toLowerCase().includes(q);
                              const matchVendor = (item.vendor_name || '').toLowerCase().includes(q);
                              if (!matchName && !matchVendor) return false;
                            }
                            if (spoilCategory === 'all') return true;
                            const lower = item.name.toLowerCase();
                            if (spoilCategory === 'wings_grills') {
                              return /wings|grill|suya|ribs|fajita|platter|peppered/i.test(lower);
                            }
                            if (spoilCategory === 'loaded_fries') {
                              return /loaded|fries|potato/i.test(lower);
                            }
                            if (spoilCategory === 'pizza_burgers') {
                              return /pizza|burger|submarine|sub\b/i.test(lower) || (item.vendor_name || '').toLowerCase().includes('pizza');
                            }
                            if (spoilCategory === 'ramen_noodles') {
                              return /ramen|noodle|asian/i.test(lower);
                            }
                            if (spoilCategory === 'milkshakes_slush') {
                              return /shake|milkshake|slush|ice cream|icecream|smoothie/i.test(lower);
                            }
                            if (spoilCategory === 'shawarma') {
                              return /shawarma|wrap/i.test(lower);
                            }
                            return true;
                          })
                          .map((item) => {
                            const cushion = spoilData?.weekly_cushion || 0;
                            const fitsCushion = cushion >= item.price;

                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-2xl bg-bg border border-border hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-heading font-black text-text-main">
                                      {item.name}
                                    </p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      fitsCushion
                                        ? 'bg-green/10 text-green border-green/30'
                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                    }`}>
                                      {fitsCushion
                                        ? 'Within Safe Cushion'
                                        : `Cushion -${formatMoney(item.price - cushion, currency)}`}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                                    {item.vendor_name && (
                                      <span className="flex items-center gap-1 truncate">
                                        <MapPin className="w-3 h-3 text-text-muted shrink-0" />
                                        <span>{item.vendor_name}</span>
                                      </span>
                                    )}
                                    <span>•</span>
                                    <span className="font-tabular font-black text-amber-600 dark:text-amber-400">
                                      {formatMoney(item.price, currency)}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => planTreatDish(item)}
                                    className="px-3 py-1.5 rounded-xl bg-surface border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white text-xs font-bold transition-all btn-tap flex items-center gap-1 shadow-2xs"
                                    title="Plan as weekend treat"
                                  >
                                    <Gift className="w-3.5 h-3.5" />
                                    <span>Plan as Treat</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => logTreatDirectlyMutation.mutate(item.id)}
                                    disabled={logTreatDirectlyMutation.isPending}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all btn-tap flex items-center gap-1 shadow-xs"
                                    title="Log expense right now"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Log Order</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Menu Digitizer (Gemini Multimodal Vision AI OCR) Modal */}
        <MenuDigitizerModal
          isOpen={isDigitizerOpen}
          onClose={() => setIsDigitizerOpen(false)}
          vendors={vendors}
          onSaveItems={handleDigitizerSave}
          initialVendorId={digitizerInitialVendorId}
          initialCategory={digitizerInitialCategory}
        />

      </div>
    </div>
  );
};
