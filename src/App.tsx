import {useCallback, useEffect, useState} from 'react';
import {WifiOff} from 'lucide-react';
import {AdminDashboard} from './components/AdminDashboard.tsx';
import {AuthModal} from './components/AuthModal.tsx';
import {ChefProfileModal} from './components/ChefProfileModal.tsx';
import {type CartEntry, EditorialOrderView} from './components/EditorialOrderView.tsx';
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
  canonicalizeIngredient,
  classifyIngredientCategory,
  normalizePersian,
  toFaDigits,
} from './shared/persianEngine.ts';
import type {
  EcosystemConfig,
  Partner,
  Recipe,
  ShoppingCategory,
  ShoppingItem,
  SponsorCampaign,
  UserProfile,
} from './shared/types.ts';

const INITIAL_CONFIG: EcosystemConfig = {
  marketplaceTabEnabled: true,
  marketplaceTitle: 'بازارچه و اصناف',
  exploreShowcaseEnabled: true,
  recipeContextEnabled: true,
  shoppingDeliveryCardEnabled: true,
  maxPartnerCardsPerRecipe: 1,
  enabledPartnerRoles: [
    'food_brands',
    'kitchen_equipment',
    'stores_supermarkets',
    'restaurants_kitchens',
    'cafes_bakeries',
    'chefs_nutritionists',
    'culinary_schools',
    'local_artisans',
    'catering_events',
    'instant_delivery',
  ],
  activeCampaignTitle: 'همکاران منتخب لاقلی',
};

