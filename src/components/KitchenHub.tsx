import {useState} from 'react';
import {ArrowLeftRight, Plus, Search, ShoppingBag, Sparkles, X} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {findNativeSubstitutions, toFaDigits} from '../shared/persianEngine.ts';
import type {IngredientItem, Recipe, SubstitutionSuggestion} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

interface KitchenHubProps {
  onOpenRecipe: (recipe: Recipe) => void;
  onAddShoppingItems: (
    items: {name: string; amount: number; unit: string; recipeId?: string; recipeTitle?: string}[]
  ) => void;
}

const COMMON_FRIDGE_ITEMS = [
  'تخم‌مرغ',
  'پیاز',
  'سیر',
  'گوجه',
  'بادمجان',
  'برنج ایرانی',
  'سینه مرغ',
  'ماست چکیده',
  'مغز گردو',
  'رب انار',
  'سبزی آش',
  'کشک',
  'شوید',
  'باقالی',
  'زعفران',
];

const QUICK_SUB_QUERIES = ['ماست چکیده', 'زعفران', 'رب انار', 'کشک', 'تخم‌مرغ', 'کره', 'مغز گردو', 'زرشک'];

interface FridgeMatchResult {
  recipe: Recipe;
  matchPercent: number;
  matchedIngredients: string[];
  missingIngredients: IngredientItem[];
}

