import {useEffect, useState} from 'react';
import {
  ArrowLeftRight,
  BadgeCheck,
  Bookmark,
  Check,
  ChefHat,
  Clock,
  Copy,
  GitFork,
  Lock,
  MessageSquare,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  ThumbsUp,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {
  PARTNER_ROLE_LABELS,
  findNativeSubstitutions,
  formatQuantity,
  toFaDigits,
} from '../shared/persianEngine.ts';
import type {
  IngredientItem,
  Partner,
  Recipe,
  RecipeQuestion,
  SubstitutionSuggestion,
  UserProfile,
} from '../shared/types.ts';
import {CookModeOverlay} from './CookModeOverlay.tsx';
import {EditorialImage} from './EditorialImage.tsx';

interface RecipeDetailModalProps {
  recipeId: string;
  user: UserProfile | null;
  city: string;
  isBookmarked: boolean;
  onClose: () => void;
  onToggleBookmark: (recipeId: string) => void;
  onAddShoppingItems: (
    items: {name: string; amount: number; unit: string; recipeId?: string; recipeTitle?: string}[]
  ) => void;
  onOpenChef: (chefId: string) => void;
  onOpenPartner: (partner: Partner) => void;
  onOpenVariationSubmit: (parentRecipe: Recipe) => void;
  onJumpToOrder: (dishId: string) => void;
  onRefreshUser: () => void;
  onRequireAuth: () => void;
  onNotify: (msg: string) => void;
}

export function RecipeDetailModal({
  recipeId,
  user,
  city,
  isBookmarked,
  onClose,
  onToggleBookmark,
  onAddShoppingItems,
  onOpenChef,
  onOpenPartner,
  onOpenVariationSubmit,
  onJumpToOrder,
  onRefreshUser,
  onRequireAuth,
  onNotify,
}: RecipeDetailModalProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [variations, setVariations] = useState<Recipe[]>([]);
  const [questions, setQuestions] = useState<RecipeQuestion[]>([]);
  const [contextualPartners, setContextualPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(4);
  const [haveSet, setHaveSet] = useState<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState(false);

  // Inline substitution finder state
  const [subIngredient, setSubIngredient] = useState<string | null>(null);
  const [subResults, setSubResults] = useState<SubstitutionSuggestion[]>([]);

  // Q&A form state
  const [questionBody, setQuestionBody] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const loadDetail = async (idToLoad: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        recipe: Recipe;
        variations: Recipe[];
        questions: RecipeQuestion[];
        contextualPartners: Partner[];
      }>(`/api/recipes/${idToLoad}?city=${encodeURIComponent(city)}`);
      setRecipe(data.recipe);
      setVariations(data.variations);
      setQuestions(data.questions);
      setContextualPartners(data.contextualPartners);
      setServings(data.recipe.servings);
      setHaveSet(new Set());
      // Record non-blocking partner impressions
      data.contextualPartners.forEach((p) => {
        apiRequest(`/api/partners/${p.id}/events`, {
          method: 'POST',
          body: JSON.stringify({eventType: 'impression'}),
        }).catch(() => {});
      });
    } catch {
      onNotify('خطا در بارگذاری جزئیات دستور پخت.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail(recipeId);
  }, [recipeId, city]);

  const handleFindSubstitute = async (ingName: string) => {
    setSubIngredient(ingName);
    try {
      const res = await apiRequest<{suggestions: SubstitutionSuggestion[]}>(
        `/api/kitchen/substitutions?ingredient=${encodeURIComponent(ingName)}`
      );
      setSubResults(res.suggestions);
    } catch {
      setSubResults(findNativeSubstitutions(ingName, 'offline'));
    }
  };

  const handleAddMissing = () => {
    if (!recipe) return;
    const scale = servings / Math.max(1, recipe.servings);
    const missing = recipe.ingredients.filter((ing) => !haveSet.has(ing.name));
    if (missing.length === 0) {
      onNotify('تمام مواد اولیه این دستور را در خانه دارید.');
      return;
    }
    onAddShoppingItems(
      missing.map((ing) => ({
        name: ing.name,
        amount: Math.round(ing.amount * scale * 100) / 100,
        unit: ing.unit,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      }))
    );
  };

  const handleUnlockVip = async () => {
    if (!recipe) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest(`/api/recipes/${recipe.id}/unlock-vip`, {method: 'POST'});
      onNotify('دستور ویژه با موفقیت بازگشایی شد.');
      onRefreshUser();
      loadDetail(recipe.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بازگشایی دستور ویژه');
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{question: RecipeQuestion}>(`/api/recipes/${recipe.id}/questions`, {
        method: 'POST',
        body: JSON.stringify({body: questionBody}),
      });
      setQuestions((prev) => [res.question, ...prev]);
      setQuestionBody('');
      onRefreshUser();
      onNotify('سوال شما ثبت شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت سوال');
    }
  };

  const handleSubmitAnswer = async (qId: string) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest(`/api/questions/${qId}/answers`, {
        method: 'POST',
        body: JSON.stringify({body: replyBody}),
      });
      setReplyBody('');
      setReplyTargetId(null);
      onRefreshUser();
      if (recipe) loadDetail(recipe.id);
      onNotify('پاسخ شما ثبت شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت پاسخ');
    }
  };

  const handleShareText = async () => {
    if (!recipe) return;
    const scale = servings / Math.max(1, recipe.servings);
    const ingText = recipe.ingredients
      .map((i) => `- ${i.name}: ${formatQuantity(i.amount * scale)} ${i.unit}`)
      .join('\n');
    const fullText = `${recipe.title} (برای ${toFaDigits(servings)} نفر)\n\nمواد اولیه:\n${ingText}\n\n${window.location.origin}/?recipe=${recipe.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({title: recipe.title, text: fullText});
      } else {
        await navigator.clipboard.writeText(fullText);
        onNotify('متن و لینک دستور پخت کپی شد.');
      }
    } catch {
      // Ignore cancel
    }
  };

  if (cookMode && recipe) {
    return <CookModeOverlay recipe={recipe} servings={servings} onClose={() => setCookMode(false)} />;
  }

  const scale = recipe ? servings / Math.max(1, recipe.servings) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="جزئیات دستور پخت"
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs overflow-y-auto"
    >
      <div className="min-h-screen flex items-start justify-center p-0 sm:p-6">
        <div className="w-full max-w-4xl bg-[#F9F8F4] dark:bg-[#141412] sm:rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] overflow-hidden my-0 sm:my-6">
          {/* Sticky Modal Top Bar */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 sm:px-8 h-16 bg-[#F9F8F4]/95 dark:bg-[#141412]/95 backdrop-blur-md border-b border-[#E5E1D6] dark:border-[#2F2D27]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
            >
              <X className="w-4 h-4" />
              <span>بستن</span>
            </button>

            {recipe && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleShareText}
                  aria-label="اشتراک‌گذاری"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(recipe.id)}
                  aria-label={isBookmarked ? 'حذف نشانک' : 'ذخیره در نشانک‌ها'}
                  aria-pressed={isBookmarked}
                  className={`min-h-[44px] px-3.5 rounded-lg text-sm inline-flex items-center gap-1.5 transition-colors ${
                    isBookmarked
                      ? 'bg-[#3F523B]/10 text-[#3F523B] dark:text-[#8EA888] font-medium'
                      : 'hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]'
                  }`}
                >
                  <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
                  <span className="hidden sm:inline">{isBookmarked ? 'نشانک‌شده' : 'ذخیره'}</span>
                </button>
              </div>
            )}
          </div>

          {loading || !recipe ? (
            <div className="p-12 text-center text-sm text-[#615E55]">در حال بارگذاری دستور پخت...</div>
          ) : (
            <div className="p-5 sm:p-8 space-y-10">
              {/* Hero Header */}
              <div className="space-y-5">
                <div className="rounded-2xl overflow-hidden border border-[#E5E1D6] dark:border-[#2F2D27]">
                  <EditorialImage src={recipe.imageUrl} alt={recipe.title} aspectClass="aspect-[16/9]" priority />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#615E55] dark:text-[#A9A497]">
                    <span>{recipe.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{recipe.region}</span>
                    <span aria-hidden="true">·</span>
                    <span>فصل {recipe.season}</span>
                    <span aria-hidden="true">·</span>
                    <span>سختی: {recipe.difficulty}</span>
                    {recipe.dietTags.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{recipe.dietTags.join(' / ')}</span>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold leading-snug">{recipe.title}</h1>
                  <p className="text-sm sm:text-base text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                    {recipe.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E5E1D6] dark:border-[#2F2D27]">
                    <button
                      type="button"
                      onClick={() => onOpenChef(recipe.authorId)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium min-h-[44px] hover:text-[#3F523B] dark:hover:text-[#8EA888]"
                    >
                      <span>{recipe.authorName}</span>
                      {recipe.authorVerified && (
                        <BadgeCheck className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888]" />
                      )}
                    </button>

                    <div className="flex items-center gap-4 text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> آماده‌سازی: {toFaDigits(recipe.prepMinutes)} دقیقه
                      </span>
                      <span>پخت: {toFaDigits(recipe.cookMinutes)} دقیقه</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Bar */}
                <div className="flex flex-wrap items-center gap-3">
                  {recipe.isVip && !recipe.isUnlocked ? (
                    <button
                      type="button"
                      onClick={handleUnlockVip}
                      className="min-h-[48px] px-6 rounded-xl bg-[#A97222] hover:opacity-90 text-white text-sm font-medium inline-flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>بازگشایی دستور ویژه با {toFaDigits(recipe.vipGemCost)} جِم</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCookMode(true)}
                      className="min-h-[48px] px-6 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium inline-flex items-center gap-2"
                    >
                      <ChefHat className="w-4 h-4" />
                      <span>شروع حالت آشپزی (گام‌به‌گام)</span>
                    </button>
                  )}

                  {recipe.linkedMenuDishId && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onJumpToOrder(recipe.linkedMenuDishId!);
                      }}
                      className="min-h-[48px] px-5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F] text-sm font-medium"
                    >
                      حوصله پخت نداری؟ آماده سفارش بده
                    </button>
                  )}
                </div>
              </div>

              {/* Nutrition Breakdown (Clean Tabular Strip) */}
              <div className="grid grid-cols-5 gap-2 sm:gap-4 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 text-center tabular-nums">
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">کالری</div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">{toFaDigits(recipe.nutrition.calories)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">پروتئین</div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">{toFaDigits(recipe.nutrition.protein)} گ</div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">کربوهیدرات</div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">{toFaDigits(recipe.nutrition.carbs)} گ</div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">چربی</div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">{toFaDigits(recipe.nutrition.fat)} گ</div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">فیبر</div>
                  <div className="text-base sm:text-lg font-bold mt-0.5">{toFaDigits(recipe.nutrition.fiber)} گ</div>
                </div>
              </div>

              {/* VIP Lock Curtain or Full Content */}
              {recipe.isVip && !recipe.isUnlocked ? (
                <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-8 text-center space-y-3">
                  <Lock className="w-7 h-7 mx-auto text-[#A97222]" />
                  <h3 className="text-lg font-bold">دستور تخصصی و ویژه سرآشپز</h3>
                  <p className="text-sm text-[#615E55] dark:text-[#A9A497] max-w-md mx-auto">
                    مقادیر دقیق، نکات طلایی پخت و مراحل کامل این دستور با خرج {toFaDigits(recipe.vipGemCost)} جِم از کیف جِم شما برای همیشه بازگشایی می‌شود.
                  </p>
                  <button
                    type="button"
                    onClick={handleUnlockVip}
                    className="min-h-[48px] px-6 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-sm font-medium mt-2"
                  >
                    بازگشایی با {toFaDigits(recipe.vipGemCost)} جِم
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Ingredients + Servings Scaler + 1-Click Shopping */}
                  <div className="lg:col-span-5 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold">مواد اولیه</h2>
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] px-2 py-1">
                        <button
                          type="button"
                          aria-label="کاهش تعداد نفرات"
                          onClick={() => setServings((s) => Math.max(1, s - 1))}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-medium tabular-nums min-w-[4.5rem] text-center">
                          {toFaDigits(servings)} نفر
                        </span>
                        <button
                          type="button"
                          aria-label="افزایش تعداد نفرات"
                          onClick={() => setServings((s) => Math.min(20, s + 1))}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                      موادی که در خانه دارید را تیک بزنید تا فقط کمبودها با یک کلیک به لیست خرید اضافه شوند.
                    </p>

                    <ul className="divide-y divide-[#E5E1D6]/70 dark:divide-[#2F2D27] rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18]">
                      {recipe.ingredients.map((ing: IngredientItem) => {
                        const checked = haveSet.has(ing.name);
                        return (
                          <li key={ing.name} className="flex items-center justify-between gap-2 px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                setHaveSet((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(ing.name)) next.delete(ing.name);
                                  else next.add(ing.name);
                                  return next;
                                })
                              }
                              className="flex-1 flex items-center gap-3 text-right min-h-[40px]"
                            >
                              <span
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  checked
                                    ? 'bg-[#3F523B] border-[#3F523B] text-white dark:bg-[#8EA888] dark:border-[#8EA888] dark:text-[#141412]'
                                    : 'border-[#615E55]/40'
                                }`}
                              >
                                {checked && <Check className="w-3.5 h-3.5" />}
                              </span>
                              <span className={`text-sm ${checked ? 'line-through opacity-50' : ''}`}>
                                {ing.name}
                              </span>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
                                {formatQuantity(ing.amount * scale)} {ing.unit}
                              </span>
                              <button
                                type="button"
                                aria-label={`یافتن جایگزین برای ${ing.name}`}
                                title="یافتن جایگزین"
                                onClick={() => handleFindSubstitute(ing.name)}
                                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#615E55] hover:text-[#3F523B] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      type="button"
                      onClick={handleAddMissing}
                      className="w-full min-h-[48px] rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        افزودن یک‌کلیکی کمبودها ({toFaDigits(recipe.ingredients.length - haveSet.size)} قلم)
                      </span>
                    </button>

                    {/* Inline Substitution Results Box */}
                    {subIngredient && (
                      <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold">جایگزین‌های پیشنهادی برای «{subIngredient}»</h3>
                          <button
                            type="button"
                            onClick={() => setSubIngredient(null)}
                            className="text-xs text-[#615E55] min-h-[36px] px-2"
                          >
                            بستن
                          </button>
                        </div>
                        <div className="space-y-3">
                          {subResults.map((s) => (
                            <div
                              key={s.substitute}
                              className="pt-3 first:pt-0 border-t first:border-t-0 border-[#E5E1D6]/70 dark:border-[#2F2D27] space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{s.substitute}</span>
                                <span className="text-xs text-[#3F523B] dark:text-[#8EA888] tabular-nums">
                                  سازگاری {toFaDigits(s.compatibility)}٪{s.isVegan ? ' · گیاهی' : ''}
                                </span>
                              </div>
                              <p className="text-xs text-[#615E55] dark:text-[#A9A497]">نسبت: {s.ratio}</p>
                              <p className="text-xs text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                                {s.flavorNote}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  onAddShoppingItems([
                                    {
                                      name: s.substitute,
                                      amount: 1,
                                      unit: 'بسته',
                                      recipeId: recipe.id,
                                      recipeTitle: recipe.title,
                                    },
                                  ])
                                }
                                className="text-xs font-medium text-[#3F523B] dark:text-[#8EA888] hover:underline min-h-[36px]"
                              >
                                + افزودن به لیست خرید
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Steps + Quiet Contextual Partner + Variations + Q&A */}
                  <div className="lg:col-span-7 space-y-10">
                    <div className="space-y-5">
                      <h2 className="text-lg font-bold">مراحل پخت</h2>
                      <ol className="space-y-6">
                        {recipe.steps.map((step) => (
                          <li key={step.order} className="flex gap-4">
                            <span className="w-8 h-8 rounded-full bg-[#F1EFE8] dark:bg-[#24231F] text-[#3F523B] dark:text-[#8EA888] text-sm font-bold flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                              {toFaDigits(step.order)}
                            </span>
                            <div className="space-y-1.5">
                              <p className="text-sm sm:text-base leading-relaxed">{step.instruction}</p>
                              {step.timerMinutes && (
                                <p className="text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
                                  زمان تقریبی این مرحله: {toFaDigits(step.timerMinutes)} دقیقه
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Quiet Contextual Partner Suggestion (Strictly capped by Admin Panel) */}
                    {contextualPartners.length > 0 && (
                      <div className="space-y-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6">
                        <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                          تامین مواد و تجهیزات مرتبط با این دستور
                        </p>
                        {contextualPartners.map((partner) => (
                          <div
                            key={partner.id}
                            className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="text-xs text-[#615E55] dark:text-[#A9A497]">
                                {PARTNER_ROLE_LABELS[partner.roleType]} · {partner.city}
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenPartner(partner)}
                                className="text-base font-bold hover:text-[#3F523B] dark:hover:text-[#8EA888] text-right"
                              >
                                {partner.name}
                              </button>
                              {partner.promoLabel && (
                                <p className="text-xs text-[#3F523B] dark:text-[#8EA888]">{partner.promoLabel}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {partner.promoCode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(partner.promoCode!).catch(() => {});
                                    apiRequest(`/api/partners/${partner.id}/events`, {
                                      method: 'POST',
                                      body: JSON.stringify({eventType: 'coupon_copy'}),
                                    }).catch(() => {});
                                    onNotify(`کد تخفیف ${partner.promoCode} کپی شد.`);
                                  }}
                                  className="min-h-[44px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span dir="ltr">{partner.promoCode}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenPartner(partner)}
                                className="min-h-[44px] px-4 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] text-xs font-medium"
                              >
                                مشاهده صفحه
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Variations / Forking */}
                    <div className="border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h2 className="text-base font-bold inline-flex items-center gap-2">
                          <GitFork className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888]" />
                          <span>روش‌های پخت جایگزین ({toFaDigits(variations.length)})</span>
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            if (!user) {
                              onRequireAuth();
                              return;
                            }
                            onOpenVariationSubmit(recipe);
                          }}
                          className="text-xs font-medium text-[#3F523B] dark:text-[#8EA888] hover:underline min-h-[44px] px-2"
                        >
                          + ثبت روش جایگزین
                        </button>
                      </div>

                      {variations.length > 0 ? (
                        <div className="space-y-3">
                          {variations.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => loadDetail(v.id)}
                              className="w-full text-right rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 hover:border-[#3F523B]/50 transition-colors"
                            >
                              <div className="text-sm font-bold">{v.title}</div>
                              {v.variationNote && (
                                <p className="text-xs text-[#615E55] dark:text-[#A9A497] mt-1">{v.variationNote}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                          هنوز نسخه جایگزینی (مثلاً رژیمی یا بومی شهر دیگر) برای این دستور ثبت نشده است.
                        </p>
                      )}
                    </div>

                    {/* Q&A Section */}
                    <div className="border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6 space-y-5">
                      <h2 className="text-base font-bold inline-flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888]" />
                        <span>پرسش و پاسخ آشپزی ({toFaDigits(questions.length)})</span>
                      </h2>

                      <form onSubmit={handleAskQuestion} className="flex gap-2">
                        <input
                          type="text"
                          value={questionBody}
                          onChange={(e) => setQuestionBody(e.target.value)}
                          placeholder="سوالی درباره این دستور دارید؟ بپرسید..."
                          className="flex-1 min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] px-4 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={questionBody.trim().length < 6}
                          className="min-h-[48px] px-5 rounded-xl bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412] text-sm font-medium disabled:opacity-40"
                        >
                          ارسال
                        </button>
                      </form>

                      <div className="space-y-4">
                        {questions.map((q) => (
                          <div
                            key={q.id}
                            className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs text-[#615E55] dark:text-[#A9A497]">
                              <span>{q.authorName}</span>
                              {q.solved && (
                                <span className="text-[#3F523B] dark:text-[#8EA888] font-medium">حل‌شده</span>
                              )}
                            </div>
                            <p className="text-sm font-medium">{q.body}</p>

                            {q.answers.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-[#E5E1D6]/70 dark:border-[#2F2D27]">
                                {q.answers.map((a) => (
                                  <div key={a.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-[#615E55] dark:text-[#A9A497]">
                                      <span className="inline-flex items-center gap-1 font-medium text-[#1C1B18] dark:text-[#F4F1EA]">
                                        {a.authorName}
                                        {a.authorVerified && (
                                          <BadgeCheck className="w-3.5 h-3.5 text-[#3F523B] dark:text-[#8EA888]" />
                                        )}
                                        {a.isBest && (
                                          <span className="text-[#3F523B] dark:text-[#8EA888] mr-1">· بهترین پاسخ</span>
                                        )}
                                      </span>

                                      <div className="flex items-center gap-2">
                                        {user && user.id === q.authorId && !a.isBest && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              await apiRequest(`/api/answers/${a.id}/best`, {method: 'POST'});
                                              if (recipe) loadDetail(recipe.id);
                                              onNotify('بهترین پاسخ انتخاب شد.');
                                            }}
                                            className="text-xs text-[#3F523B] dark:text-[#8EA888] hover:underline"
                                          >
                                            انتخاب بهترین پاسخ
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            await apiRequest(`/api/answers/${a.id}/upvote`, {method: 'POST'});
                                            if (recipe) loadDetail(recipe.id);
                                          }}
                                          className="inline-flex items-center gap-1 text-xs hover:text-[#3F523B] tabular-nums min-h-[32px] px-1.5"
                                        >
                                          <ThumbsUp className="w-3.5 h-3.5" />
                                          <span>{toFaDigits(a.upvotes)}</span>
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-sm text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                                      {a.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {replyTargetId === q.id ? (
                              <div className="flex gap-2 pt-1">
                                <input
                                  type="text"
                                  value={replyBody}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  placeholder="پاسخ خود را بنویسید..."
                                  className="flex-1 min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitAnswer(q.id)}
                                  className="min-h-[42px] px-4 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-xs font-medium"
                                >
                                  ثبت پاسخ
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReplyTargetId(q.id)}
                                className="text-xs text-[#615E55] hover:text-[#3F523B] dark:text-[#A9A497] min-h-[36px]"
                              >
                                ثبت پاسخ به این سوال
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
