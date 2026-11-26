import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  ArrowUpLeft,
  BadgeCheck,
  Bookmark,
  Camera,
  Clock,
  Coins,
  Flame,
  Lock,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {prefetchNextRecipes, prefetchRecipeDetail} from '../lib/recipePrefetch.ts';
import {shareRecipeWithWebShare} from '../lib/webShare.ts';
import {DEFAULT_AD_HARMONY, selectSmartFeedNativeAds} from '../shared/nativeAdEngine.ts';
import {PARTNER_ROLE_LABELS, estimateRecipeCost, formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {EcosystemConfig, NativeAdUnit, Partner, Recipe} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';
import {RecipeFeedSkeleton} from './EditorialSkeletons.tsx';
import {NativeAdSlot} from './NativeAdSlot.tsx';
import {ScrollTastePrompt, type QuickFlyoutFocus} from './ScrollTastePrompt.tsx';

export interface RecipeFilterState {
  q: string;
  categories: string[];
  seasons: string[];
  regions: string[];
  diets: string[];
  verifiedOnly: boolean;
  followedOnly: boolean;
  bookmarkedOnly: boolean;
  needsPhotoOnly?: boolean;
  maxTotalMinutes?: number | null;
}

interface RecipeFeedProps {
  recipes: Recipe[];
  city?: string;
  loading: boolean;
  filters: RecipeFilterState;
  onChangeFilters: (next: RecipeFilterState) => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenChef: (chefId: string) => void;
  onQuickAddShopping: (recipe: Recipe) => void;
  onJumpToKitchen?: () => void;
  ecosystemConfig: EcosystemConfig;
  showcasePartners: Partner[];
  nativeAds?: NativeAdUnit[];
  onOpenPartner: (partner: Partner) => void;
  onNotify: (msg: string) => void;
}

const QUICK_CATEGORIES = [
  'همه',
  'ناهار و شام',
  'پیش‌غذا و عصرانه',
  'وگان و گیاهی',
  'پخت سریع',
  'رژیمی و سبک',
  'پرپروتئین',
  'غذای شمالی',
];

const SEASONS = ['بهار', 'تابستان', 'پاییز', 'زمستان', 'چهارفصل'];
const REGIONS = ['تهران', 'گیلان', 'شیراز', 'اصفهان', 'خراسان'];
const DIETS = ['سنتی', 'گیاهی', 'رژیمی', 'پرپروتئین', 'بدون گلوتن', 'سریع', 'اقتصادی'];

function getEstimatedCookMinutes(recipe: Recipe): number {
  const prep = Math.max(0, Number(recipe.prepMinutes) || 0);
  const cook = Math.max(0, Number(recipe.cookMinutes) || 0);
  const directTotal = prep + cook;
  if (directTotal > 0) return directTotal;
  return (recipe.steps || []).reduce((sum, st) => sum + (Number(st.timerMinutes) || 0), 0);
}

/**
 * Custom hook inside RecipeFeed that counts meaningful user scroll steps
 * and triggers a non-blocking bottom-entry Quick-Filter Flyout (diets / maxTotalMinutes)
 * after every `interval` (default: 10) scrolls.
 */
export function useScrollQuickFilterFlyout({
  enabled,
  interval = 10,
  hasActiveTimeFilter,
  hasActiveDietFilter,
}: {
  enabled: boolean;
  interval?: number;
  hasActiveTimeFilter: boolean;
  hasActiveDietFilter: boolean;
}) {
  const [scrollCount, setScrollCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState<QuickFlyoutFocus>('maxTotalMinutes');
  const [muted, setMuted] = useState(false);

  const visibleRef = useRef(false);
  const expandedRef = useRef(false);
  const filterStateRef = useRef({hasActiveTimeFilter, hasActiveDietFilter});
  filterStateRef.current = {hasActiveTimeFilter, hasActiveDietFilter};

  const trackerRef = useRef({
    count: 0,
    lastY: typeof window !== 'undefined' ? window.scrollY : 0,
    accumulatedPx: 0,
    appearedAtCount: 0,
    appearedAtY: 0,
    expandedAtY: 0,
    suppressUntil: 0,
  });

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const suppressScrollCounting = useCallback((durationMs = 650) => {
    trackerRef.current.suppressUntil = Date.now() + durationMs;
    trackerRef.current.accumulatedPx = 0;
  }, []);

  useEffect(() => {
    if (!enabled || muted) return;

    trackerRef.current.lastY = window.scrollY;
    let rafId: number | null = null;
    let gestureTimer: number | null = null;

    const recordScrollStep = (currentY: number) => {
      const nextCount = trackerRef.current.count + 1;
      trackerRef.current.count = nextCount;
      setScrollCount(nextCount);

      // Respect user agency: if they ignore the collapsed Flyout and keep scrolling, hide it smoothly
      if (visibleRef.current && !expandedRef.current) {
        if (
          nextCount - trackerRef.current.appearedAtCount >= 2 ||
          Math.abs(currentY - trackerRef.current.appearedAtY) >= 240
        ) {
          visibleRef.current = false;
          setVisible(false);
        }
        return;
      }

      // If the user scrolls away while the Flyout is expanded, collapse quietly
      if (visibleRef.current && expandedRef.current) {
        if (Math.abs(currentY - trackerRef.current.expandedAtY) >= 220) {
          visibleRef.current = false;
          expandedRef.current = false;
          setExpanded(false);
          setVisible(false);
        }
        return;
      }

      // Surface the bottom-entry Flyout after every `interval` (10) scrolls
      if (nextCount > 0 && nextCount % interval === 0 && currentY > 120) {
        const cycle = Math.floor(nextCount / interval);
        const {hasActiveTimeFilter: hasTime, hasActiveDietFilter: hasDiet} = filterStateRef.current;

        let nextFocus: QuickFlyoutFocus;
        if (!hasTime && hasDiet) {
          nextFocus = 'maxTotalMinutes';
        } else if (hasTime && !hasDiet) {
          nextFocus = 'diets';
        } else {
          nextFocus = cycle % 2 === 1 ? 'maxTotalMinutes' : 'diets';
        }

        trackerRef.current.appearedAtCount = nextCount;
        trackerRef.current.appearedAtY = currentY;
        visibleRef.current = true;
        expandedRef.current = false;
        setFocus(nextFocus);
        setExpanded(false);
        setVisible(true);
      }
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const currentY = window.scrollY;
        const delta = Math.abs(currentY - trackerRef.current.lastY);
        trackerRef.current.lastY = currentY;

        if (Date.now() < trackerRef.current.suppressUntil || delta < 2) {
          return;
        }

        // Collapse expanded panel immediately if the user scrolls far away mid-gesture
        if (visibleRef.current && expandedRef.current && Math.abs(currentY - trackerRef.current.expandedAtY) >= 220) {
          visibleRef.current = false;
          expandedRef.current = false;
          setExpanded(false);
          setVisible(false);
        }

        trackerRef.current.accumulatedPx += delta;

        if (trackerRef.current.accumulatedPx >= 90) {
          trackerRef.current.accumulatedPx = 0;
          if (gestureTimer !== null) {
            window.clearTimeout(gestureTimer);
            gestureTimer = null;
          }
          recordScrollStep(currentY);
        } else if (trackerRef.current.accumulatedPx >= 28) {
          if (gestureTimer !== null) window.clearTimeout(gestureTimer);
          gestureTimer = window.setTimeout(() => {
            gestureTimer = null;
            if (trackerRef.current.accumulatedPx >= 28) {
              trackerRef.current.accumulatedPx = 0;
              recordScrollStep(window.scrollY);
            }
          }, 140);
        }
      });
    };

    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (gestureTimer !== null) window.clearTimeout(gestureTimer);
    };
  }, [enabled, muted, interval]);

  const expand = useCallback(() => {
    trackerRef.current.expandedAtY = window.scrollY;
    expandedRef.current = true;
    setExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    visibleRef.current = false;
    expandedRef.current = false;
    setExpanded(false);
    setVisible(false);
  }, []);

  const dismiss = useCallback(() => {
    visibleRef.current = false;
    expandedRef.current = false;
    setExpanded(false);
    setVisible(false);
  }, []);

  const mute = useCallback(() => {
    visibleRef.current = false;
    expandedRef.current = false;
    setMuted(true);
    setExpanded(false);
    setVisible(false);
  }, []);

  return {
    scrollCount,
    visible,
    expanded,
    focus,
    setFocus,
    expand,
    collapse,
    dismiss,
    mute,
    suppressScrollCounting,
  };
}