export default function App() {
  const isOnline = useOnlineStatus();
  const [showSplash, setShowSplash] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadSavedTheme());
  const [activeTab, setActiveTab] = useState<AppTab>('explore');

  // Core data state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [quickTestLoginEnabled, setQuickTestLoginEnabled] = useState(false);
  const [userLoggedOutExplicitly, setUserLoggedOutExplicitly] = useState(false);
  const [ecosystemConfig, setEcosystemConfig] = useState<EcosystemConfig>(INITIAL_CONFIG);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [showcasePartners, setShowcasePartners] = useState<Partner[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<SponsorCampaign[]>([]);

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
  });

  // Guest Local-First / Synced Bookmarks & Shopping List
  const [guestBookmarks, setGuestBookmarks] = useState<string[]>(() => loadGuestBookmarks());
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => loadGuestShopping<ShoppingItem>());
  const [cart, setCart] = useState<CartEntry[]>([]);

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
  }, [theme]);

  // Read initial deep-link params (?tab= or ?recipe=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as AppTab | null;
    if (
      tabParam &&
      ['explore', 'kitchen', 'order', 'shopping', 'marketplace', 'profile', 'admin'].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
    const recipeParam = params.get('recipe');
    if (recipeParam) {
      setOpenRecipeId(recipeParam);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiRequest<{ecosystem: EcosystemConfig; quickTestLoginEnabled?: boolean}>('/api/config');
      setEcosystemConfig(data.ecosystem);
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

  const loadActiveCampaigns = useCallback(async () => {
    try {
      const data = await apiRequest<{campaigns: SponsorCampaign[]}>('/api/campaigns/active');
      setActiveCampaigns(data.campaigns || []);
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
      // Guest client-side bookmark filter
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
    loadActiveCampaigns();
  }, [loadConfig, loadShowcasePartners, loadActiveCampaigns]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Seamless Test-Mode Auto-Login for User Panel (only when server quickTestLoginEnabled is active and user hasn't explicitly logged out)
  useEffect(() => {
    if (!quickTestLoginEnabled || user || userLoggedOutExplicitly) return;
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
  }, [quickTestLoginEnabled, user, userLoggedOutExplicitly, loadServerShopping]);

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
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const deliveryPartner = showcasePartners.find((p) => p.roleType === 'instant_delivery');

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

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA]">
      {/* Brand Skillet + Egg Splash Screen */}
      <SplashScreen visible={showSplash} onComplete={() => setShowSplash(false)} />

      {/* Top Navigation */}
      <TopHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        shoppingRemainingCount={shoppingRemainingCount}
        cartCount={cartCount}
        ecosystemConfig={ecosystemConfig}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenSubmitRecipe={() => {
          setVariationParent(null);
          setSubmitOpen(true);
        }}
      />

      {/* Main Content Canvas */}
      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 pt-8 pb-28 md:pb-16 ${
          activeTab === 'admin' ? 'max-w-[1440px]' : 'max-w-6xl'
        }`}
      >
        {activeTab === 'explore' && (
          <RecipeFeed
            recipes={recipes}
            city={user?.city || 'تهران'}
            loading={loadingRecipes}
            filters={filters}
            onChangeFilters={setFilters}
            bookmarkedIds={bookmarkedIdSet}
            onToggleBookmark={handleToggleBookmark}
            onOpenRecipe={(rec) => setOpenRecipeId(rec.id)}
            onOpenChef={(id) => setOpenChefId(id)}
            onQuickAddShopping={(rec) =>
              addShoppingItems(
                rec.ingredients.map((i) => ({
                  name: i.name,
                  amount: i.amount,
                  unit: i.unit,
                  recipeId: rec.id,
                  recipeTitle: rec.title,
                }))
              )
            }
            onJumpToOrder={() => setActiveTab('order')}
            onJumpToKitchen={() => setActiveTab('kitchen')}
            ecosystemConfig={ecosystemConfig}
            showcasePartners={showcasePartners}
            activeCampaigns={activeCampaigns}
            onOpenPartner={(p) => {
              setSelectedPartner(p);
              setActiveTab('marketplace');
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'kitchen' && (
          <KitchenHub
            city={user?.city || 'تهران'}
            onOpenRecipe={(rec) => setOpenRecipeId(rec.id)}
            onAddShoppingItems={addShoppingItems}
          />
        )}

        {activeTab === 'order' && (
          <EditorialOrderView
            user={user}
            cart={cart}
            onChangeCart={setCart}
            onOpenLinkedRecipe={(recId) => setOpenRecipeId(recId)}
            onRefreshUser={refreshUser}
            onNotify={notify}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListView
            items={shoppingItems}
            onAddManual={(item) => addShoppingItems([item])}
            onToggleChecked={handleToggleShoppingChecked}
            onDeleteItem={handleDeleteShoppingItem}
            onClearChecked={() => handleClearShopping('clear-checked')}
            onClearAll={() => handleClearShopping('clear-all')}
            ecosystemConfig={ecosystemConfig}
            deliveryPartner={deliveryPartner}
            onOpenPartner={(p) => {
              setSelectedPartner(p);
              setActiveTab('marketplace');
            }}
            onNotify={notify}
          />
        )}

        {activeTab === 'marketplace' && (
          <MarketplaceView
            user={user}
            ecosystemConfig={ecosystemConfig}
            selectedPartner={selectedPartner}
            onSelectPartner={setSelectedPartner}
            onRequireAuth={() => setAuthOpen(true)}
            onNotify={notify}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileAndAdminView
            user={user}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            onReplaySplash={() => setShowSplash(true)}
            onOpenAdminPanel={() => setActiveTab('admin')}
            onOpenAuth={() => setAuthOpen(true)}
            onLogout={handleLogout}
            onOpenRecipe={(rec) => setOpenRecipeId(rec.id)}
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

        {activeTab === 'admin' && (
          <AdminDashboard
            onRefreshAppConfig={() => {
              loadConfig();
              loadShowcasePartners();
              loadActiveCampaigns();
            }}
            onRefreshAppRecipes={loadRecipes}
            onBackToApp={() => setActiveTab('explore')}
            onNotify={notify}
          />
        )}
      </main>

      {/* Quiet Editorial Footer (Desktop) */}
      <footer className="hidden md:block border-t border-[#E6E6E3] dark:border-[#242422] py-6 px-6 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span>لاقلی — سادگیِ اصیل، در هر وعده</span>
          <span>طراحی بومی فارسی · آماده کار در حالت آفلاین (PWA)</span>
        </div>
      </footer>

      {/* Interactive High-Contrast Floating Mobile Dock */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        shoppingRemainingCount={shoppingRemainingCount}
        cartCount={cartCount}
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

      {/* Offline Connectivity Banner */}
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

      {/* Subtle Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-18 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] px-5 py-3 text-xs sm:text-sm font-medium shadow-lg max-w-[90vw] text-center"
        >
          {toast}
        </div>
      )}

      {/* Modals */}
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
          onClose={() => setOpenRecipeId(null)}
          onToggleBookmark={handleToggleBookmark}
          onAddShoppingItems={addShoppingItems}
          onOpenChef={(chefId) => setOpenChefId(chefId)}
          onOpenPartner={(p) => {
            setOpenRecipeId(null);
            setSelectedPartner(p);
            setActiveTab('marketplace');
          }}
          onOpenVariationSubmit={(parent) => {
            setOpenRecipeId(null);
            setVariationParent(parent);
            setSubmitOpen(true);
          }}
          onJumpToOrder={() => setActiveTab('order')}
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
