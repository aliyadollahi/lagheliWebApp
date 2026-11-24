import {useState} from 'react';
import {
  BadgeCheck,
  Bookmark,
  Clock,
  Lock,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {PARTNER_ROLE_LABELS, toFaDigits} from '../shared/persianEngine.ts';
import type {EcosystemConfig, Partner, Recipe} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

export interface RecipeFilterState {
  q: string;
  categories: string[];
  seasons: string[];
  regions: string[];
  diets: string[];
  verifiedOnly: boolean;
  followedOnly: boolean;
  bookmarkedOnly: boolean;
}

interface RecipeFeedProps {
  recipes: Recipe[];
  loading: boolean;
  filters: RecipeFilterState;
  onChangeFilters: (next: RecipeFilterState) => void;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenChef: (chefId: string) => void;
  onQuickAddShopping: (recipe: Recipe) => void;
  onJumpToOrder: (dishId?: string | null) => void;
  ecosystemConfig: EcosystemConfig;
  showcasePartners: Partner[];
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
  loading,
  filters,
  onChangeFilters,
  bookmarkedIds,
  onToggleBookmark,
  onOpenRecipe,
  onOpenChef,
  onQuickAddShopping,
  onJumpToOrder,
  ecosystemConfig,
  showcasePartners,
  onOpenPartner,
  onNotify,
}: RecipeFeedProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    (filters.bookmarkedOnly ? 1 : 0);

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
    });
  };

  const handleShare = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?recipe=${recipe.slug}`;
    const text = `${recipe.title} — ${recipe.subtitle}`;
    try {
      if (navigator.share) {
        await navigator.share({title: recipe.title, text, url});
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        onNotify('لینک دستور پخت کپی شد.');
      }
    } catch {
      // User canceled share
    }
  };

  const heroRecipe = recipes[0];
  const gridRecipes = recipes.length > 1 && !filters.q && filters.categories.length === 0 && activeFilterCount === 0
    ? recipes.slice(1)
    : recipes;

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Editorial Hero Split (shown on clean feed) */}
      {heroRecipe && !filters.q && filters.categories.length === 0 && activeFilterCount === 0 && (
        <section
          aria-label="پیشنهاد سردبیر امروز"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch border-b border-[#E5E1D6] dark:border-[#2F2D27] pb-10 sm:pb-12"
        >
          <div
            onClick={() => onOpenRecipe(heroRecipe)}
            className="lg:col-span-7 group cursor-pointer rounded-2xl overflow-hidden"
          >
            <EditorialImage
              src={heroRecipe.imageUrl}
              alt={heroRecipe.title}
              aspectClass="aspect-[16/10] lg:h-full"
              priority
            />
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-6 py-1">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#615E55] dark:text-[#A9A497]">
                <span>منتخب امروز لاقلی</span>
                <span aria-hidden="true">·</span>
                <span>{heroRecipe.region}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {toFaDigits(heroRecipe.prepMinutes + heroRecipe.cookMinutes)} دقیقه
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-bold leading-[1.35] text-[#1C1B18] dark:text-[#F4F1EA]">
                {heroRecipe.title}
              </h1>

              <p className="text-sm sm:text-base text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                {heroRecipe.description}
              </p>

              <button
                type="button"
                onClick={() => onOpenChef(heroRecipe.authorId)}
                className="inline-flex items-center gap-1.5 text-sm text-[#1C1B18] dark:text-[#F4F1EA] hover:text-[#3F523B] dark:hover:text-[#8EA888] transition-colors min-h-[44px]"
              >
                <span>{heroRecipe.authorName}</span>
                {heroRecipe.authorVerified && (
                  <BadgeCheck className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888]" />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenRecipe(heroRecipe)}
                className="min-h-[48px] px-6 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:hover:bg-[#A2BC9C] text-[#F9F8F4] dark:text-[#141412] text-sm font-medium transition-colors"
              >
                مشاهده دستور و آشپزی
              </button>
              {heroRecipe.linkedMenuDishId && (
                <button
                  type="button"
                  onClick={() => onJumpToOrder(heroRecipe.linkedMenuDishId)}
                  className="min-h-[48px] px-5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F] text-sm font-medium transition-colors"
                >
                  سفارش آماده امروز
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Calm Search & Structured Category Filter Bar */}
      <section aria-label="جست‌وجو و فیلتر دستورها" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#615E55] dark:text-[#A9A497] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => onChangeFilters({...filters, q: e.target.value})}
              placeholder="جست‌وجو در نام غذا، مواد اولیه، منطقه یا سرآشپز..."
              aria-label="جست‌وجوی دستور پخت"
              className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] pr-11 pl-4 text-sm placeholder:text-[#615E55]/70"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`min-h-[48px] px-4 rounded-xl border text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              showAdvanced || activeFilterCount > 0
                ? 'border-[#3F523B] bg-[#3F523B]/8 text-[#3F523B] dark:border-[#8EA888] dark:text-[#8EA888]'
                : 'border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>فیلتر دقیق</span>
            {activeFilterCount > 0 && (
              <span className="tabular-nums text-xs">({toFaDigits(activeFilterCount)})</span>
            )}
          </button>
        </div>

        {/* Interactive Category Segmented Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_CATEGORIES.map((cat) => {
            const isAll = cat === 'همه';
            const active = isAll ? filters.categories.length === 0 : filters.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  isAll
                    ? onChangeFilters({...filters, categories: []})
                    : toggleMulti('categories', cat)
                }
                className={`min-h-[44px] px-4 rounded-xl text-sm whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#3F523B] dark:bg-[#8EA888] text-[#F9F8F4] dark:text-[#141412] font-medium'
                    : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Expandable Faceted OR/AND Filter Drawer */}
        {showAdvanced && (
          <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">فیلتر چندوجهی (ترکیب دقیق)</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-[#615E55] hover:text-[#1C1B18] dark:text-[#A9A497] inline-flex items-center gap-1 min-h-[40px] px-2"
              >
                <X className="w-3.5 h-3.5" />
                <span>پاک‌کردن همه فیلترها</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <p className="text-xs text-[#615E55] dark:text-[#A9A497] mb-2">فصل مناسب</p>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleMulti('seasons', s)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.seasons.includes(s)
                          ? 'bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#615E55] dark:text-[#A9A497] mb-2">منطقه و اصالت</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleMulti('regions', r)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.regions.includes(r)
                          ? 'bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-[#615E55] dark:text-[#A9A497] mb-2">سبک تغذیه و رژیم</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleMulti('diets', d)}
                      className={`min-h-[40px] px-3 rounded-lg text-xs transition-colors ${
                        filters.diets.includes(d)
                          ? 'bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] text-sm">
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) => onChangeFilters({...filters, verifiedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#3F523B]"
                />
                <span>فقط سرآشپزهای تاییدشده</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.bookmarkedOnly}
                  onChange={(e) => onChangeFilters({...filters, bookmarkedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#3F523B]"
                />
                <span>فقط نشانک‌شده‌ها</span>
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.followedOnly}
                  onChange={(e) => onChangeFilters({...filters, followedOnly: e.target.checked})}
                  className="w-4 h-4 accent-[#3F523B]"
                />
                <span>فقط آشپزهای دنبال‌شده</span>
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Minimalist Editorial Recipe Cards Grid */}
      <section aria-label="فهرست دستورهای پخت" className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-[#1C1B18] dark:text-[#F4F1EA]">
            {filters.q || filters.categories.length > 0 || activeFilterCount > 0
              ? `نتایج جست‌وجو (${toFaDigits(recipes.length)})`
              : 'دستورهای پخت منتخب'}
          </h2>
          {(filters.q || filters.categories.length > 0 || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[#3F523B] dark:text-[#8EA888] hover:underline min-h-[44px] px-2"
            >
              نمایش همه دستورها
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-[#F1EFE8] dark:bg-[#24231F]" />
                <div className="h-4 w-1/3 bg-[#F1EFE8] dark:bg-[#24231F] rounded" />
                <div className="h-5 w-4/5 bg-[#F1EFE8] dark:bg-[#24231F] rounded" />
              </div>
            ))}
          </div>
        ) : gridRecipes.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-12 text-center space-y-3">
            <p className="text-base font-medium">دستور پختی با این فیلترها پیدا نشد.</p>
            <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
              فیلترها را ساده‌تر کنید یا عبارت دیگری جست‌وجو نمایید.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[44px] px-5 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-sm font-medium mt-2"
            >
              پاک‌کردن فیلترها
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {gridRecipes.map((recipe) => {
              const isBookmarked = bookmarkedIds.has(recipe.id) || Boolean(recipe.isBookmarked);
              const totalTime = recipe.prepMinutes + recipe.cookMinutes;
              return (
                <article
                  key={recipe.id}
                  onClick={() => onOpenRecipe(recipe)}
                  className="group cursor-pointer flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    {/* Clean Photography — Zero Text Overlay */}
                    <div className="rounded-2xl overflow-hidden border border-[#E5E1D6]/70 dark:border-[#2F2D27]">
                      <EditorialImage src={recipe.imageUrl} alt={recipe.title} aspectClass="aspect-[4/3]" />
                    </div>

                    {/* Unboxed Clean Metadata Line */}
                    <div className="flex items-center justify-between text-xs text-[#615E55] dark:text-[#A9A497]">
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
                      <h3 className="text-lg font-bold leading-snug text-[#1C1B18] dark:text-[#F4F1EA] group-hover:text-[#3F523B] dark:group-hover:text-[#8EA888] transition-colors">
                        {recipe.title}
                      </h3>
                      <p className="text-sm text-[#615E55] dark:text-[#A9A497] line-clamp-2 leading-relaxed">
                        {recipe.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Calm Footer: Chef & Actions (Bookmark Only — Quiet Luxury) */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D6]/70 dark:border-[#2F2D27]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenChef(recipe.authorId);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-[#615E55] dark:text-[#A9A497] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA] min-h-[44px] truncate"
                    >
                      <span className="truncate">{recipe.authorName}</span>
                      {recipe.authorVerified && (
                        <BadgeCheck className="w-3.5 h-3.5 text-[#3F523B] dark:text-[#8EA888] shrink-0" />
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
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#615E55] hover:text-[#3F523B] dark:text-[#A9A497] dark:hover:text-[#8EA888] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F] transition-colors"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="اشتراک‌گذاری دستور پخت"
                        onClick={(e) => handleShare(recipe, e)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#615E55] hover:text-[#3F523B] dark:text-[#A9A497] dark:hover:text-[#8EA888] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F] transition-colors"
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
                            ? 'text-[#3F523B] dark:text-[#8EA888]'
                            : 'text-[#615E55] dark:text-[#A9A497] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]'
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

      {/* Quiet Admin-Controlled Partner Showcase */}
      {ecosystemConfig.exploreShowcaseEnabled && showcasePartners.length > 0 && (
        <section
          aria-label="همکاران منتخب صنعت غذا"
          className="border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-10 space-y-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs text-[#615E55] dark:text-[#A9A497]">اکوسیستم اصناف لاقلی</p>
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
                className="text-right rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 hover:border-[#3F523B]/50 dark:hover:border-[#8EA888]/50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#615E55] dark:text-[#A9A497]">
                  <span>{PARTNER_ROLE_LABELS[partner.roleType]}</span>
                  <span>{partner.city}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-bold text-[#1C1B18] dark:text-[#F4F1EA]">{partner.name}</h3>
                  {partner.verified && (
                    <BadgeCheck className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#615E55] dark:text-[#A9A497] line-clamp-2 leading-relaxed">
                  {partner.description}
                </p>
                {partner.promoLabel && (
                  <p className="text-xs font-medium text-[#3F523B] dark:text-[#8EA888] pt-1">
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