export function KitchenHub({onOpenRecipe, onAddShoppingItems}: KitchenHubProps) {
  const [mode, setMode] = useState<'fridge' | 'substitute'>('fridge');

  // Fridge matcher state
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>(['پیاز', 'سیر', 'گوجه', 'تخم‌مرغ']);
  const [customIng, setCustomIng] = useState('');
  const [includePantryStaples, setIncludePantryStaples] = useState(true);
  const [exactOnly, setExactOnly] = useState(false);
  const [matches, setMatches] = useState<FridgeMatchResult[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Substitution state
  const [subQuery, setSubQuery] = useState('رب انار');
  const [subResults, setSubResults] = useState<SubstitutionSuggestion[]>(() =>
    findNativeSubstitutions('رب انار', 'native')
  );
  const [loadingSub, setLoadingSub] = useState(false);

  const toggleIngredient = (ing: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(ing) ? prev.filter((item) => item !== ing) : [...prev, ing]
    );
  };

  const addCustomIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customIng.trim();
    if (!cleaned) return;
    if (!selectedIngredients.includes(cleaned)) {
      setSelectedIngredients((prev) => [...prev, cleaned]);
    }
    setCustomIng('');
  };

  const runFridgeMatch = async () => {
    setLoadingMatches(true);
    try {
      const res = await apiRequest<{matches: FridgeMatchResult[]}>('/api/kitchen/fridge-match', {
        method: 'POST',
        body: JSON.stringify({
          ingredients: selectedIngredients,
          exactOnly,
          includePantryStaples,
        }),
      });
      setMatches(res.matches);
    } finally {
      setLoadingMatches(false);
    }
  };

  const runSubstituteSearch = async (queryText: string) => {
    const clean = queryText.trim();
    setSubQuery(clean);
    if (!clean) {
      setSubResults([]);
      return;
    }
    setLoadingSub(true);
    try {
      const res = await apiRequest<{suggestions: SubstitutionSuggestion[]}>(
        `/api/kitchen/substitutions?ingredient=${encodeURIComponent(clean)}`
      );
      setSubResults(res.suggestions);
    } catch {
      setSubResults(findNativeSubstitutions(clean, 'offline'));
    } finally {
      setLoadingSub(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Calm Header & 2-Tab Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E1D6] dark:border-[#2F2D27] pb-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold">آشپزخانه هوشمند</h1>
          <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
            بر اساس مواد موجود در خانه غذا پیدا کنید یا جایگزین دقیق هر ماده را بیابید.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('fridge')}
            className={`min-h-[44px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'fridge'
                ? 'bg-[#FFFFFF] dark:bg-[#1C1B18] text-[#1C1B18] dark:text-[#F4F1EA]'
                : 'text-[#615E55] dark:text-[#A9A497]'
            }`}
          >
            یخچال‌گردی هوشمند
          </button>
          <button
            type="button"
            onClick={() => setMode('substitute')}
            className={`min-h-[44px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              mode === 'substitute'
                ? 'bg-[#FFFFFF] dark:bg-[#1C1B18] text-[#1C1B18] dark:text-[#F4F1EA]'
                : 'text-[#615E55] dark:text-[#A9A497]'
            }`}
          >
            جایگزین مواد اولیه
          </button>
        </div>
      </div>

      {mode === 'fridge' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Ingredient Picker */}
          <div className="lg:col-span-5 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold">الان چه موادی در خانه دارید؟</h2>

            <form onSubmit={addCustomIngredient} className="flex gap-2">
              <input
                type="text"
                value={customIng}
                onChange={(e) => setCustomIng(e.target.value)}
                placeholder="نام ماده دیگر (مثلاً عدس، قارچ)..."
                className="flex-1 min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3.5 text-sm"
              />
              <button
                type="submit"
                aria-label="افزودن ماده"
                className="min-h-[46px] min-w-[46px] flex items-center justify-center rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] hover:bg-[#E5E1D6] dark:hover:bg-[#2F2D27]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Select Grid */}
            <div className="space-y-2">
              <p className="text-xs text-[#615E55] dark:text-[#A9A497]">مواد پرکاربرد آشپزخانه ایرانی:</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_FRIDGE_ITEMS.map((item) => {
                  const selected = selectedIngredients.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleIngredient(item)}
                      className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                        selected
                          ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedIngredients.length > 0 && (
              <div className="pt-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#615E55] dark:text-[#A9A497]">
                  <span>مواد انتخابی شما ({toFaDigits(selectedIngredients.length)})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIngredients([])}
                    className="hover:text-[#1C1B18] dark:hover:text-[#F4F1EA]"
                  >
                    پاک‌کردن همه
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIngredients.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleIngredient(item)}
                      className="inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-xs"
                    >
                      <span>{item}</span>
                      <X className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 text-sm">
              <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePantryStaples}
                  onChange={(e) => setIncludePantryStaples(e.target.checked)}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span className="text-xs text-[#615E55] dark:text-[#A9A497]">
                  مواد پایه همیشگی خانه (نمک، فلفل، زردچوبه، روغن) موجود فرض شوند
                </span>
              </label>

              <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={exactOnly}
                  onChange={(e) => setExactOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span className="text-xs text-[#615E55] dark:text-[#A9A497]">
                  فقط تطابق دقیق (قابل پخت بدون هیچ کمبودی)
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={runFridgeMatch}
              disabled={loadingMatches || selectedIngredients.length === 0}
              className="w-full min-h-[48px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loadingMatches ? 'در حال بررسی دستورها...' : 'پیشنهاد غذاهای قابل پخت'}</span>
            </button>
          </div>

          {/* Right Panel: Ranked Results */}
          <div className="lg:col-span-7 space-y-4">
            {matches === null ? (
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-10 text-center space-y-2">
                <p className="text-base font-semibold">مواد موجود را انتخاب و دکمه پیشنهاد را لمس کنید</p>
                <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
                  لاقلی دستورهای پخت را بر اساس درصد تطابق مرتب می‌کند و اقلام کم‌وکسر را شفاف نشان می‌دهد.
                </p>
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-10 text-center space-y-2">
                <p className="text-base font-semibold">غذایی با این ترکیب یافت نشد</p>
                <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
                  گزینه «تطابق دقیق» را خاموش کنید یا ماده دیگری به لیست اضافه نمایید.
                </p>
              </div>
            ) : (
              matches.map((item) => (
                <div
                  key={item.recipe.id}
                  className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 sm:p-5 flex flex-col sm:flex-row gap-5"
                >
                  <div
                    onClick={() => onOpenRecipe(item.recipe)}
                    className="sm:w-44 shrink-0 rounded-xl overflow-hidden cursor-pointer"
                  >
                    <EditorialImage src={item.recipe.imageUrl} alt={item.recipe.title} aspectClass="aspect-[4/3]" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
                          تطابق {toFaDigits(item.matchPercent)}٪
                        </span>
                        <span className="text-[#615E55] dark:text-[#A9A497] tabular-nums">
                          {toFaDigits(item.recipe.prepMinutes + item.recipe.cookMinutes)} دقیقه
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenRecipe(item.recipe)}
                        className="text-base font-bold text-right hover:text-[#B54B1F] dark:hover:text-[#E29A6F]"
                      >
                        {item.recipe.title}
                      </button>
                      {item.missingIngredients.length > 0 ? (
                        <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                          اقلام کم‌وکسر ({toFaDigits(item.missingIngredients.length)}):{' '}
                          {item.missingIngredients.map((m) => m.name).join('، ')}
                        </p>
                      ) : (
                        <p className="text-xs text-[#B54B1F] dark:text-[#E29A6F]">
                          تمام مواد این غذا در آشپزخانه شما موجود است.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenRecipe(item.recipe)}
                        className="min-h-[42px] px-4 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] text-xs font-medium"
                      >
                        مشاهده دستور
                      </button>
                      {item.missingIngredients.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onAddShoppingItems(
                              item.missingIngredients.map((m) => ({
                                name: m.name,
                                amount: m.amount,
                                unit: m.unit,
                                recipeId: item.recipe.id,
                                recipeTitle: item.recipe.title,
                              }))
                            )
                          }
                          className="min-h-[42px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>افزودن کمبودها به لیست خرید</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Ingredient Substitution Finder */
        <div className="max-w-3xl space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSubstituteSearch(subQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#615E55] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
                placeholder="نام ماده‌ای که در دسترس ندارید (مثلاً رب انار، کشک، زعفران)..."
                className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] pr-11 pl-4 text-sm"
              />
            </div>
            <button
              type="submit"
              className="min-h-[48px] px-6 rounded-xl bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412] text-sm font-medium"
            >
              جست‌وجو
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {QUICK_SUB_QUERIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => runSubstituteSearch(item)}
                className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                  subQuery === item
                    ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                    : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loadingSub ? (
            <p className="text-sm text-[#615E55]">در حال جست‌وجوی جایگزین...</p>
          ) : (
            <div className="space-y-4">
              {subResults.map((s) => (
                <div
                  key={s.substitute}
                  className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                      <h3 className="text-base font-bold">{s.substitute}</h3>
                    </div>
                    <div className="text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
                      سازگاری {toFaDigits(s.compatibility)}٪ · {s.category}
                      {s.isVegan ? ' · گیاهی/وگان' : ''}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#B54B1F] dark:text-[#E29A6F]">
                    نسبت جایگزینی: {s.ratio}
                  </p>
                  <p className="text-sm text-[#615E55] dark:text-[#A9A497] leading-relaxed">{s.flavorNote}</p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onAddShoppingItems([
                          {name: s.substitute, amount: 1, unit: 'بسته'},
                        ])
                      }
                      className="min-h-[42px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>افزودن به لیست خرید</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
