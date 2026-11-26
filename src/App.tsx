import {useCallback, useEffect, useMemo, useState} from 'react';
import {WifiOff} from 'lucide-react';
import {AdminDashboard} from './components/AdminDashboard.tsx';
import {AdvertiserPortal} from './components/AdvertiserPortal.tsx';
import {AuthModal} from './components/AuthModal.tsx';
import {ChefProfileModal} from './components/ChefProfileModal.tsx';
import {FlagshipFooterBand, FlagshipTopStrip} from './components/FlagshipSponsorBars.tsx';
import {KitchenHub} from './components/KitchenHub.tsx';
import {MarketplaceView} from './components/MarketplaceView.tsx';
import {type AppTab, MobileBottomNav, TopHeader} from './components/Navigation.tsx';
import {ProfileAndAdminView} from './components/ProfileAndAdminView.tsx';
import {RecipeDetailModal} from './components/RecipeDetailModal.tsx';
import {type RecipeFilterState, RecipeFeed} from './components/RecipeFeed.tsx';
import {ShoppingListView} from './components/ShoppingListView.tsx';
import {SplashScreen} from './components/SplashScreen.tsx';
import {SubmitRecipeModal} from './components/SubmitRecipeModal.tsx';
import {useOnlineStatus} from './hooks/usePWA.ts';
import {
  apiRequest,
  loadGuestBookmarks,
  loadGuestShopping,
  loadSavedTheme,
  saveGuestBookmarks,
  saveGuestShopping,
  saveTheme,
  setUserToken,
} from './lib/api.ts';
import {
  behaviorTracker,
  getOrCreateClientKey,
  loadLocalDietaryPrefs,
  loadPassiveAffinityCategories,
  saveLocalDietaryPrefs,
} from './lib/behaviorTracker.ts';
import {
  filterAdsForUserDiet,
  filterVenuesForUserDiet,
  isFlagshipCompatibleWithUserDiet,
  personalizeSafeAdsByAffinity,
} from './shared/behavioralEngine.ts';
import {DEFAULT_AD_HARMONY} from './shared/nativeAdEngine.ts';
import {
  canonicalizeIngredient,
  classifyIngredientCategory,
  normalizePersian,
  toFaDigits,
} from './shared/persianEngine.ts';
import type {
  EcosystemConfig,
  FlagshipSponsorship,
  LocalVenueSuggestion,
  NativeAdUnit,
  Partner,
  Recipe,
  ShoppingCategory,
  ShoppingItem,
  UserDietaryPreferences,
  UserProfile,
} from './shared/types.ts';

const INITIAL_CONFIG: EcosystemConfig = {
  marketplaceTabEnabled: true,
  marketplaceTitle: 'برندهای همکار',
  exploreShowcaseEnabled: true,
  recipeContextEnabled: true,
  shoppingDeliveryCardEnabled: false,
  maxPartnerCardsPerRecipe: 1,
  enabledPartnerRoles: [
    'food_brands',
    'kitchen_equipment',
    'stores_supermarkets',
    'chefs_nutritionists',
    'culinary_schools',
    'local_artisans',
  ],
  activeCampaignTitle: 'برندهای منتخب تحریریه لاقلی',
  appSections: {
    heroEnabled: true,
    heroTitle: 'دستورهای اصیل، آرام و دقیق برای آشپزی روزمره',
    heroSubtitle: 'مرجع دستورپخت ایرانی با مقیاس هوشمند نفرات، تایمر گام‌به‌گام و آشپزخانه بدون اتلاف مواد.',
    editorialNotice: '',
    searchBarEnabled: true,
    quickCategoriesEnabled: true,
    kitchenTabEnabled: true,
    shoppingTabEnabled: true,
    submitRecipeEnabled: true,
    featuredCategories: [
      'همه',
      'ناهار و شام',
      'پیش‌غذا و عصرانه',
      'وگان و گیاهی',
      'پخت سریع',
      'رژیمی و سبک',
      'پرپروتئین',
      'غذای شمالی',
    ],
  },
  adHarmony: DEFAULT_AD_HARMONY,
};

function isSuperAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    pathname === '/superadmin' ||
    pathname.startsWith('/superadmin/') ||
    params.get('portal') === 'superadmin' ||
    params.get('tab') === 'admin'
  );
}

function isAdvertiserRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    pathname === '/advertiser' ||
    pathname.startsWith('/advertiser/') ||
    params.get('portal') === 'advertiser'
  );
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [superAdminPortal, setSuperAdminPortal] = useState<boolean>(() => isSuperAdminRoute());
  const [advertiserPortal, setAdvertiserPortal] = useState<boolean>(() => isAdvertiserRoute());
  const [showSplash, setShowSplash] = useState(() => !isSuperAdminRoute() && !isAdvertiserRoute());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadSavedTheme());
  const [activeTab, setActiveTab] = useState<AppTab>('explore');

  // Core data state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [quickTestLoginEnabled, setQuickTestLoginEnabled] = useState(false);
  const [userLoggedOutExplicitly, setUserLoggedOutExplicitly] = useState(false);
  const [ecosystemConfig, setEcosystemConfig] = useState<EcosystemConfig>(INITIAL_CONFIG);
  const [nativeAds, setNativeAds] = useState<NativeAdUnit[]>([]);
  const [flagshipSponsorship, setFlagshipSponsorship] = useState<FlagshipSponsorship | null>(null);
  const [localVenues, setLocalVenues] = useState<LocalVenueSuggestion[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [showcasePartners, setShowcasePartners] = useState<Partner[]>([]);

  // Filters
  const [filters, setFilters] = useState<RecipeFilterState>({
    q: '',
    categories: [],
    seasons: [],
    regions: [],
    diets: [],
    verifiedOnly: false,
    followedOnly: false,
    bookmarkedOnly: false,
    needsPhotoOnly: false,
    maxTotalMinutes: null,
  });

  // Guest Local-First / Synced Bookmarks, Shopping List & Strict Dietary Profile
  const [guestBookmarks, setGuestBookmarks] = useState<string[]>(() => loadGuestBookmarks());
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => loadGuestShopping<ShoppingItem>());
  const [dietaryPrefs, setDietaryPrefs] = useState<UserDietaryPreferences>(() => loadLocalDietaryPrefs());

  // Active Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
  const [openChefId, setOpenChefId] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [variationParent, setVariationParent] = useState<Recipe | null>(null);

  // Subtle toast notification
  const [toast, setToast] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Apply dual-theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
    behaviorTracker.setTheme(theme);
  }, [theme]);

  // Initialize silent consumer behavioral tracker (never active in portals)
  useEffect(() => {
    if (superAdminPortal || advertiserPortal) return;
    behaviorTracker.start(theme);
  }, [superAdminPortal, advertiserPortal, theme]);

  // Track section transitions silently
  useEffect(() => {
    if (superAdminPortal || advertiserPortal) return;
    behaviorTracker.trackSectionChange(activeTab);
  }, [activeTab, superAdminPortal, advertiserPortal]);

  // Sync user dietary preferences from server (falls back cleanly to local storage)
  useEffect(() => {
    if (superAdminPortal || advertiserPortal) return;
    apiRequest<{preferences: UserDietaryPreferences}>('/api/preferences/diet', {
      headers: {'X-Lagheli-Client': getOrCreateClientKey()},
    })
      .then((res) => {
        if (res.preferences && (res.preferences.diets.length > 0 || res.preferences.excludedIngredients.length > 0)) {
          setDietaryPrefs(res.preferences);
          saveLocalDietaryPrefs(res.preferences);
        }
      })
      .catch(() => {});
  }, [user?.id, superAdminPortal, advertiserPortal]);

  const handleSaveDietaryPrefs = useCallback(
    async (next: UserDietaryPreferences) => {
      setDietaryPrefs(next);
      saveLocalDietaryPrefs(next);
      try {
        const res = await apiRequest<{preferences: UserDietaryPreferences}>('/api/preferences/diet', {
          method: 'PUT',
          headers: {'X-Lagheli-Client': getOrCreateClientKey()},
          body: JSON.stringify(next),
        });
        if (res.preferences) {
          setDietaryPrefs(res.preferences);
          saveLocalDietaryPrefs(res.preferences);
        }
        notify('سلیقه و رژیم غذایی شما ذخیره شد؛ تبلیغات ناسازگار مسدود می‌شوند.');
      } catch {
        notify('تنظیمات رژیم غذایی روی دستگاه شما ذخیره شد.');
      }
    },
    [notify]
  );

  // Strict Diet-Safe Hard-Blocking + Passive Affinity Boost for ALL Ad & Venue Surfaces
  const {safeNativeAds, dietBlockedAdsCount} = useMemo(() => {
    const filtered = filterAdsForUserDiet(nativeAds, dietaryPrefs);
    const passiveCats = loadPassiveAffinityCategories();
    return {
      safeNativeAds: personalizeSafeAdsByAffinity(filtered.safeAds, passiveCats),
      dietBlockedAdsCount: filtered.blockedCount,
    };
  }, [nativeAds, dietaryPrefs]);

  const safeLocalVenues = useMemo(
    () => filterVenuesForUserDiet(localVenues, dietaryPrefs),
    [localVenues, dietaryPrefs]
  );

  const safeFlagshipSponsorship = useMemo(
    () => (isFlagshipCompatibleWithUserDiet(flagshipSponsorship, dietaryPrefs) ? flagshipSponsorship : null),
    [flagshipSponsorship, dietaryPrefs]
  );

  useEffect(() => {
    if (dietBlockedAdsCount > 0 && !superAdminPortal && !advertiserPortal) {
      behaviorTracker.trackDietBlockedAds(
        dietBlockedAdsCount,
        [...dietaryPrefs.diets, ...dietaryPrefs.excludedIngredients].join(',')
      );
    }
  }, [dietBlockedAdsCount, dietaryPrefs.diets, dietaryPrefs.excludedIngredients, superAdminPortal, advertiserPortal]);

  // Sync popstate / deep-link params (user tabs vs isolated superadmin & advertiser portals)
  useEffect(() => {
    const syncFromUrl = () => {
      const isAdmin = isSuperAdminRoute();
      const isAdv = !isAdmin && isAdvertiserRoute();
      setSuperAdminPortal(isAdmin);
      setAdvertiserPortal(isAdv);
      if (isAdmin || isAdv) {
        setShowSplash(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as AppTab | null;
      if (tabParam && ['explore', 'kitchen', 'shopping', 'marketplace', 'profile'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const recipeParam = params.get('recipe');
      if (recipeParam) {
        setOpenRecipeId(recipeParam);
      }
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const exitPortalToUserApp = () => {
    try {
      const url = new URL(window.location.href);
      url.pathname = '/';
      url.searchParams.delete('portal');
      url.searchParams.delete('tab');
      window.history.pushState({}, '', url.toString());
    } catch {
      // Ignore history edge cases
    }
    setSuperAdminPortal(false);
    setAdvertiserPortal(false);
    setActiveTab('explore');
  };

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiRequest<{
        ecosystem: EcosystemConfig;
        nativeAds?: NativeAdUnit[];
        flagshipSponsorship?: FlagshipSponsorship | null;
        localVenues?: LocalVenueSuggestion[];
        quickTestLoginEnabled?: boolean;
      }>('/api/config');
      setEcosystemConfig(data.ecosystem);
      setNativeAds(data.nativeAds || []);
      setFlagshipSponsorship(data.flagshipSponsorship || null);
      setLocalVenues(data.localVenues || []);
      setQuickTestLoginEnabled(Boolean(data.quickTestLoginEnabled));
    } catch {
      // Offline fallback to current config
    }
  }, []);

  const loadShowcasePartners = useCallback(async () => {
    try {
      const data = await apiRequest<{partners: Partner[]}>('/api/partners');
      setShowcasePartners(data.partners);
    } catch {
      // Ignore offline
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.categories.length) params.set('categories', filters.categories.join(','));
      if (filters.seasons.length) params.set('seasons', filters.seasons.join(','));
      if (filters.regions.length) params.set('regions', filters.regions.join(','));
      if (filters.diets.length) params.set('diets', filters.diets.join(','));
      if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
      if (filters.followedOnly) params.set('followedOnly', 'true');
      if (filters.bookmarkedOnly && user) params.set('bookmarkedOnly', 'true');

      const data = await apiRequest<{recipes: Recipe[]}>(`/api/recipes?${params.toString()}`);
      let list = data.recipes;
      if (filters.bookmarkedOnly && !user) {
        const set = new Set(guestBookmarks);
        list = list.filter((r) => set.has(r.id));
      }
      setRecipes(list);
    } catch {
      // Retain cached list offline
    } finally {
      setLoadingRecipes(false);
    }
  }, [filters, user, guestBookmarks]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{user: UserProfile}>('/api/auth/me');
      setUser(res.user);
    } catch {
      // Not signed in
    }
  }, []);

  const loadServerShopping = useCallback(async () => {
    try {
      const res = await apiRequest<{items: ShoppingItem[]}>('/api/shopping');
      setShoppingItems(res.items);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadShowcasePartners();
  }, [loadConfig, loadShowcasePartners]);

  useEffect(() => {
    if (!superAdminPortal) {
      loadRecipes();
    }
  }, [loadRecipes, superAdminPortal]);

  // If dynamic config disables the currently viewed user tab, fall back cleanly to Explore
  useEffect(() => {
    const sections = ecosystemConfig.appSections;
    if (activeTab === 'kitchen' && sections?.kitchenTabEnabled === false) setActiveTab('explore');
    if (activeTab === 'shopping' && sections?.shoppingTabEnabled === false) setActiveTab('explore');
    if (activeTab === 'marketplace' && !ecosystemConfig.marketplaceTabEnabled) setActiveTab('explore');
  }, [activeTab, ecosystemConfig]);

  // Seamless Test-Mode Auto-Login for User App (never runs inside Super Admin portal)
  useEffect(() => {
    if (superAdminPortal || !quickTestLoginEnabled || user || userLoggedOutExplicitly) return;
    let cancelled = false;
    apiRequest<{token: string; user: UserProfile}>('/api/auth/quick-test-login', {
      method: 'POST',
      body: JSON.stringify({
        guestBookmarks: loadGuestBookmarks(),
      }),
    })
      .then((res) => {
        if (cancelled) return;
        setUserToken(res.token);
        setUser(res.user);
        loadServerShopping();
      })
      .catch(() => {
        // Ignore if disabled or offline
      });
    return () => {
      cancelled = true;
    };
  }, [superAdminPortal, quickTestLoginEnabled, user, userLoggedOutExplicitly, loadServerShopping]);

  // Merge/Consolidate Guest shopping items locally when not signed in
  const addShoppingItems = async (
    itemsToAdd: {
      name: string;
      amount: number;
      unit: string;
      category?: ShoppingCategory;
      recipeId?: string;
      recipeTitle?: string;
    }[]
  ) => {
    if (user) {
      try {
        const res = await apiRequest<{items: ShoppingItem[]}>('/api/shopping/bulk', {
          method: 'POST',
          body: JSON.stringify({items: itemsToAdd}),
        });
        setShoppingItems(res.items);
        notify(`${toFaDigits(itemsToAdd.length)} قلم به لیست خرید اضافه و دسته‌بندی شد.`);
        return;
      } catch {
        // Fallback offline local add
      }
    }

    setShoppingItems((prev) => {
      const next = [...prev];
      for (const incoming of itemsToAdd) {
        const canonical = canonicalizeIngredient(incoming.name);
        const category = incoming.category || classifyIngredientCategory(incoming.name);
        const matchIdx = next.findIndex(
          (i) =>
            !i.checked &&
            normalizePersian(i.canonicalName) === normalizePersian(canonical) &&
            normalizePersian(i.unit) === normalizePersian(incoming.unit || 'عدد')
        );
        if (matchIdx >= 0) {
          next[matchIdx] = {
            ...next[matchIdx],
            amount: Math.round((next[matchIdx].amount + incoming.amount) * 100) / 100,
          };
        } else {
          next.unshift({
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: incoming.name,
            canonicalName: canonical,
            amount: incoming.amount,
            unit: incoming.unit || 'عدد',
            category,
            recipeId: incoming.recipeId || null,
            recipeTitle: incoming.recipeTitle || null,
            checked: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
      saveGuestShopping(next);
      return next;
    });
    notify(`${toFaDigits(itemsToAdd.length)} قلم به لیست خرید اضافه و دسته‌بندی شد.`);
  };

  const handleToggleShoppingChecked = async (id: string, checked: boolean) => {
    setShoppingItems((prev) => {
      const next = prev.map((i) => (i.id === id ? {...i, checked} : i));
      if (!user) saveGuestShopping(next);
      return next;
    });
    if (user) {
      apiRequest(`/api/shopping/${id}`, {method: 'PATCH', body: JSON.stringify({checked})}).catch(() => {});
    }
  };

  const handleDeleteShoppingItem = async (id: string) => {
    setShoppingItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (!user) saveGuestShopping(next);
      return next;
    });
    if (user) {
      apiRequest(`/api/shopping/${id}`, {method: 'DELETE'}).catch(() => {});
    }
  };

  const handleClearShopping = async (mode: 'clear-checked' | 'clear-all') => {
    setShoppingItems((prev) => {
      const next = mode === 'clear-all' ? [] : prev.filter((i) => !i.checked);
      if (!user) saveGuestShopping(next);
      return next;
    });
    if (user) {
      apiRequest(`/api/shopping/${mode}`, {method: 'DELETE'}).catch(() => {});
    }
  };

  const handleToggleBookmark = async (recipeId: string) => {
    if (user) {
      try {
        const res = await apiRequest<{bookmarked: boolean}>(`/api/recipes/${recipeId}/bookmark`, {method: 'POST'});
        setRecipes((prev) => prev.map((r) => (r.id === recipeId ? {...r, isBookmarked: res.bookmarked} : r)));
        notify(res.bookmarked ? 'در فهرست نشانک‌ها ذخیره شد.' : 'از فهرست نشانک‌ها حذف شد.');
        return;
      } catch {
        // Fallback local
      }
    }
    setGuestBookmarks((prev) => {
      const exists = prev.includes(recipeId);
      const next = exists ? prev.filter((id) => id !== recipeId) : [...prev, recipeId];
      saveGuestBookmarks(next);
      notify(exists ? 'از نشانک‌های محلی حذف شد.' : 'به‌صورت محلی نشانک شد.');
      return next;
    });
  };

  const bookmarkedIdSet = new Set([
    ...guestBookmarks,
    ...recipes.filter((r) => r.isBookmarked).map((r) => r.id),
  ]);

  const shoppingRemainingCount = shoppingItems.filter((i) => !i.checked).length;

  const handleAuthSuccess = (loggedInUser: UserProfile) => {
    setUserLoggedOutExplicitly(false);
    setUser(loggedInUser);
    saveGuestBookmarks([]);
    setGuestBookmarks([]);
    saveGuestShopping([]);
    loadServerShopping();
    loadRecipes();
    notify(`خوش آمدید، ${loggedInUser.name}`);
  };

  const handleLogout = async () => {
    setUserLoggedOutExplicitly(true);
    await apiRequest('/api/auth/logout', {method: 'POST'}).catch(() => {});
    setUserToken(null);
    setUser(null);
    setShoppingItems(loadGuestShopping());
    notify('از حساب کاربری خارج شدید.');
  };

  const handleOpenPartnerProfile = (partner: Partner) => {
    setOpenRecipeId(null);
    setSelectedPartner(partner);
    setActiveTab('marketplace');
  };

  // =========================================================================
  // STRICTLY ISOLATED SUPER ADMIN PORTAL (INVISIBLE TO REGULAR APP USERS)
  // =========================================================================
  if (superAdminPortal) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA]">
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-5 md:py-8">
          <AdminDashboard
            onRefreshAppConfig={() => {
              loadConfig();
              loadShowcasePartners();
            }}
            onRefreshAppRecipes={loadRecipes}
            onBackToApp={exitPortalToUserApp}
            onNotify={notify}
          />
        </main>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] px-5 py-3 text-xs sm:text-sm font-medium shadow-lg max-w-[90vw] text-center"
          >
            {toast}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STRICTLY ISOLATED ADVERTISER / BRAND PORTAL (/advertiser)
  // =========================================================================
  if (advertiserPortal) {
    return (
      <>
        <AdvertiserPortal onBackToApp={exitPortalToUserApp} onNotify={notify} />
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] px-5 py-3 text-xs sm:text-sm font-medium shadow-lg max-w-[90vw] text-center"
          >
            {toast}
          </div>
        )}
      </>
    );
  }

  // =========================================================================
  // 100% RECIPE-FIRST CONSUMER APPLICATION (ZERO FOOD SALES, ZERO ADMIN LINKS)
  // =========================================================================
  const flagshipEnabled =
    ecosystemConfig.adHarmony?.adsEnabled !== false &&
    ecosystemConfig.adHarmony?.flagshipSponsorEnabled !== false;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA]">
      <SplashScreen visible={showSplash} onComplete={() => setShowSplash(false)} />

      <FlagshipTopStrip
        sponsorship={safeFlagshipSponsorship}
        enabled={flagshipEnabled}
        partners={showcasePartners}
        onOpenPartner={handleOpenPartnerProfile}
      />

      <TopHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        shoppingRemainingCount={shoppingRemainingCount}
        ecosystemConfig={ecosystemConfig}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onQuickSearch={() => {
          setActiveTab('explore');
          window.setTimeout(() => {
            const input = document.getElementById('lagheli-recipe-search') as HTMLInputElement | null;
            if (input) {
              input.scrollIntoView({behavior: 'smooth', block: 'center'});
              input.focus();
            }
          }, 80);
        }}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSubmitRecipe={() => {
          setVariationParent(null);
          setSubmitOpen(true);
        }}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-3 md:pt-8 pb-28 md:pb-16">
        {activeTab === 'explore' && (
          <RecipeFeed
            recipes={recipes}
            city={user?.city || 'تهران'}
            loading={loadingRecipes}
            filters={filters}
            onChangeFilters={setFilters}
            bookmarkedIds={bookmarkedIdSet}
            onToggleBookmark={handleToggleBookmark}
            onOpenRecipe={(rec) => {
              behaviorTracker.trackEvent('recipe_view', {
                sectionName: 'recipe_detail',
                targetType: 'recipe',
                targetId: rec.id,
                targetLabel: rec.title,
                category: rec.category,
                numericValue: 90,
              });
              setOpenRecipeId(rec.id);
            }}
            onOpenChef={(id) => {
              behaviorTracker.trackEvent('chef_view', {
                sectionName: 'recipe_detail',
                targetType: 'chef',
                targetId: id,
                targetLabel: 'پروفایل سرآشپز',
                numericValue: 20,
              });
              setOpenChefId(id);
            }}
            onQuickAddShopping={(rec) => {
              behaviorTracker.trackEvent('shopping_add', {
                sectionName: 'shopping',
                targetType: 'recipe',
                targetId: rec.id,
                targetLabel: rec.title,
                category: rec.category,
                numericValue: rec.ingredients.length,
              });
              addShoppingItems(
                rec.ingredients.map((i) => ({
                  name: i.name,
                  amount: i.amount,
                  unit: i.unit,
                  recipeId: rec.id,
                  recipeTitle: rec.title,
                }))
              );
            }}
            onJumpToKitchen={() => setActiveTab('kitchen')}
            ecosystemConfig={ecosystemConfig}
            showcasePartners={showcasePartners}
            nativeAds={safeNativeAds}
            onOpenPartner={(p) => {
              behaviorTracker.trackEvent('partner_view', {
                sectionName: 'marketplace',
                targetType: 'partner',
                targetId: p.id,
                targetLabel: p.name,
                category: 'برند همکار',
                numericValue: 25,
              });
              handleOpenPartnerProfile(p);
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'kitchen' && (
          <KitchenHub
            city={user?.city || 'تهران'}
            onOpenRecipe={(rec) => {
              behaviorTracker.trackEvent('recipe_view', {
                sectionName: 'kitchen',
                targetType: 'recipe',
                targetId: rec.id,
                targetLabel: rec.title,
                category: rec.category,
                numericValue: 75,
              });
              setOpenRecipeId(rec.id);
            }}
            onAddShoppingItems={(items) => {
              behaviorTracker.trackEvent('shopping_add', {
                sectionName: 'kitchen',
                targetType: 'tab',
                targetId: 'kitchen',
                numericValue: items.length,
              });
              return addShoppingItems(items);
            }}
            ecosystemConfig={ecosystemConfig}
            nativeAds={safeNativeAds}
            partners={showcasePartners}
            onOpenPartner={(p) => {
              behaviorTracker.trackEvent('partner_view', {
                sectionName: 'kitchen',
                targetType: 'partner',
                targetId: p.id,
                targetLabel: p.name,
                numericValue: 20,
              });
              handleOpenPartnerProfile(p);
            }}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListView
            items={shoppingItems}
            onAddManual={(item) => {
              behaviorTracker.trackEvent('shopping_add', {
                sectionName: 'shopping',
                targetType: 'tab',
                targetId: 'shopping',
                targetLabel: item.name,
                numericValue: 1,
              });
              return addShoppingItems([item]);
            }}
            onToggleChecked={handleToggleShoppingChecked}
            onDeleteItem={handleDeleteShoppingItem}
            onClearChecked={() => handleClearShopping('clear-checked')}
            onClearAll={() => handleClearShopping('clear-all')}
            ecosystemConfig={ecosystemConfig}
            nativeAds={safeNativeAds}
            partners={showcasePartners}
            onOpenPartner={(p) => {
              behaviorTracker.trackEvent('partner_view', {
                sectionName: 'shopping',
                targetType: 'partner',
                targetId: p.id,
                targetLabel: p.name,
                numericValue: 20,
              });
              handleOpenPartnerProfile(p);
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'marketplace' && (
          <MarketplaceView
            user={user}
            ecosystemConfig={ecosystemConfig}
            selectedPartner={selectedPartner}
            onSelectPartner={(p) => {
              if (p) {
                behaviorTracker.trackEvent('partner_view', {
                  sectionName: 'marketplace',
                  targetType: 'partner',
                  targetId: p.id,
                  targetLabel: p.name,
                  category: 'برند همکار',
                  numericValue: 30,
                });
              }
              setSelectedPartner(p);
            }}
            onRequireAuth={() => setAuthOpen(true)}
            onNotify={notify}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileAndAdminView
            user={user}
            theme={theme}
            dietaryPrefs={dietaryPrefs}
            dietBlockedAdsCount={dietBlockedAdsCount}
            onSaveDietaryPrefs={handleSaveDietaryPrefs}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            onReplaySplash={() => setShowSplash(true)}
            onOpenAuth={() => setAuthOpen(true)}
            onLogout={handleLogout}
            onOpenRecipe={(rec) => {
              behaviorTracker.trackEvent('recipe_view', {
                sectionName: 'recipe_detail',
                targetType: 'recipe',
                targetId: rec.id,
                targetLabel: rec.title,
                category: rec.category,
                numericValue: 80,
              });
              setOpenRecipeId(rec.id);
            }}
            onOpenSubmitRecipe={() => {
              if (!user) {
                setAuthOpen(true);
                return;
              }
              setVariationParent(null);
              setSubmitOpen(true);
            }}
            onRefreshUser={refreshUser}
            onNotify={notify}
          />
        )}
      </main>

      <FlagshipFooterBand
        sponsorship={safeFlagshipSponsorship}
        enabled={flagshipEnabled}
        partners={showcasePartners}
        onOpenPartner={handleOpenPartnerProfile}
      />

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        shoppingRemainingCount={shoppingRemainingCount}
        ecosystemConfig={ecosystemConfig}
        onOpenSubmitRecipe={() => {
          if (!user) {
            setAuthOpen(true);
            return;
          }
          setVariationParent(null);
          setSubmitOpen(true);
        }}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[88px] md:bottom-6 right-4 z-40 flex items-center gap-2 rounded-full bg-[#0D0D0D] text-[#FAFAFA] px-4 py-2.5 text-xs shadow-lg"
        >
          <WifiOff className="w-4 h-4 text-[#D8A85B]" />
          <span>حالت آفلاین — دسترسی به نشانک‌ها، لیست خرید و جایگزین‌ها فعال است.</span>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-18 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] px-5 py-3 text-xs sm:text-sm font-medium shadow-lg max-w-[90vw] text-center"
        >
          {toast}
        </div>
      )}

      <AuthModal
        open={authOpen}
        quickTestLoginEnabled={quickTestLoginEnabled}
        onClose={() => setAuthOpen(false)}
        guestBookmarks={guestBookmarks}
        guestShoppingItems={shoppingItems}
        onSuccess={handleAuthSuccess}
      />

      {openRecipeId && (
        <RecipeDetailModal
          recipeId={openRecipeId}
          adjacentRecipeIds={(() => {
            const idx = recipes.findIndex((r) => r.id === openRecipeId || r.slug === openRecipeId);
            if (idx < 0) return recipes.slice(0, 2).map((r) => r.id);
            return recipes.slice(idx + 1, idx + 3).map((r) => r.id);
          })()}
          user={user}
          city={user?.city || 'تهران'}
          isBookmarked={bookmarkedIdSet.has(openRecipeId)}
          ecosystemConfig={ecosystemConfig}
          nativeAds={safeNativeAds}
          localVenues={safeLocalVenues}
          partners={showcasePartners}
          onClose={() => setOpenRecipeId(null)}
          onToggleBookmark={handleToggleBookmark}
          onAddShoppingItems={addShoppingItems}
          onOpenChef={(chefId) => setOpenChefId(chefId)}
          onOpenPartner={handleOpenPartnerProfile}
          onOpenVariationSubmit={(parent) => {
            setOpenRecipeId(null);
            setVariationParent(parent);
            setSubmitOpen(true);
          }}
          onRefreshUser={refreshUser}
          onRequireAuth={() => setAuthOpen(true)}
          onNotify={notify}
        />
      )}

      {openChefId && (
        <ChefProfileModal
          chefId={openChefId}
          currentUser={user}
          onClose={() => setOpenChefId(null)}
          onSelectChef={(id) => setOpenChefId(id)}
          onOpenRecipe={(rec) => setOpenRecipeId(rec.id)}
          onRequireAuth={() => setAuthOpen(true)}
          onNotify={notify}
        />
      )}

      <SubmitRecipeModal
        open={submitOpen}
        parentRecipe={variationParent}
        onClose={() => {
          setSubmitOpen(false);
          setVariationParent(null);
        }}
        onSubmitted={loadRecipes}
        onNotify={notify}
      />
    </div>
  );
}