export function RecipeFeed({
  recipes,
  city = 'تهران',
  loading,
  filters,
  onChangeFilters,
  bookmarkedIds,
  onToggleBookmark,
  onOpenRecipe,
  onOpenChef,
  onQuickAddShopping,
  onJumpToKitchen,
  ecosystemConfig,
  showcasePartners,
  nativeAds = [],
  onOpenPartner,
  onNotify,
}: RecipeFeedProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [heroEdition, setHeroEdition] = useState<'daily' | 'weekly'>('daily');
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const feedSectionRef = useRef<HTMLElement | null>(null);

  // 10-scroll Quick-Filter Flyout hook (diets & maxTotalMinutes)
  const quickFlyout = useScrollQuickFilterFlyout({
    enabled: !loading && recipes.length > 0,
    interval: 10,
    hasActiveTimeFilter: Boolean(filters.maxTotalMinutes),
    hasActiveDietFilter: filters.diets.length > 0,
  });

  const toggleMulti = (key: 'categories' | 'seasons' | 'regions' | 'diets', value: string) => {
    const list = filters[key];
    const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
    onChangeFilters({...filters, [key]: next});
  };

  const activeFilterCount =
    filters.seasons.length +
    filters.regions.length +
    filters.diets.length +
    (filters.verifiedOnly ? 1 : 0) +
    (filters.followedOnly ? 1 : 0) +
    (filters.bookmarkedOnly ? 1 : 0) +
    (filters.needsPhotoOnly ? 1 : 0) +
    (filters.maxTotalMinutes ? 1 : 0);

  const clearAllFilters = () => {
    onChangeFilters({
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
  };

  const handleShare = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await shareRecipeWithWebShare(recipe);
    if (result.message) {
      onNotify(result.message);
    }
  };

  const displayedRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (filters.needsPhotoOnly && r.imageUrl && r.imageUrl.trim().length > 0) return false;
      if (filters.maxTotalMinutes && getEstimatedCookMinutes(r) > filters.maxTotalMinutes) return false;
      return true;
    });
  }, [recipes, filters.needsPhotoOnly, filters.maxTotalMinutes]);

  const photoLessCount = recipes.filter((r) => !r.imageUrl || r.imageUrl.trim().length === 0).length;
  const isCleanHome = !filters.q && filters.categories.length === 0 && activeFilterCount === 0;

  // Pick Daily and Weekly photographed Editor's Picks for the cinematic hero
  const photographedRecipes = useMemo(
    () => displayedRecipes.filter((r) => r.imageUrl && r.imageUrl.trim().length > 0),
    [displayedRecipes]
  );
  const dailyHero = isCleanHome ? photographedRecipes[0] || displayedRecipes[0] : undefined;
  const weeklyHero = isCleanHome && photographedRecipes.length > 1 ? photographedRecipes[1] : undefined;
  const heroRecipe = isCleanHome
    ? heroEdition === 'weekly' && weeklyHero
      ? weeklyHero
      : dailyHero
    : undefined;

  const gridRecipes = heroRecipe
    ? displayedRecipes.filter((r) => r.id !== heroRecipe.id)
    : displayedRecipes;

  const handleFlyoutSelectMaxMinutes = (minutes: number | null, feedback: string) => {
    onChangeFilters({...filters, maxTotalMinutes: minutes});
    onNotify(feedback);
    quickFlyout.dismiss();
    quickFlyout.suppressScrollCounting(700);
    window.setTimeout(() => {
      feedSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 80);
  };

  const handleFlyoutToggleDiet = (diet: string) => {
    const exists = filters.diets.includes(diet);
    toggleMulti('diets', diet);
    onNotify(exists ? `فیلتر سبک «${diet}» برداشته شد.` : `فیلتر سریع سبک «${diet}» اعمال شد.`);
  };

  // Prefetch the Editorial Hero recipe + top 2 cards quietly right after mount
  useEffect(() => {
    if (dailyHero) {
      prefetchRecipeDetail(dailyHero.id, city, {priority: 'low', imageUrl: dailyHero.imageUrl});
    }
    if (weeklyHero) {
      prefetchRecipeDetail(weeklyHero.id, city, {priority: 'low', imageUrl: weeklyHero.imageUrl});
    }
    if (gridRecipes.length > 0) {
      prefetchNextRecipes(gridRecipes, -1, city, 2);
    }
  }, [dailyHero?.id, weeklyHero?.id, gridRecipes.length, city]);

  // IntersectionObserver: prefetch visible cards + upcoming recipes smoothly
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined' || gridRecipes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const recId = el.dataset.prefetchId;
          const idx = Number(el.dataset.prefetchIndex);
          if (recId) {
            const target = gridRecipes[idx];
            prefetchRecipeDetail(recId, city, {priority: 'low', imageUrl: target?.imageUrl});
          }
          if (!Number.isNaN(idx)) {
            prefetchNextRecipes(gridRecipes, idx, city, 2);
          }
          observer.unobserve(el);
        }
      },
      {rootMargin: '240px 0px', threshold: 0.1}
    );

    const cards = container.querySelectorAll<HTMLElement>('[data-prefetch-id]');
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [gridRecipes, city]);

  const appSections = ecosystemConfig.appSections;
  const adHarmony = ecosystemConfig.adHarmony ?? DEFAULT_AD_HARMONY;
  const heroEnabled = appSections?.heroEnabled !== false;
  const searchBarEnabled = appSections?.searchBarEnabled !== false;
  const quickCategoriesEnabled = appSections?.quickCategoriesEnabled !== false;

  const quickCategories = useMemo(() => {
    const custom = appSections?.featuredCategories?.filter((c) => c.trim().length > 0) || [];
    if (custom.length === 0) return QUICK_CATEGORIES;
    return custom.includes('همه') ? custom : ['همه', ...custom];
  }, [appSections?.featuredCategories]);

  const feedStoryAdMap = useMemo(
    () =>
      selectSmartFeedNativeAds(
        gridRecipes,
        nativeAds,
        [...filters.categories, ...filters.diets, ...filters.regions, filters.q],
        adHarmony
      ),
    [gridRecipes, nativeAds, filters.categories, filters.diets, filters.regions, filters.q, adHarmony]
  );

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Optional Dynamic Editorial Notice Controlled from Super Admin Panel */}
      {appSections?.editorialNotice && appSections.editorialNotice.trim().length > 0 && (
        <div
          role="note"
          className="rounded-2xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#141413] px-4 py-3 text-xs sm:text-sm text-[#3F3F3B] dark:text-[#D1D1CC] flex items-center justify-between gap-3"
        >
          <p className="leading-relaxed">{appSections.editorialNotice}</p>
        </div>
      )}

      {/* Full-Bleed Dramatic Glassmorphic Editor's Pick Cover */}
      {heroEnabled && heroRecipe && isCleanHome && (
        <motion.section
          aria-label="انتخاب سردبیر"
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
          className="space-y-4"
        >
          {/* Quiet Desktop Editorial Masthead Strip (Hidden on Mobile so Food Cover Leads Immediately) */}
          <div className="hidden md:flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">
                {appSections?.heroTitle || 'آرشیو مرجع آشپزی لاقلی'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{toFaDigits(recipes.length)} دستور پخت فعال</span>
              {appSections?.heroSubtitle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate max-w-md">{appSections.heroSubtitle}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {photoLessCount > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeFilters({...filters, needsPhotoOnly: true})}
                  className="inline-flex items-center gap-1.5 text-[#B54B1F] dark:text-[#E29A6F] font-medium hover:underline min-h-[36px]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{toFaDigits(photoLessCount)} دستور در انتظار عکس واقعی (+۴۰ جِم)</span>
                </button>
              )}
              {onJumpToKitchen && appSections?.kitchenTabEnabled !== false && (
                <button
                  type="button"
                  onClick={onJumpToKitchen}
                  className="inline-flex items-center gap-1 hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] min-h-[36px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#A97222]" />
                  <span>با مواد یخچال چی بپزم؟</span>
                </button>
              )}
            </div>
          </div>

          {/* Immersive Full-Bleed Food Photography Cover — Dish Photo Takes Center Stage */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`باز کردن انتخاب سردبیر: ${heroRecipe.title}`}
            onClick={() => onOpenRecipe(heroRecipe)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenRecipe(heroRecipe);
              }
            }}
            onMouseEnter={() =>
              prefetchRecipeDetail(heroRecipe.id, city, {priority: 'high', imageUrl: heroRecipe.imageUrl})
            }
            onTouchStart={() =>
              prefetchRecipeDetail(heroRecipe.id, city, {priority: 'high', imageUrl: heroRecipe.imageUrl})
            }
            className="relative group cursor-pointer rounded-[26px] sm:rounded-[34px] overflow-hidden h-[72svh] min-h-[480px] max-h-[600px] sm:h-[560px] lg:h-[600px] flex flex-col justify-between border border-[#E6E6E3] dark:border-[#282825] shadow-[0_24px_64px_-28px_rgba(0,0,0,0.5)] bg-[#0B0B0B]"
          >
            {/* Full-Bleed Crisp Food Photography */}
            <AnimatePresence mode="wait">
              <motion.div
                key={heroRecipe.id}
                initial={{opacity: 0.45, scale: 1.03}}
                animate={{opacity: 1, scale: 1}}
                exit={{opacity: 0.35}}
                transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
                className="absolute inset-0"
              >
                <EditorialImage
                  src={heroRecipe.imageUrl}
                  alt={heroRecipe.title}
                  category={heroRecipe.category}
                  aspectClass="w-full h-full"
                  className="h-full w-full"
                  priority
                />
              </motion.div>
            </AnimatePresence>

            {/* Crystal-Clear Center Photo Window: Subtle Top Vignette + Clean Bottom Scrim Only */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-black/82 via-black/32 to-transparent"
            />

            {/* Single-Row Slim Floating Top Bar (Never Wraps on Mobile!) */}
            <div className="relative z-10 p-3 sm:p-6 lg:p-7 flex items-center justify-between gap-2 flex-nowrap">
              <div
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center p-0.5 sm:p-1 rounded-full bg-[#0B0B0B]/46 backdrop-blur-[14px] border border-white/20 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setHeroEdition('daily')}
                  className={`min-h-[34px] sm:min-h-[36px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                    heroEdition === 'daily'
                      ? 'bg-[#FFFFFF] text-[#0B0B0B] shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">انتخاب روز</span>
                  <span className="hidden sm:inline">انتخاب روز سردبیر</span>
                </button>
                {weeklyHero && (
                  <button
                    type="button"
                    onClick={() => setHeroEdition('weekly')}
                    className={`min-h-[34px] sm:min-h-[36px] px-3 sm:px-4 rounded-full text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                      heroEdition === 'weekly'
                        ? 'bg-[#FFFFFF] text-[#0B0B0B] shadow-xs'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    <span className="sm:hidden">هفته</span>
                    <span className="hidden sm:inline">انتخاب ویژه هفته</span>
                  </button>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 sm:gap-3 rounded-full bg-[#0B0B0B]/48 backdrop-blur-[14px] border border-white/20 px-2.5 sm:px-3.5 min-h-[36px] sm:min-h-[38px] text-[11px] sm:text-xs font-semibold text-white tabular-nums shrink-0 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D8A85B]" aria-hidden="true" />
                  <span>{toFaDigits(getEstimatedCookMinutes(heroRecipe))} دقیقه</span>
                </span>
                <span aria-hidden="true" className="text-white/30">·</span>
                {(() => {
                  const heroCost =
                    heroRecipe.estimatedCost ?? estimateRecipeCost(heroRecipe.ingredients, heroRecipe.servings);
                  return (
                    <span
                      title={`سطح اقتصادی: ${heroCost.tier} — حدود ${formatToman(heroCost.perServingToman)} تومان هر پرس`}
                      className="inline-flex items-center gap-1"
                    >
                      <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#D8A85B]" aria-hidden="true" />
                      <span>{heroCost.tier}</span>
                    </span>
                  );
                })()}
                <span aria-hidden="true" className="hidden sm:inline text-white/30">·</span>
                <span className="hidden sm:inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#E29A6F]" aria-hidden="true" />
                  <span>{toFaDigits(heroRecipe.nutrition.calories)} کالری</span>
                </span>
              </div>
            </div>

            {/* Sleek Low-Profile Bottom Frosted Glass Card (Leaves Upper ~65% Pure Dish Photography!) */}
            <div className="relative z-10 p-3 sm:p-6 lg:p-7 mt-auto">
              <div className="max-w-2xl rounded-[20px] sm:rounded-[26px] bg-[#10100F]/46 backdrop-blur-[18px] border border-white/22 shadow-[0_20px_48px_-18px_rgba(0,0,0,0.72)] p-3.5 sm:p-6 lg:p-7 space-y-2.5 sm:space-y-4 transition-all duration-300 group-hover:bg-[#10100F]/56 group-hover:border-white/32">
                {/* Single-line Crisp Editorial Kicker */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-white/85 tabular-nums truncate">
                  <span className="font-bold text-[#E29A6F] shrink-0">
                    {heroEdition === 'weekly' ? 'انتخاب ویژه هفته' : 'پیشنهاد سردبیر'}
                  </span>
                  <span aria-hidden="true" className="text-white/35">·</span>
                  <span className="truncate">{heroRecipe.region}</span>
                  <span aria-hidden="true" className="text-white/35">·</span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <Users className="w-3 h-3 text-[#D8A85B]" aria-hidden="true" />
                    {toFaDigits(heroRecipe.servings)} نفر
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline text-white/35">·</span>
                  <span className="hidden sm:inline shrink-0">سختی {heroRecipe.difficulty}</span>
                </div>

                {/* Bold Editorial Headline + Desktop Description */}
                <div className="space-y-1.5">
                  <h1 className="text-lg sm:text-3xl lg:text-[2.35rem] font-extrabold leading-[1.3] tracking-tight text-white line-clamp-2">
                    {heroRecipe.title}
                  </h1>
                  <p className="hidden sm:block text-sm text-white/82 leading-[1.8] line-clamp-2 max-w-xl">
                    {heroRecipe.description}
                  </p>
                </div>

                {/* Compact Single-Row Action Bar */}
                <div className="pt-1 sm:pt-2 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecipe(heroRecipe);
                      }}
                      className="min-h-[40px] sm:min-h-[46px] px-4 sm:px-6 rounded-full bg-[#FFFFFF] hover:bg-[#EFEFED] active:scale-[0.98] text-[#0B0B0B] text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 shadow-md transition-all whitespace-nowrap"
                    >
                      <span className="sm:hidden">مشاهده دستور پخت</span>
                      <span className="hidden sm:inline">مشاهده دستور و شروع آشپزی</span>
                      <ArrowUpLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChef(heroRecipe.authorId);
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-white/85 hover:text-white min-h-[40px] shrink-0 transition-colors"
                  >
                    <span>از {heroRecipe.authorName}</span>
                    {heroRecipe.authorVerified && (
                      <BadgeCheck className="w-4 h-4 text-[#D8A85B]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Calm Search & Structured Category Filter Bar */}
      {(searchBarEnabled || quickCategoriesEnabled) && (
      <section aria-label="جست‌وجو و فیلتر دستورها" className="space-y-4">
        {searchBarEnabled && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5C5C58] dark:text-[#A3A39E] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="lagheli-recipe-search"
              type="search"
              value={filters.q}
              onChange={(e) => onChangeFilters({...filters, q: e.target.value})}
              placeholder="جست‌وجو میان هزاران دستور پخت، مواد اولیه، شهر یا سرآشپز..."
              aria-label="جست‌وجوی دستور پخت"
              className="w-full min-h-[50px] rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] pr-11 pl-5 text-sm placeholder:text-[#5C5C58]/75 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`min-h-[50px] px-5 rounded-full border text-sm font-medium inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
              showAdvanced || activeFilterCount > 0
                ? 'border-[#0D0D0D] bg-[#0D0D0D] text-[#FFFFFF] dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                : 'border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-[#0D0D0D] dark:text-[#FAFAFA]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>فیلتر دقیق</span>
            {activeFilterCount > 0 && (
              <span className="tabular-nums text-xs">({toFaDigits(activeFilterCount)})</span>
            )}
          </button>
        </div>
        )}

        {/* Interactive Category Segmented Bar + Community Photo Contribution Filter */}
        {quickCategoriesEnabled && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {quickCategories.map((cat) => {
            const isAll = cat === 'همه';
            const active = isAll
              ? filters.categories.length === 0 && !filters.needsPhotoOnly
              : filters.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  isAll
                    ? onChangeFilters({...filters, categories: [], needsPhotoOnly: false})
                    : toggleMulti('categories', cat)
                }
                className={`min-h-[42px] px-4 rounded-full text-sm whitespace-nowrap shrink-0 transition-all active:scale-[0.97] ${
                  active
                    ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] font-semibold'
                    : 'bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {cat}
              </button>
            );
          })}
          {photoLessCount > 0 && (
            <button
              type="button"
              onClick={() => onChangeFilters({...filters, needsPhotoOnly: !filters.needsPhotoOnly})}
              className={`min-h-[42px] px-4 rounded-full text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                filters.needsPhotoOnly
                  ? 'bg-[#0D0D0D] text-white dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-semibold'
                  : 'border border-[#B54B1F]/35 bg-[#FFFFFF] dark:bg-[#151514] text-[#B54B1F] dark:text-[#E29A6F]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>در انتظار عکس شما ({toFaDigits(photoLessCount)})</span>
            </button>
          )}
        </div>
        )}

        {/* Expandable Faceted OR/AND Filter Drawer */}
        {showAdvanced && (
          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">فیلتر چندوجهی (ترکیب دقیق)</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-[#5C5C58] hover:text-[#0D0D0D] dark:text-[#A3A39E] inline-flex items-center gap-1 min-h-[40px] px-2"
              >
                <X className="w-3.5 h-3.5" />
                <span>پاک‌کردن همه فیلترها</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mb-2">حداکثر زمان پخت</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {label: 'همه زمان‌ها', val: null},
                    {label: 'زیر ۳۰ دقیقه', val: 30},
                    {label: 'تا ۶۰ دقیقه', val: 60},
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => onChangeFilters({...filters, maxTotalMinutes: t.val})}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        (filters.maxTotalMinutes ?? null) === t.val
                          ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                          : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mb-2">فصل مناسب</p>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleMulti('seasons', s)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.seasons.includes(s)
                          ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                          : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mb-2">منطقه و اصالت</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleMulti('regions', r)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.regions.includes(r)
                          ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                          : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mb-2">سبک تغذیه و رژیم</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleMulti('diets', d)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.diets.includes(d)
                          ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                          : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[#E6E6E3] dark:border-[#282825] text-sm">
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) => onChangeFilters({...filters, verifiedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>فقط سرآشپزهای تاییدشده</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.bookmarkedOnly}
                  onChange={(e) => onChangeFilters({...filters, bookmarkedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>فقط نشانک‌شده‌ها</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.followedOnly}
                  onChange={(e) => onChangeFilters({...filters, followedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>فقط آشپزهای دنبال‌شده</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(filters.needsPhotoOnly)}
                  onChange={(e) => onChangeFilters({...filters, needsPhotoOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#A97222]"
                />
                <span>فقط دستورهای نیازمند عکس واقعی (+۴۰ جِم)</span>
              </label>
            </div>
          </div>
        )}
      </section>
      )}

      {/* Minimalist Editorial Recipe Cards Grid */}
      <section ref={feedSectionRef} aria-label="فهرست دستورهای پخت" className="space-y-6 scroll-mt-24">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA]">
              {filters.needsPhotoOnly
                ? `دستورهای در انتظار عکس واقعی شما (${toFaDigits(displayedRecipes.length)})`
                : filters.q || filters.categories.length > 0 || activeFilterCount > 0
                  ? `نتایج متناسب با سلیقه شما (${toFaDigits(displayedRecipes.length)})`
                  : 'منتخب آرشیو دستورهای پخت'}
            </h2>
            {(filters.q || filters.categories.length > 0 || activeFilterCount > 0) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-[#B54B1F] dark:text-[#E29A6F] hover:underline min-h-[44px] px-2 shrink-0"
              >
                نمایش همه دستورها
              </button>
            )}
          </div>

          {/* Active Taste/Filter Removable Controls */}
          {(filters.maxTotalMinutes ||
            filters.diets.length > 0 ||
            filters.seasons.length > 0 ||
            filters.regions.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {filters.maxTotalMinutes && (
                <button
                  type="button"
                  onClick={() => onChangeFilters({...filters, maxTotalMinutes: null})}
                  className="min-h-[36px] px-3 rounded-full bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-medium inline-flex items-center gap-1.5"
                >
                  <Clock className="w-3 h-3" />
                  <span>تا {toFaDigits(filters.maxTotalMinutes)} دقیقه</span>
                  <X className="w-3 h-3 opacity-75" />
                </button>
              )}
              {filters.diets.map((d) => (
                <button
                  key={`active-diet-${d}`}
                  type="button"
                  onClick={() => toggleMulti('diets', d)}
                  className="min-h-[36px] px-3 rounded-full bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-medium inline-flex items-center gap-1.5"
                >
                  <span>سبک {d}</span>
                  <X className="w-3 h-3 opacity-75" />
                </button>
              ))}
              {filters.seasons.map((s) => (
                <button
                  key={`active-season-${s}`}
                  type="button"
                  onClick={() => toggleMulti('seasons', s)}
                  className="min-h-[36px] px-3 rounded-full bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-medium inline-flex items-center gap-1.5"
                >
                  <span>فصل {s}</span>
                  <X className="w-3 h-3 opacity-75" />
                </button>
              ))}
              {filters.regions.map((r) => (
                <button
                  key={`active-region-${r}`}
                  type="button"
                  onClick={() => toggleMulti('regions', r)}
                  className="min-h-[36px] px-3 rounded-full bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-medium inline-flex items-center gap-1.5"
                >
                  <span>خطه {r}</span>
                  <X className="w-3 h-3 opacity-75" />
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <RecipeFeedSkeleton includeHero={isCleanHome && !heroRecipe} />
        ) : gridRecipes.length === 0 ? (
          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-12 text-center space-y-3">
            <p className="text-base font-medium">دستور پختی با این فیلترها پیدا نشد.</p>
            <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">
              فیلترها را ساده‌تر کنید یا عبارت دیگری جست‌وجو نمایید.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[44px] px-5 rounded-xl bg-[#B54B1F] text-[#FAFAFA] text-sm font-medium mt-2"
            >
              پاک‌کردن فیلترها
            </button>
          </div>
        ) : (
          <div ref={gridContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {gridRecipes.map((recipe, idx) => {
              const isBookmarked = bookmarkedIds.has(recipe.id) || Boolean(recipe.isBookmarked);
              const totalTime = getEstimatedCookMinutes(recipe);
              const estimatedCost =
                recipe.estimatedCost ?? estimateRecipeCost(recipe.ingredients, recipe.servings);
              const timeBreakdown = `زمان پخت تقریبی: ${toFaDigits(totalTime)} دقیقه (آماده‌سازی ${toFaDigits(recipe.prepMinutes)} + پخت ${toFaDigits(recipe.cookMinutes)} دقیقه)`;
              const costBreakdown = `سطح اقتصادی: ${estimatedCost.tier} — برآورد میانگین مواد اولیه حدود ${formatToman(estimatedCost.perServingToman)} تومان برای هر پرس (مجموع ${formatToman(estimatedCost.totalToman)} تومان)`;
              const storyAd = feedStoryAdMap.get(idx);
              return (
                <Fragment key={recipe.id}>
                <article
                  data-prefetch-id={recipe.id}
                  data-prefetch-index={idx}
                  onClick={() => onOpenRecipe(recipe)}
                  onMouseEnter={() => {
                    prefetchRecipeDetail(recipe.id, city, {priority: 'high', imageUrl: recipe.imageUrl});
                    prefetchNextRecipes(gridRecipes, idx, city, 1);
                  }}
                  onTouchStart={() =>
                    prefetchRecipeDetail(recipe.id, city, {priority: 'high', imageUrl: recipe.imageUrl})
                  }
                  className="group cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    {/* Clean Photography OR Kinfolk Typographic Cover with Cooking Time + Economical Cost Indicator */}
                    <div className="relative rounded-2xl overflow-hidden border border-[#E6E6E3]/80 dark:border-[#282825] shadow-[0_8px_28px_-22px_rgba(28,27,24,0.28)] transition-shadow duration-300 group-hover:shadow-[0_14px_34px_-20px_rgba(28,27,24,0.34)]">
                      <EditorialImage
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        category={recipe.category}
                        photoCreditName={recipe.photoCreditName}
                        aspectClass="aspect-video"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />

                      {/* Unified Visual Cooking Time & Economy Cost Indicator */}
                      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-xl bg-[#0B0B0B]/74 dark:bg-[#0B0B0B]/84 backdrop-blur-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-[#FAFAFA] tabular-nums shadow-xs">
                        <span title={timeBreakdown} aria-label={timeBreakdown} className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#D8A85B] shrink-0" aria-hidden="true" />
                          <span>{toFaDigits(totalTime)} دقیقه</span>
                        </span>
                        <span aria-hidden="true" className="h-3 w-px bg-white/22" />
                        <span
                          title={costBreakdown}
                          aria-label={costBreakdown}
                          className="inline-flex items-center gap-1"
                        >
                          <Coins
                            className={`w-3.5 h-3.5 shrink-0 ${
                              estimatedCost.level === 1
                                ? 'text-[#D8A85B]'
                                : estimatedCost.level === 2
                                  ? 'text-[#E29A6F]'
                                  : 'text-[#FAFAFA]'
                            }`}
                            aria-hidden="true"
                          />
                          <span>{estimatedCost.tier}</span>
                        </span>
                      </div>
                    </div>

                    {/* Unboxed Clean Metadata Line */}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{recipe.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{recipe.region}</span>
                        {recipe.isVip && !recipe.isUnlocked && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#A97222] dark:text-[#D8A85B] font-medium">
                              <Lock className="w-3 h-3" /> ویژه ({toFaDigits(recipe.vipGemCost)} جِم)
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[#5C5C58] dark:text-[#A3A39E] shrink-0">
                        {recipe.difficulty}
                      </span>
                    </div>

                    {/* Title & Short Editorial Subtitle */}
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold leading-snug text-[#0D0D0D] dark:text-[#FAFAFA] group-hover:text-[#B54B1F] dark:group-hover:text-[#E29A6F] transition-colors">
                        {recipe.title}
                      </h3>
                      <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] line-clamp-2 leading-relaxed">
                        {recipe.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Calm Footer: Chef & Actions (Bookmark Only — Quiet Luxury) */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E6E6E3]/70 dark:border-[#282825]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChef(recipe.authorId);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] min-h-[44px] truncate"
                    >
                      <span className="truncate">{recipe.authorName}</span>
                      {recipe.authorVerified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />
                      )}
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label="افزودن مواد به لیست خرید"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddShopping(recipe);
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5C5C58] hover:text-[#B54B1F] dark:text-[#A3A39E] dark:hover:text-[#E29A6F] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="اشتراک‌گذاری دستور پخت"
                        onClick={(e) => handleShare(recipe, e)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5C5C58] hover:text-[#B54B1F] dark:text-[#A3A39E] dark:hover:text-[#E29A6F] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={isBookmarked ? 'حذف از نشانک‌ها' : 'افزودن به نشانک‌ها'}
                        aria-pressed={isBookmarked}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(recipe.id);
                        }}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
                          isBookmarked
                            ? 'text-[#B54B1F] dark:text-[#E29A6F]'
                            : 'text-[#5C5C58] dark:text-[#A3A39E] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]'
                        }`}
                      >
                        <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                </article>
                {storyAd && (
                  <NativeAdSlot
                    ad={storyAd}
                    disclosureLabel={adHarmony.disclosureLabel}
                    partners={showcasePartners}
                    onOpenPartner={onOpenPartner}
                  />
                )}
                </Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* Quiet Editorial Partner Showcase (Zero Hollow Discounts) */}
      {ecosystemConfig.exploreShowcaseEnabled && showcasePartners.length > 0 && (
        <section
          aria-label="برندهای همکار منتخب آشپزخانه"
          className="border-t border-[#E6E6E3] dark:border-[#282825] pt-10 space-y-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">اکوسیستم برندهای همکار لاقلی</p>
              <h2 className="text-lg font-bold mt-0.5">
                {ecosystemConfig.activeCampaignTitle || 'برندها و تولیدکنندگان منتخب آشپزخانه'}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {showcasePartners.slice(0, 3).map((partner) => (
              <button
                key={partner.id}
                type="button"
                onClick={() => onOpenPartner(partner)}
                className="text-right rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 hover:border-[#B54B1F]/50 dark:hover:border-[#E29A6F]/50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  <span>{PARTNER_ROLE_LABELS[partner.roleType]}</span>
                  <span>{partner.city}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{partner.name}</h3>
                  {partner.verified && (
                    <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] line-clamp-2 leading-relaxed">
                  {partner.description}
                </p>
                <p className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] pt-1">
                  مشاهده صفحه برند
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 10-Scroll Bottom-Entry Quick-Filter Flyout (diets & maxTotalMinutes) */}
      <ScrollTastePrompt
        visible={quickFlyout.visible}
        expanded={quickFlyout.expanded}
        focus={quickFlyout.focus}
        filters={filters}
        onChangeFocus={quickFlyout.setFocus}
        onExpand={quickFlyout.expand}
        onCollapse={quickFlyout.collapse}
        onSelectMaxMinutes={handleFlyoutSelectMaxMinutes}
        onToggleDiet={handleFlyoutToggleDiet}
        onDismiss={quickFlyout.dismiss}
        onMuteSession={quickFlyout.mute}
      />
    </div>
  );
}
