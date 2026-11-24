import {useEffect, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {
  ArrowUpLeft,
  BadgeCheck,
  Bookmark,
  Camera,
  Clock,
  Copy,
  Flame,
  Lock,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {prefetchNextRecipes, prefetchRecipeDetail} from '../lib/recipePrefetch.ts';
import {shareRecipeWithWebShare} from '../lib/webShare.ts';
import {PARTNER_ROLE_LABELS, toFaDigits} from '../shared/persianEngine.ts';
import type {EcosystemConfig, Partner, Recipe, SponsorCampaign} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';
import {RecipeFeedSkeleton} from './EditorialSkeletons.tsx';

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
  onJumpToOrder: (dishId?: string | null) => void;
  onJumpToKitchen?: () => void;
  ecosystemConfig: EcosystemConfig;
  showcasePartners: Partner[];
  activeCampaigns?: SponsorCampaign[];
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
  onJumpToOrder,
  onJumpToKitchen,
  ecosystemConfig,
  showcasePartners,
  activeCampaigns = [],
  onOpenPartner,
  onNotify,
}: RecipeFeedProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

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
    (filters.needsPhotoOnly ? 1 : 0);

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
    });
  };

  const handleShare = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await shareRecipeWithWebShare(recipe);
    if (result.message) {
      onNotify(result.message);
    }
  };

  const displayedRecipes = filters.needsPhotoOnly
    ? recipes.filter((r) => !r.imageUrl || r.imageUrl.trim().length === 0)
    : recipes;

  const photoLessCount = recipes.filter((r) => !r.imageUrl || r.imageUrl.trim().length === 0).length;
  const isCleanHome = !filters.q && filters.categories.length === 0 && activeFilterCount === 0;
  // Prefer a photographed recipe as the editorial cover hero
  const heroRecipe = isCleanHome
    ? displayedRecipes.find((r) => r.imageUrl && r.imageUrl.trim().length > 0) || displayedRecipes[0]
    : undefined;
  const gridRecipes = heroRecipe
    ? displayedRecipes.filter((r) => r.id !== heroRecipe.id)
    : displayedRecipes;

  // Prefetch the Editorial Hero recipe + top 2 cards quietly right after mount
  useEffect(() => {
    if (heroRecipe) {
      prefetchRecipeDetail(heroRecipe.id, city, {priority: 'low', imageUrl: heroRecipe.imageUrl});
    }
    if (gridRecipes.length > 0) {
      prefetchNextRecipes(gridRecipes, -1, city, 2);
    }
  }, [heroRecipe?.id, gridRecipes.length, city]);

  // Shared IntersectionObserver: prefetch visible cards + next 2 upcoming recipes as user scrolls
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
      {rootMargin: '420px 0px', threshold: 0.01}
    );

    const cards = container.querySelectorAll<HTMLElement>('[data-prefetch-id]');
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [gridRecipes, city]);

  const exploreCampaign = activeCampaigns.find((c) => c.placement === 'explore_showcase');

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Editorial Cover Spread (Magazine-grade First Impression on Clean Feed) */}
      {heroRecipe && isCleanHome && (
        <motion.section
          aria-label="پیشنهاد سردبیر امروز"
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
          className="space-y-6 pb-12 border-b border-[#E6E6E3] dark:border-[#282825]"
        >
          {/* Architectural Editorial Masthead Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C5C58] dark:text-[#A3A39E] pb-3 border-b border-[#E6E6E3]/70 dark:border-[#282825]">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">
                آرشیو مرجع آشپزی لاقلی
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{toFaDigits(recipes.length)} دستور پخت فعال</span>
            </div>
            <div className="flex items-center gap-4">
              {photoLessCount > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeFilters({...filters, needsPhotoOnly: true})}
                  className="inline-flex items-center gap-1.5 text-[#B54B1F] dark:text-[#E29A6F] font-medium hover:underline min-h-[36px]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{toFaDigits(photoLessCount)} دستور در انتظار عکس واقعی شما (+۴۰ جِم)</span>
                </button>
              )}
              {onJumpToKitchen && (
                <button
                  type="button"
                  onClick={onJumpToKitchen}
                  className="hidden sm:inline-flex items-center gap-1 hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] min-h-[36px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#A97222]" />
                  <span>با مواد یخچال چی بپزم؟</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div
              onClick={() => onOpenRecipe(heroRecipe)}
              onMouseEnter={() =>
                prefetchRecipeDetail(heroRecipe.id, city, {priority: 'high', imageUrl: heroRecipe.imageUrl})
              }
              onTouchStart={() =>
                prefetchRecipeDetail(heroRecipe.id, city, {priority: 'high', imageUrl: heroRecipe.imageUrl})
              }
              className="lg:col-span-7 group cursor-pointer rounded-3xl overflow-hidden border border-[#E6E6E3]/80 dark:border-[#282825] shadow-[0_12px_40px_-24px_rgba(28,27,24,0.22)]"
            >
              <EditorialImage
                src={heroRecipe.imageUrl}
                alt={heroRecipe.title}
                category={heroRecipe.category}
                photoCreditName={heroRecipe.photoCreditName}
                aspectClass="aspect-[16/10] lg:h-full"
                priority
              />
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between gap-8 py-1">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F]">منتخب سردبیر امروز</span>
                  <span aria-hidden="true">·</span>
                  <span>{heroRecipe.region}</span>
                  <span aria-hidden="true">·</span>
                  <span>سختی {heroRecipe.difficulty}</span>
                </div>

                <h1 className="text-3xl sm:text-[2.35rem] font-extrabold leading-[1.3] tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA]">
                  {heroRecipe.title}
                </h1>

                <p className="text-sm sm:text-base text-[#5C5C58] dark:text-[#A3A39E] leading-[1.85]">
                  {heroRecipe.description}
                </p>

                {/* Architectural Tabular Metrics Strip (Zero Pills) */}
                <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#E6E6E3]/80 dark:border-[#282825] tabular-nums">
                  <div>
                    <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">زمان کل</div>
                    <div className="text-sm font-bold mt-0.5 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                      <span>{toFaDigits(heroRecipe.prepMinutes + heroRecipe.cookMinutes)} دقیقه</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">انرژی هر پرس</div>
                    <div className="text-sm font-bold mt-0.5 inline-flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-[#A97222]" />
                      <span>{toFaDigits(heroRecipe.nutrition.calories)} کالری</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">تعداد نفرات</div>
                    <div className="text-sm font-bold mt-0.5">{toFaDigits(heroRecipe.servings)} نفر</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChef(heroRecipe.authorId)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] hover:text-[#B54B1F] dark:hover:text-[#E29A6F] transition-colors min-h-[40px]"
                >
                  <span>{heroRecipe.authorName}</span>
                  {heroRecipe.authorVerified && (
                    <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenRecipe(heroRecipe)}
                  className="min-h-[50px] px-7 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.98] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]"
                >
                  <span>شروع مطالعه و آشپزی</span>
                  <ArrowUpLeft className="w-4 h-4" />
                </button>
                {heroRecipe.linkedMenuDishId && (
                  <button
                    type="button"
                    onClick={() => onJumpToOrder(heroRecipe.linkedMenuDishId)}
                    className="min-h-[50px] px-5 rounded-full border border-[#D8D8D4] dark:border-[#2E2E2B] bg-white dark:bg-[#151514] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] active:scale-[0.98] text-sm font-medium transition-all"
                  >
                    سفارش آماده امروز
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Calm Search & Structured Category Filter Bar */}
      <section aria-label="جست‌وجو و فیلتر دستورها" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5C5C58] dark:text-[#A3A39E] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
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

        {/* Interactive Category Segmented Bar + Community Photo Contribution Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_CATEGORIES.map((cat) => {
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* Minimalist Editorial Recipe Cards Grid */}
      <section aria-label="فهرست دستورهای پخت" className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA]">
            {filters.needsPhotoOnly
              ? `دستورهای در انتظار عکس واقعی شما (${toFaDigits(displayedRecipes.length)})`
              : filters.q || filters.categories.length > 0 || activeFilterCount > 0
                ? `نتایج جست‌وجو (${toFaDigits(displayedRecipes.length)})`
                : 'منتخب آرشیو دستورهای پخت'}
          </h2>
          {(filters.q || filters.categories.length > 0 || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[#B54B1F] dark:text-[#E29A6F] hover:underline min-h-[44px] px-2"
            >
              نمایش همه دستورها
            </button>
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
              const totalTime = recipe.prepMinutes + recipe.cookMinutes;
              return (
                <article
                  key={recipe.id}
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
                    {/* Clean Photography OR Kinfolk Typographic Cover for Photo-less Recipes */}
                    <div className="rounded-2xl overflow-hidden border border-[#E6E6E3]/80 dark:border-[#282825] shadow-[0_8px_28px_-22px_rgba(28,27,24,0.28)] transition-shadow duration-300 group-hover:shadow-[0_14px_34px_-20px_rgba(28,27,24,0.34)]">
                      <EditorialImage
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        category={recipe.category}
                        photoCreditName={recipe.photoCreditName}
                        aspectClass="aspect-[4/3]"
                      />
                    </div>

                    {/* Unboxed Clean Metadata Line */}
                    <div className="flex items-center justify-between text-xs text-[#5C5C58] dark:text-[#A3A39E]">
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
                      <div className="inline-flex items-center gap-1 tabular-nums shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{toFaDigits(totalTime)} دقیقه</span>
                      </div>
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
              );
            })}
          </div>
        )}
      </section>

      {/* Quiet Editorial Sponsor Campaign Slot (Controlled by Admin Sponsors Manager) */}
      {ecosystemConfig.exploreShowcaseEnabled && exploreCampaign && (
        <section
          aria-label="کمپین اسپانسر منتخب"
          className="rounded-3xl border border-[#E6E6E3] dark:border-[#282825] bg-gradient-to-l from-[#FFFFFF] via-[#F6F6F5] to-[#EFEFED] dark:from-[#1C1B18] dark:via-[#151514] dark:to-[#0B0B0B] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
              <span>پیشنهاد اسپانسر منتخب</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F]">{exploreCampaign.partnerName}</span>
            </div>
            <h3 className="text-xl font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{exploreCampaign.title}</h3>
            {exploreCampaign.subtitle && (
              <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{exploreCampaign.subtitle}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {exploreCampaign.promoCode && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(exploreCampaign.promoCode!).catch(() => {});
                  apiRequest(`/api/campaigns/${exploreCampaign.id}/event`, {
                    method: 'POST',
                    body: JSON.stringify({eventType: 'click'}),
                  }).catch(() => {});
                  onNotify(`کد تخفیف ${exploreCampaign.promoCode} کپی شد.`);
                }}
                className="min-h-[46px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-xs font-mono font-bold inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span dir="ltr">{exploreCampaign.promoCode}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                apiRequest(`/api/campaigns/${exploreCampaign.id}/event`, {
                  method: 'POST',
                  body: JSON.stringify({eventType: 'click'}),
                }).catch(() => {});
                const partner = showcasePartners.find((p) => p.id === exploreCampaign.partnerId);
                if (partner) onOpenPartner(partner);
              }}
              className="min-h-[46px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-xs font-medium"
            >
              {exploreCampaign.ctaLabel}
            </button>
          </div>
        </section>
      )}

      {/* Quiet Admin-Controlled Partner Showcase */}
      {ecosystemConfig.exploreShowcaseEnabled && showcasePartners.length > 0 && (
        <section
          aria-label="همکاران منتخب صنعت غذا"
          className="border-t border-[#E6E6E3] dark:border-[#282825] pt-10 space-y-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">اکوسیستم اصناف لاقلی</p>
              <h2 className="text-lg font-bold mt-0.5">
                {ecosystemConfig.activeCampaignTitle || 'همکاران منتخب آشپزخانه'}
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
                {partner.promoLabel && (
                  <p className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] pt-1">
                    {partner.promoLabel}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
