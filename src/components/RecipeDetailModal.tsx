import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {motion, useReducedMotion} from 'motion/react';
import {
  ArrowLeftRight,
  BadgeCheck,
  Bookmark,
  Camera,
  Check,
  ChefHat,
  Clock,
  GitFork,
  Lock,
  MessageSquare,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  ThumbsUp,
  Upload,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {behaviorTracker, useRecipeBehaviorObserver} from '../lib/behaviorTracker.ts';
import {fileToCompressedDataUrl} from '../lib/imageUpload.ts';
import {
  fetchRecipeDetail,
  getCachedRecipeDetail,
  invalidateRecipeDetail,
  prefetchRecipeDetail,
  type RecipeDetailPayload,
} from '../lib/recipePrefetch.ts';
import {shareRecipeWithWebShare} from '../lib/webShare.ts';
import {
  PARTNER_ROLE_LABELS,
  findNativeSubstitutions,
  formatQuantity,
  toFaDigits,
} from '../shared/persianEngine.ts';
import {
  DEFAULT_AD_HARMONY,
  matchContextualToolOrSubAd,
  matchInlineIngredientAds,
} from '../shared/nativeAdEngine.ts';
import type {
  EcosystemConfig,
  IngredientItem,
  LocalVenueSuggestion,
  NativeAdUnit,
  Partner,
  Recipe,
  RecipePhoto,
  RecipeQuestion,
  SubstitutionSuggestion,
  UserProfile,
} from '../shared/types.ts';
import {CookModeOverlay} from './CookModeOverlay.tsx';
import {EditorialImage} from './EditorialImage.tsx';
import {RecipeDetailSkeleton} from './EditorialSkeletons.tsx';
import {NativeAdSlot} from './NativeAdSlot.tsx';
import {NearbyVenueCard} from './NearbyVenueCard.tsx';

interface RecipeDetailModalProps {
  recipeId: string;
  adjacentRecipeIds?: string[];
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
  ecosystemConfig?: EcosystemConfig;
  nativeAds?: NativeAdUnit[];
  localVenues?: LocalVenueSuggestion[];
  partners?: Partner[];
  onRefreshUser: () => void;
  onRequireAuth: () => void;
  onNotify: (msg: string) => void;
}

export function RecipeDetailModal({
  recipeId,
  adjacentRecipeIds = [],
  user,
  city,
  isBookmarked,
  onClose,
  onToggleBookmark,
  onAddShoppingItems,
  onOpenChef,
  onOpenPartner,
  onOpenVariationSubmit,
  ecosystemConfig,
  nativeAds = [],
  localVenues = [],
  partners = [],
  onRefreshUser,
  onRequireAuth,
  onNotify,
}: RecipeDetailModalProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [variations, setVariations] = useState<Recipe[]>([]);
  const [questions, setQuestions] = useState<RecipeQuestion[]>([]);
  const [contextualPartners, setContextualPartners] = useState<Partner[]>([]);
  const [communityPhotos, setCommunityPhotos] = useState<RecipePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState(4);
  const [haveSet, setHaveSet] = useState<Set<string>>(new Set());
  const [cookMode, setCookMode] = useState(false);
  const [activeStepOrder, setActiveStepOrder] = useState<number | null>(null);

  // Community real dish photo uploader state
  const [photoFormOpen, setPhotoFormOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Inline substitution finder state
  const [subIngredient, setSubIngredient] = useState<string | null>(null);
  const [subResults, setSubResults] = useState<SubstitutionSuggestion[]>([]);

  // Q&A form state
  const [questionBody, setQuestionBody] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const ingredientsSectionRef = useRef<HTMLDivElement | null>(null);
  const stepsSectionRef = useRef<HTMLDivElement | null>(null);
  const prefetchedNextRef = useRef<boolean>(false);
  const [readProgress, setReadProgress] = useState(0);
  const [showMobileBar, setShowMobileBar] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Observer-pattern behavioral tracking (dwell time, scroll depth, inter-click intervals — strictly anonymized)
  useRecipeBehaviorObserver({
    recipeId,
    recipeTitle: recipe?.title,
    category: recipe?.category,
    containerRef: scrollContainerRef,
    enabled: Boolean(recipe && !loading),
  });

  useEffect(() => {
    if (cookMode && recipe) {
      behaviorTracker.trackEvent('recipe_cook_start', {
        sectionName: 'cooking_mode',
        targetType: 'recipe',
        targetId: recipe.id,
        targetLabel: recipe.title,
        category: recipe.category,
        numericValue: Math.max(60, (recipe.cookMinutes || 30) * 60),
      });
    }
  }, [cookMode, recipe]);

  const applyDetailPayload = useCallback(
    (data: RecipeDetailPayload, resetInteractiveState: boolean) => {
      setRecipe(data.recipe);
      setVariations(data.variations);
      setQuestions(data.questions);
      setContextualPartners(data.contextualPartners);
      setCommunityPhotos(data.communityPhotos || []);
      if (resetInteractiveState) {
        setServings(data.recipe.servings);
        setHaveSet(new Set());
        setActiveStepOrder(null);
      }
      // Record non-blocking partner impressions
      data.contextualPartners.forEach((p) => {
        apiRequest(`/api/partners/${p.id}/events`, {
          method: 'POST',
          body: JSON.stringify({eventType: 'impression'}),
        }).catch(() => {});
      });
    },
    []
  );

  const loadDetail = useCallback(
    async (idToLoad: string, options?: {force?: boolean}) => {
      const cached = options?.force ? null : getCachedRecipeDetail(idToLoad, city);

      if (cached) {
        // 0ms instant render from Prefetch LRU Cache
        applyDetailPayload(cached.data, true);
        setLoading(false);
        if (cached.isFresh) return;
      } else {
        setLoading(true);
      }

      try {
        const fresh = await fetchRecipeDetail(idToLoad, city, {force: options?.force});
        applyDetailPayload(fresh, !cached);
      } catch {
        if (!cached) {
          onNotify('خطا در بارگذاری جزئیات دستور پخت.');
        }
      } finally {
        setLoading(false);
      }
    },
    [city, applyDetailPayload, onNotify]
  );

  // Lock underlying page scroll while RecipeDetailModal is open to prevent double scrollbars
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    prefetchedNextRef.current = false;
    setReadProgress(0);
    setShowMobileBar(false);
    loadDetail(recipeId);
  }, [recipeId, city, loadDetail]);

  // Close modal with Escape key when Cook Mode is not open
  useEffect(() => {
    if (cookMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cookMode, onClose]);

  const scrollToSection = useCallback(
    (ref: {current: HTMLDivElement | null}) => {
      if (!ref.current) return;
      ref.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [prefersReducedMotion]
  );

  // Prefetch variations of the current recipe once loaded (instant variation switching)
  useEffect(() => {
    if (!recipe || variations.length === 0) return;
    variations.slice(0, 2).forEach((v) => {
      prefetchRecipeDetail(v.id, city, {priority: 'low', imageUrl: v.imageUrl});
    });
  }, [recipe, variations, city]);

  // Track reading progress, conditional mobile thumb-zone bar, and prefetch upcoming adjacent recipes
  const handleModalScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const ratio = Math.min(1, Math.max(0, el.scrollTop / maxScroll));
    setReadProgress(Math.round(ratio * 100));
    setShowMobileBar(el.scrollTop > 320);

    if (prefetchedNextRef.current || adjacentRecipeIds.length === 0) return;
    const progress = (el.scrollTop + el.clientHeight) / Math.max(1, el.scrollHeight);
    if (progress >= 0.35) {
      prefetchedNextRef.current = true;
      adjacentRecipeIds.slice(0, 2).forEach((nextId) => {
        prefetchRecipeDetail(nextId, city, {priority: 'low'});
      });
    }
  }, [adjacentRecipeIds, city]);

  // Dynamic Meta Tags, Canonical URL & Schema.org @graph (Recipe + BreadcrumbList + FAQPage) for Rich Results
  useEffect(() => {
    if (!recipe) return;

    const origin = window.location.origin;
    const canonicalUrl = `${origin}/?recipe=${encodeURIComponent(recipe.slug || recipe.id)}`;
    const pageTitle = `طرز تهیه ${recipe.title} | لاقلی`;
    const totalMinutes = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
    const metaDescription = `${recipe.description.slice(0, 110)} — زمان پخت ${toFaDigits(totalMinutes || 30)} دقیقه، مناسب ${toFaDigits(recipe.servings)} نفر در لاقلی.`;
    const primaryImage = recipe.imageUrl
      ? recipe.imageUrl.startsWith('http')
        ? recipe.imageUrl
        : `${origin}${recipe.imageUrl}`
      : `${origin}/icon.svg`;

    const allImages: string[] = [];
    if (recipe.imageUrl) allImages.push(primaryImage);
    communityPhotos.forEach((p) => {
      if (!p.imageUrl) return;
      const abs = p.imageUrl.startsWith('http') ? p.imageUrl : `${origin}${p.imageUrl}`;
      if (!allImages.includes(abs)) allImages.push(abs);
    });

    const prevTitle = document.title;
    const setMeta = (selector: string, content: string): (() => void) => {
      const el = document.querySelector(selector);
      if (!el) return () => {};
      const prev = el.getAttribute('content') || '';
      el.setAttribute('content', content);
      return () => el.setAttribute('content', prev);
    };

    document.title = pageTitle;
    const restorers: (() => void)[] = [
      setMeta('meta[name="description"]', metaDescription),
      setMeta('meta[property="og:title"]', pageTitle),
      setMeta('meta[property="og:description"]', metaDescription),
      setMeta('meta[property="og:type"]', 'article'),
      setMeta('meta[property="og:image"]', primaryImage),
      setMeta('meta[name="twitter:title"]', pageTitle),
      setMeta('meta[name="twitter:description"]', metaDescription),
      setMeta('meta[name="twitter:image"]', primaryImage),
    ];

    // Dynamic canonical & og:url
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const createdCanonical = !canonicalEl;
    const prevCanonical = canonicalEl?.getAttribute('href') || '';
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.rel = 'canonical';
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.href = canonicalUrl;

    let ogUrlEl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    const createdOgUrl = !ogUrlEl;
    const prevOgUrl = ogUrlEl?.getAttribute('content') || '';
    if (!ogUrlEl) {
      ogUrlEl = document.createElement('meta');
      ogUrlEl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlEl);
    }
    ogUrlEl.content = canonicalUrl;

    const recipeNode: Record<string, unknown> = {
      '@type': 'Recipe',
      '@id': `${canonicalUrl}#recipe`,
      url: canonicalUrl,
      name: recipe.title,
      description: recipe.description,
      inLanguage: 'fa-IR',
      datePublished: (recipe.createdAt || new Date().toISOString()).slice(0, 10),
      recipeCategory: recipe.category,
      recipeCuisine: recipe.region ? `ایرانی (${recipe.region})` : 'ایرانی',
      keywords: [recipe.title, recipe.category, recipe.region, ...(recipe.dietTags || []), 'دستور پخت ایرانی', 'لاقلی']
        .filter(Boolean)
        .join('، '),
      prepTime: `PT${Math.max(1, recipe.prepMinutes || 10)}M`,
      cookTime: `PT${Math.max(1, recipe.cookMinutes || 15)}M`,
      totalTime: `PT${Math.max(1, totalMinutes || 25)}M`,
      recipeYield: `${recipe.servings} نفر`,
      author: {
        '@type': 'Person',
        name: recipe.authorName,
      },
      nutrition: {
        '@type': 'NutritionInformation',
        calories: `${recipe.nutrition.calories} calories`,
        proteinContent: `${recipe.nutrition.protein} g`,
        carbohydrateContent: `${recipe.nutrition.carbs} g`,
        fatContent: `${recipe.nutrition.fat} g`,
        fiberContent: `${recipe.nutrition.fiber} g`,
      },
      recipeIngredient: recipe.ingredients.map((i) => `${i.amount} ${i.unit} ${i.name}`),
      recipeInstructions: recipe.steps.map((s) => ({
        '@type': 'HowToStep',
        position: s.order,
        name: `گام ${toFaDigits(s.order)}`,
        text: s.timerMinutes
          ? `${s.instruction} (زمان این مرحله: حدود ${toFaDigits(s.timerMinutes)} دقیقه)`
          : s.instruction,
      })),
    };
    if (allImages.length > 0) {
      recipeNode.image = allImages;
    }

    const breadcrumbNode = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {'@type': 'ListItem', position: 1, name: 'لاقلی', item: `${origin}/`},
        {'@type': 'ListItem', position: 2, name: recipe.category || 'دستور پخت', item: `${origin}/?category=${encodeURIComponent(recipe.category || '')}`},
        {'@type': 'ListItem', position: 3, name: recipe.title, item: canonicalUrl},
      ],
    };

    const graph: Record<string, unknown>[] = [recipeNode, breadcrumbNode];

    const answeredQuestions = questions.filter((q) => q.answers && q.answers.length > 0);
    if (answeredQuestions.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: answeredQuestions.slice(0, 8).map((q) => {
          const best = q.answers.find((a) => a.isBest) || q.answers[0];
          return {
            '@type': 'Question',
            name: q.body,
            acceptedAnswer: {
              '@type': 'Answer',
              text: best.body,
            },
          };
        }),
      });
    }

    const existingScript = document.getElementById('lagheli-recipe-jsonld');
    if (existingScript) existingScript.remove();

    const scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.id = 'lagheli-recipe-jsonld';
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
    document.head.appendChild(scriptEl);

    return () => {
      document.title = prevTitle;
      restorers.forEach((fn) => fn());
      if (createdCanonical) {
        canonicalEl?.remove();
      } else if (canonicalEl) {
        canonicalEl.href = prevCanonical;
      }
      if (createdOgUrl) {
        ogUrlEl?.remove();
      } else if (ogUrlEl) {
        ogUrlEl.content = prevOgUrl;
      }
      scriptEl.remove();
    };
  }, [recipe, communityPhotos, questions]);

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
      invalidateRecipeDetail(recipe.id);
      onNotify('دستور ویژه با موفقیت بازگشایی شد.');
      onRefreshUser();
      loadDetail(recipe.id, {force: true});
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
      invalidateRecipeDetail(recipe.id);
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
      if (recipe) {
        invalidateRecipeDetail(recipe.id);
        loadDetail(recipe.id, {force: true});
      }
      onNotify('پاسخ شما ثبت شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت پاسخ');
    }
  };

  const handleShareText = async () => {
    if (!recipe) return;
    const result = await shareRecipeWithWebShare(recipe, {servings, includeIngredients: true});
    if (result.message) {
      onNotify(result.message);
    }
  };

  const handleUploadCommunityPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipe) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!photoPreview) {
      onNotify('لطفاً ابتدا عکس غذای پخته‌شده خود را انتخاب کنید.');
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await apiRequest<{message: string}>(`/api/recipes/${recipe.id}/photos`, {
        method: 'POST',
        body: JSON.stringify({imageDataUrl: photoPreview, caption: photoCaption.trim()}),
      });
      invalidateRecipeDetail(recipe.id);
      setPhotoPreview('');
      setPhotoCaption('');
      setPhotoFormOpen(false);
      onNotify(res.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ارسال عکس غذا');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const adHarmony = ecosystemConfig?.adHarmony ?? DEFAULT_AD_HARMONY;
  const allKnownPartners = useMemo(() => {
    const map = new Map<string, Partner>();
    [...partners, ...contextualPartners].forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [partners, contextualPartners]);

  const inlineAdByIndex = useMemo(() => {
    const map = new Map<number, NativeAdUnit>();
    if (!recipe) return map;
    const matched = matchInlineIngredientAds(recipe.ingredients, nativeAds, adHarmony, recipe);
    matched.forEach((m) => map.set(m.ingredientIndex, m.ad));
    return map;
  }, [recipe, nativeAds, adHarmony]);

  const contextualToolAd = useMemo(() => {
    if (!recipe) return null;
    const terms = [
      ...(recipe.tools || []),
      recipe.category,
      recipe.title,
      ...(subIngredient ? [subIngredient] : []),
    ];
    return matchContextualToolOrSubAd(terms, nativeAds, adHarmony, recipe);
  }, [recipe, subIngredient, nativeAds, adHarmony]);

  if (cookMode && recipe) {
    return (
      <CookModeOverlay
        recipe={recipe}
        servings={servings}
        onClose={() => setCookMode(false)}
        onNotify={onNotify}
      />
    );
  }

  const scale = recipe ? servings / Math.max(1, recipe.servings) : 1;

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleModalScroll}
      role="dialog"
      aria-modal="true"
      aria-label="جزئیات دستور پخت"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] overflow-y-auto overscroll-contain"
    >
      <div className="min-h-screen flex items-start justify-center p-0 sm:p-6 lg:p-10">
        <div className="w-full max-w-[1020px] bg-[#F6F6F5] dark:bg-[#0B0B0B] sm:bg-[#FFFFFF]/94 sm:dark:bg-[#0B0B0B]/92 sm:backdrop-blur-[14px] sm:rounded-[32px] sm:border sm:border-[#E6E6E3] sm:dark:border-[#282825] shadow-[0_32px_90px_-28px_rgba(17,17,16,0.38)] dark:shadow-[0_32px_90px_-28px_rgba(0,0,0,0.75)] overflow-clip my-0 sm:my-4">
          {/* Sticky Reading Bar + Reading Progress Hairline */}
          <div className="sticky top-0 z-20 bg-[#FFFFFF]/94 dark:bg-[#0B0B0B]/94 backdrop-blur-[12px] border-b border-[#E6E6E3] dark:border-[#242422]">
            <div className="flex items-center justify-between gap-2.5 px-4 sm:px-10 h-14 sm:h-16">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-3 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#111110]/[0.05] dark:hover:bg-white/[0.07] transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-4 h-4" />
                <span>بستن</span>
              </button>

              {recipe && !(recipe.isVip && !recipe.isUnlocked) ? (
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => scrollToSection(ingredientsSectionRef)}
                    className="min-h-[38px] px-2.5 sm:px-3 rounded-full text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#111110]/[0.05] dark:hover:bg-white/[0.07] transition-colors whitespace-nowrap"
                  >
                    مواد اولیه
                  </button>
                  <span aria-hidden="true" className="text-[#E6E6E3] dark:text-[#282825] select-none">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToSection(stepsSectionRef)}
                    className="min-h-[38px] px-2.5 sm:px-3 rounded-full text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#111110]/[0.05] dark:hover:bg-white/[0.07] transition-colors whitespace-nowrap"
                  >
                    مراحل پخت
                  </button>
                  <span className="hidden lg:inline text-[#E6E6E3] dark:text-[#282825] select-none">
                    ·
                  </span>
                  <span className="hidden lg:block text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] truncate max-w-[220px]">
                    {recipe.title}
                  </span>
                </div>
              ) : recipe ? (
                <span className="hidden md:block text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] truncate max-w-md">
                  {recipe.title}
                </span>
              ) : null}

              {recipe && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleShareText}
                    aria-label="اشتراک‌گذاری دستور پخت"
                    className="min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-3 rounded-full text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#111110]/[0.05] dark:hover:bg-white/[0.07] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">اشتراک‌گذاری</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(recipe.id)}
                    aria-label={isBookmarked ? 'حذف نشانک' : 'ذخیره در نشانک‌ها'}
                    aria-pressed={isBookmarked}
                    className={`min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-3.5 rounded-full text-sm inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      isBookmarked
                        ? 'bg-[#A97222]/15 text-[#A97222] dark:bg-[#D8A85B]/15 dark:text-[#D8A85B] font-semibold'
                        : 'hover:bg-[#111110]/[0.05] dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" fill={isBookmarked ? 'currentColor' : 'none'} />
                    <span className="hidden sm:inline">{isBookmarked ? 'نشانک‌شده' : 'ذخیره'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2px Compositor-Only Reading Progress Hairline */}
            <div className="h-[2px] w-full bg-transparent overflow-hidden" aria-hidden="true">
              <div
                className="h-full w-full origin-right bg-gradient-to-l from-[#A97222] to-[#B54B1F] dark:from-[#D8A85B] dark:to-[#E29A6F] transition-transform duration-150 ease-out"
                style={{transform: `scaleX(${readProgress / 100})`}}
              />
            </div>
          </div>

          {loading || !recipe ? (
            <RecipeDetailSkeleton />
          ) : (
            <div className="px-4 sm:px-10 lg:px-14 pt-4 sm:pt-10 pb-14 sm:pb-20 space-y-10 sm:space-y-14">
              {/* Hero Photograph + Cleanly Layered Primary Dish Info Panel */}
              <div className="relative">
                <div className="rounded-[22px] sm:rounded-[26px] overflow-hidden border border-[#E6E6E3] dark:border-[#282825] bg-[#EFEFED] dark:bg-[#151514]">
                  <EditorialImage
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    category={recipe.category}
                    photoCreditName={recipe.photoCreditName}
                    creditPosition="top"
                    aspectClass="aspect-[4/3] sm:aspect-[16/9]"
                    priority
                  />
                </div>

                {/* Primary Dish Information Panel — Cleanly Framed Without Clipping Photo Credit */}
                <div className="relative z-10 -mt-5 sm:-mt-14 mx-1.5 sm:mx-6 lg:mx-8 rounded-[24px] sm:rounded-[28px] bg-[#FFFFFF] dark:bg-[#151514] sm:bg-[#FFFFFF]/90 sm:dark:bg-[#151514]/90 sm:backdrop-blur-[14px] border border-[#E6E6E3] dark:border-[#282825] shadow-[0_18px_48px_-22px_rgba(17,17,16,0.22)] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.72)] p-5 sm:p-9 lg:p-10 space-y-5 sm:space-y-6">
                  {/* Quiet Unboxed Editorial Metadata Line */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
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

                  {/* Display Headline & Editorial Deck with Generous Measure */}
                  <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl lg:text-[2.15rem] font-bold leading-[1.35] text-balance text-[#111110] dark:text-[#FAFAFA]">
                      {recipe.title}
                    </h1>
                    <p className="text-sm sm:text-base text-[#5C5C58] dark:text-[#A3A39E] leading-[1.95] max-w-[62ch]">
                      {recipe.description}
                    </p>
                  </div>

                  {/* Chef Attribution & Time Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-[#111110]/[0.08] dark:border-white/[0.1]">
                    <button
                      type="button"
                      onClick={() => onOpenChef(recipe.authorId)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium min-h-[44px] text-[#111110] dark:text-[#FAFAFA] hover:text-[#B54B1F] dark:hover:text-[#E29A6F] transition-colors"
                    >
                      <span>{recipe.authorName}</span>
                      {recipe.authorVerified && (
                        <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                        آماده‌سازی: {toFaDigits(recipe.prepMinutes)} دقیقه
                      </span>
                      <span>پخت: {toFaDigits(recipe.cookMinutes)} دقیقه</span>
                      <span>کل زمان: {toFaDigits(recipe.prepMinutes + recipe.cookMinutes)} دقیقه</span>
                    </div>
                  </div>

                  {/* Primary Action Bar — Sculptural Obsidian Pill CTA */}
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                    {recipe.isVip && !recipe.isUnlocked ? (
                      <button
                        type="button"
                        onClick={handleUnlockVip}
                        className="w-full sm:w-auto justify-center min-h-[50px] px-6 sm:px-7 rounded-full bg-[#B54B1F] hover:bg-[#963B15] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>بازگشایی دستور ویژه با {toFaDigits(recipe.vipGemCost)} جِم</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCookMode(true)}
                        className="w-full sm:w-auto justify-center min-h-[50px] px-6 sm:px-7 rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] dark:text-[#111110] text-[#FFFFFF] text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <ChefHat className="w-4 h-4 shrink-0" />
                        <span>شروع حالت آشپزی (گام‌به‌گام)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleShareText}
                      className="w-full sm:w-auto justify-center min-h-[48px] px-5 rounded-full border border-[#111110]/15 dark:border-white/15 bg-[#FFFFFF]/60 dark:bg-white/[0.04] hover:bg-[#EFEFED] dark:hover:bg-white/[0.08] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>اشتراک‌گذاری دستور</span>
                    </button>
                  </div>
                </div>

                {/* Callout for Photo-less Recipes: Invite First Real User Dish Photo */}
                {(!recipe.imageUrl || recipe.imageUrl.trim().length === 0) && (
                  <div className="mt-8 mx-2 sm:mx-6 lg:mx-8 rounded-2xl border border-[#B54B1F]/20 dark:border-[#E29A6F]/25 bg-[#F6F6F5] dark:bg-[#151514] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        این دستور هنوز عکس واقعی ندارد — اولین عکاس آن باشید
                      </p>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-[1.85] max-w-xl">
                        پس از پخت، عکس واقعی غذای خود را ثبت کنید تا با نام شما تصویر اصلی این دستور شود و ۴۰ جِم هدیه بگیرید.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          onRequireAuth();
                          return;
                        }
                        setPhotoFormOpen(true);
                      }}
                      className="w-full sm:w-auto min-h-[44px] px-5 rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>ارسال عکس واقعی (+۴۰ جِم)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Airy Editorial Nutrition Strip (Mobile-Safe 2->5 Cols, Zero Heavy Box) */}
              <div className="mx-2 sm:mx-6 lg:mx-8 border-y border-[#111110]/[0.07] dark:border-white/[0.08] py-6 sm:py-7">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-5 gap-x-4 sm:gap-6 text-center tabular-nums">
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">کالری</div>
                    <div className="text-lg sm:text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                      {toFaDigits(recipe.nutrition.calories)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">پروتئین</div>
                    <div className="text-lg sm:text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                      {toFaDigits(recipe.nutrition.protein)} گ
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">کربوهیدرات</div>
                    <div className="text-lg sm:text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                      {toFaDigits(recipe.nutrition.carbs)} گ
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">چربی</div>
                    <div className="text-lg sm:text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                      {toFaDigits(recipe.nutrition.fat)} گ
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">فیبر</div>
                    <div className="text-lg sm:text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                      {toFaDigits(recipe.nutrition.fiber)} گ
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP Lock Curtain or Full Content */}
              {recipe.isVip && !recipe.isUnlocked ? (
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center space-y-3">
                  <Lock className="w-7 h-7 mx-auto text-[#A97222]" />
                  <h3 className="text-lg font-bold">دستور تخصصی و ویژه سرآشپز</h3>
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] max-w-md mx-auto">
                    مقادیر دقیق، نکات طلایی پخت و مراحل کامل این دستور با خرج {toFaDigits(recipe.vipGemCost)} جِم از کیف جِم شما برای همیشه بازگشایی می‌شود.
                  </p>
                  <button
                    type="button"
                    onClick={handleUnlockVip}
                    className="min-h-[48px] px-6 rounded-xl bg-[#B54B1F] text-[#FAFAFA] text-sm font-medium mt-2"
                  >
                    بازگشایی با {toFaDigits(recipe.vipGemCost)} جِم
                  </button>
                </div>
              ) : (
                <div className="mx-2 sm:mx-6 lg:mx-8 grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-14 xl:gap-16 items-start">
                  {/* Sticky Editorial Ingredients Ledger + Servings Scaler */}
                  <div ref={ingredientsSectionRef} className="lg:col-span-5 lg:sticky lg:top-24 scroll-mt-24 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-[#847F73] dark:text-[#8C8C86] block">
                            فصل اول · فهرست تدارک
                          </span>
                          <h2 className="text-xl font-bold text-[#111110] dark:text-[#FAFAFA]">مواد اولیه</h2>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#111110]/[0.1] dark:border-white/[0.12] bg-[#F6F6F5] dark:bg-[#151514] p-1">
                          <button
                            type="button"
                            aria-label="کاهش تعداد نفرات"
                            onClick={() => setServings((s) => Math.max(1, s - 1))}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs sm:text-sm font-semibold tabular-nums min-w-[4.25rem] text-center">
                            {toFaDigits(servings)} نفر
                          </span>
                          <button
                            type="button"
                            aria-label="افزایش تعداد نفرات"
                            onClick={() => setServings((s) => Math.min(20, s + 1))}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full bg-[#111110] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#111110] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Quick Servings Choices (Inspired by Editorial Quick Choices) */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        {[2, 4, 6, 8].map((preset) => {
                          const active = servings === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setServings(preset)}
                              className={`min-h-[38px] px-4 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-[#111110] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#111110]'
                                  : 'bg-[#EFEFED] dark:bg-[#151514] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
                              }`}
                            >
                              {toFaDigits(preset)} نفره
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Ingredient Readiness Progress */}
                    <div className="space-y-2 rounded-2xl bg-[#F6F6F5] dark:bg-[#151514] border border-[#111110]/[0.06] dark:border-white/[0.08] px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E] font-medium">
                          {haveSet.size === 0
                            ? 'مواد موجود در خانه را تیک بزنید'
                            : haveSet.size >= recipe.ingredients.length
                              ? 'تمام مواد آماده پخت هستند'
                              : 'آمادگی مواد اولیه'}
                        </span>
                        <span className="font-bold tabular-nums text-[#0D0D0D] dark:text-[#FAFAFA] whitespace-nowrap">
                          {toFaDigits(haveSet.size)} از {toFaDigits(recipe.ingredients.length)} قلم
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#E6E6E3] dark:bg-[#242422] overflow-hidden">
                        <motion.div
                          className="h-full w-full origin-right rounded-full bg-gradient-to-l from-[#A97222] to-[#B54B1F] dark:from-[#D8A85B] dark:to-[#E29A6F]"
                          initial={false}
                          animate={{
                            scaleX:
                              recipe.ingredients.length > 0
                                ? Math.min(1, haveSet.size / recipe.ingredients.length)
                                : 0,
                          }}
                          transition={
                            prefersReducedMotion
                              ? {duration: 0}
                              : {duration: 0.28, ease: [0.16, 1, 0.3, 1]}
                          }
                        />
                      </div>
                    </div>

                    <ul className="divide-y divide-[#111110]/[0.07] dark:divide-white/[0.08] border-y border-[#111110]/[0.07] dark:border-white/[0.08]">
                      {recipe.ingredients.map((ing: IngredientItem, idx: number) => {
                        const checked = haveSet.has(ing.name);
                        const inlineAd = inlineAdByIndex.get(idx);
                        return (
                          <li key={ing.name} className="py-3.5">
                            <div className="flex items-center justify-between gap-3">
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
                                      ? 'bg-[#B54B1F] border-[#B54B1F] text-white dark:bg-[#E29A6F] dark:border-[#E29A6F] dark:text-[#0B0B0B]'
                                      : 'border-[#5C5C58]/35'
                                  }`}
                                >
                                  {checked && <Check className="w-3.5 h-3.5" />}
                                </span>
                                <span
                                  className={`text-sm leading-relaxed ${
                                    checked ? 'line-through opacity-45' : 'text-[#0D0D0D] dark:text-[#FAFAFA]'
                                  }`}
                                >
                                  {ing.name}
                                </span>
                              </button>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                                  {formatQuantity(ing.amount * scale)} {ing.unit}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`یافتن جایگزین برای ${ing.name}`}
                                  title="یافتن جایگزین"
                                  onClick={() => handleFindSubstitute(ing.name)}
                                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#5C5C58] hover:text-[#111110] hover:bg-[#EFEFED] dark:hover:text-[#FAFAFA] dark:hover:bg-[#20201E] transition-colors"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {inlineAd && (
                              <NativeAdSlot
                                ad={inlineAd}
                                disclosureLabel={adHarmony.disclosureLabel}
                                partners={allKnownPartners}
                                onOpenPartner={onOpenPartner}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      type="button"
                      onClick={handleAddMissing}
                      className="w-full min-h-[50px] rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] dark:text-[#111110] text-[#FFFFFF] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        افزودن یک‌کلیکی کمبودها ({toFaDigits(recipe.ingredients.length - haveSet.size)} قلم)
                      </span>
                    </button>

                    {/* Frosted Inline Substitution Layer */}
                    {subIngredient && (
                      <div className="rounded-2xl border border-[#111110]/[0.08] dark:border-white/[0.1] bg-[#F6F6F5]/85 dark:bg-[#151514]/85 backdrop-blur-lg p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold">جایگزین‌های پیشنهادی برای «{subIngredient}»</h3>
                          <button
                            type="button"
                            onClick={() => setSubIngredient(null)}
                            className="text-xs text-[#5C5C58] min-h-[36px] px-2"
                          >
                            بستن
                          </button>
                        </div>
                        <div className="space-y-4">
                          {subResults.map((s) => (
                            <div
                              key={s.substitute}
                              className="pt-3.5 first:pt-0 border-t first:border-t-0 border-[#111110]/[0.07] dark:border-white/[0.08] space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{s.substitute}</span>
                                <span className="text-xs text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
                                  سازگاری {toFaDigits(s.compatibility)}٪{s.isVegan ? ' · گیاهی' : ''}
                                </span>
                              </div>
                              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">نسبت: {s.ratio}</p>
                              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-[1.85]">
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
                                className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:underline min-h-[36px]"
                              >
                                + افزودن به لیست خرید
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Spacious Editorial Cooking Narrative + Subsequent Magazine Chapters */}
                  <div ref={stepsSectionRef} className="lg:col-span-7 scroll-mt-24 space-y-16">
                    <div className="space-y-8">
                      <div className="flex items-end justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-[#847F73] dark:text-[#8C8C86] block">
                            فصل دوم · روایت پخت
                          </span>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#111110] dark:text-[#FAFAFA]">
                            مراحل پخت
                          </h2>
                        </div>
                        {activeStepOrder !== null && (
                          <button
                            type="button"
                            onClick={() => setActiveStepOrder(null)}
                            className="text-xs text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA] min-h-[36px] px-2 transition-colors"
                          >
                            نمایش یکسان همه مراحل
                          </button>
                        )}
                      </div>

                      <ol className="space-y-10 sm:space-y-12">
                        {recipe.steps.map((step) => {
                          const isFocused = activeStepOrder === step.order;
                          const isDimmed = activeStepOrder !== null && !isFocused;
                          return (
                            <li
                              key={step.order}
                              onClick={() =>
                                setActiveStepOrder((curr) => (curr === step.order ? null : step.order))
                              }
                              className={`group flex gap-5 sm:gap-7 cursor-pointer transition-opacity duration-200 ${
                                isDimmed ? 'opacity-45 hover:opacity-85' : 'opacity-100'
                              }`}
                            >
                              <span
                                className={`text-2xl sm:text-[1.85rem] font-light tabular-nums leading-none pt-1 min-w-[2.25rem] select-none transition-colors ${
                                  isFocused
                                    ? 'text-[#B54B1F] dark:text-[#E29A6F] font-semibold'
                                    : 'text-[#B54B1F]/70 dark:text-[#E29A6F]/75'
                                }`}
                              >
                                {toFaDigits(step.order < 10 ? `0${step.order}` : step.order)}
                              </span>
                              <div className="space-y-3 flex-1 pb-6 border-b border-[#111110]/[0.05] dark:border-white/[0.06] group-last:border-b-0 group-last:pb-0">
                                <p className="text-[15.5px] sm:text-[16.5px] leading-[2.05] text-[#0D0D0D] dark:text-[#EFEFED] max-w-[58ch]">
                                  {step.instruction}
                                </p>
                                {step.timerMinutes && (
                                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums inline-flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-[#B54B1F]/80 dark:text-[#E29A6F]" />
                                    <span>زمان تقریبی این مرحله: {toFaDigits(step.timerMinutes)} دقیقه</span>
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {/* Calm Contextual Tool / Technique Brand Recommendation (Max 1 per Recipe) */}
                    {contextualToolAd && (
                      <div className="border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-8">
                        <NativeAdSlot
                          ad={contextualToolAd}
                          disclosureLabel={adHarmony.disclosureLabel}
                          partners={allKnownPartners}
                          onOpenPartner={onOpenPartner}
                        />
                      </div>
                    )}

                    {/* Location-Matched Nearby Restaurants, Cafes & Fast-Foods ("حوصله پختش رو نداری؟") */}
                    {adHarmony.adsEnabled && adHarmony.nearbyVenuesEnabled !== false && localVenues.length > 0 && (
                      <div className="border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-8">
                        <NearbyVenueCard
                          recipe={recipe}
                          venues={localVenues}
                          defaultCity={user?.city || city || 'تهران'}
                          defaultNeighborhood={user?.neighborhood || ''}
                          partners={allKnownPartners}
                          onOpenPartner={onOpenPartner}
                          onNotify={onNotify}
                        />
                      </div>
                    )}

                    {/* Quiet Contextual Partner Suggestion (Zero Hollow Coupons) */}
                    {contextualPartners.length > 0 && (
                      <div className="space-y-4 border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-10">
                        <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          برندهای همکار مرتبط با این دستور
                        </p>
                        {contextualPartners.map((partner) => (
                          <div
                            key={partner.id}
                            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                                {PARTNER_ROLE_LABELS[partner.roleType]} · {partner.city}
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenPartner(partner)}
                                className="text-base font-bold hover:text-[#B54B1F] dark:hover:text-[#E29A6F] text-right"
                              >
                                {partner.name}
                              </button>
                              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] line-clamp-1">
                                {partner.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenPartner(partner)}
                                className="min-h-[44px] px-4 rounded-xl bg-[#EFEFED] dark:bg-[#20201E] text-xs font-medium"
                              >
                                مشاهده صفحه برند
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Community Real Cooked Photos Gallery & Upload */}
                    <div className="border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-10 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <h2 className="text-base font-bold inline-flex items-center gap-2">
                            <Camera className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                            <span>عکس‌های واقعی کاربران از این دستور ({toFaDigits(communityPhotos.length)})</span>
                          </h2>
                          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                            تصاویر واقعی پخته‌شده توسط آشپزهای لاقلی در خانه
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!user) {
                              onRequireAuth();
                              return;
                            }
                            setPhotoFormOpen((v) => !v);
                          }}
                          className="min-h-[42px] px-4 rounded-xl border border-[#B54B1F]/40 dark:border-[#E29A6F]/40 text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:bg-[#B54B1F]/8 inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>ثبت عکس غذای پخته‌شده من</span>
                        </button>
                      </div>

                      {photoFormOpen && (
                        <form
                          onSubmit={handleUploadCommunityPhoto}
                          className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="min-h-[44px] px-4 rounded-xl border border-dashed border-[#B54B1F]/50 dark:border-[#E29A6F]/50 bg-[#F6F6F5] dark:bg-[#0B0B0B] text-xs font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-[#EFEFED] dark:hover:bg-[#20201E]">
                              <Camera className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                              <span>{photoPreview ? 'انتخاب تصویر دیگر' : 'انتخاب عکس از دوربین یا گالری'}</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                capture="environment"
                                className="sr-only"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const compressed = await fileToCompressedDataUrl(file);
                                    setPhotoPreview(compressed);
                                  } catch (err) {
                                    onNotify(err instanceof Error ? err.message : 'خطا در خواندن تصویر');
                                  }
                                }}
                              />
                            </label>
                            {photoPreview && (
                              <img
                                src={photoPreview}
                                alt="پیش‌نمایش عکس شما"
                                className="w-24 h-18 object-cover rounded-xl border border-[#E6E6E3] dark:border-[#282825]"
                              />
                            )}
                          </div>

                          <input
                            type="text"
                            maxLength={240}
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            placeholder="تجربه پخت یا نکته کوتاه شما (اختیاری، مثلاً با روغن کرمانشاهی عالی شد)..."
                            className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-xs"
                          />

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
                              پس از تایید مدیریت منتشر می‌شود و با نام شما نمایش داده خواهد شد.
                            </span>
                            <button
                              type="submit"
                              disabled={uploadingPhoto || !photoPreview}
                              className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-xs font-medium disabled:opacity-40"
                            >
                              {uploadingPhoto ? 'در حال ارسال...' : 'ارسال برای انتشار'}
                            </button>
                          </div>
                        </form>
                      )}

                      {communityPhotos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {communityPhotos.map((ph) => (
                            <figure
                              key={ph.id}
                              className="rounded-2xl overflow-hidden border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514]"
                            >
                              <EditorialImage
                                src={ph.imageUrl}
                                alt={`عکس واقعی از ${ph.userName}`}
                                aspectClass="aspect-[4/3]"
                                compactEmpty
                              />
                              <figcaption className="p-3.5 space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span>{ph.userName}</span>
                                  {ph.isCover && (
                                    <span className="text-[11px] text-[#B54B1F] dark:text-[#E29A6F]">تصویر منتخب دستور</span>
                                  )}
                                </div>
                                {ph.caption && (
                                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                                    {ph.caption}
                                  </p>
                                )}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          هنوز عکسی از پخت کاربران برای این دستور ثبت نشده است. با ارسال اولین عکس، نام شما پای تصویر اصلی درج می‌شود.
                        </p>
                      )}
                    </div>

                    {/* Variations / Forking */}
                    <div className="border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-10 space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <h2 className="text-base font-bold inline-flex items-center gap-2">
                          <GitFork className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
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
                          className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:underline min-h-[44px] px-2"
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
                              className="w-full text-right rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 hover:border-[#B54B1F]/50 transition-colors"
                            >
                              <div className="text-sm font-bold">{v.title}</div>
                              {v.variationNote && (
                                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-1">{v.variationNote}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          هنوز نسخه جایگزینی (مثلاً رژیمی یا بومی شهر دیگر) برای این دستور ثبت نشده است.
                        </p>
                      )}
                    </div>

                    {/* Q&A Section */}
                    <div className="border-t border-[#111110]/[0.07] dark:border-white/[0.08] pt-10 space-y-6">
                      <h2 className="text-base font-bold inline-flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                        <span>پرسش و پاسخ آشپزی ({toFaDigits(questions.length)})</span>
                      </h2>

                      <form onSubmit={handleAskQuestion} className="flex gap-2">
                        <input
                          type="text"
                          value={questionBody}
                          onChange={(e) => setQuestionBody(e.target.value)}
                          placeholder="سوالی درباره این دستور دارید؟ بپرسید..."
                          className="flex-1 min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-4 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={questionBody.trim().length < 6}
                          className="min-h-[48px] px-5 rounded-xl bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-sm font-medium disabled:opacity-40"
                        >
                          ارسال
                        </button>
                      </form>

                      <div className="space-y-4">
                        {questions.map((q) => (
                          <div
                            key={q.id}
                            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                              <span>{q.authorName}</span>
                              {q.solved && (
                                <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">حل‌شده</span>
                              )}
                            </div>
                            <p className="text-sm font-medium">{q.body}</p>

                            {q.answers.length > 0 && (
                              <div className="space-y-3 pt-2 border-t border-[#E6E6E3]/70 dark:border-[#282825]">
                                {q.answers.map((a) => (
                                  <div key={a.id} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                                      <span className="inline-flex items-center gap-1 font-medium text-[#0D0D0D] dark:text-[#FAFAFA]">
                                        {a.authorName}
                                        {a.authorVerified && (
                                          <BadgeCheck className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                                        )}
                                        {a.isBest && (
                                          <span className="text-[#B54B1F] dark:text-[#E29A6F] mr-1">· بهترین پاسخ</span>
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
                                            className="text-xs text-[#B54B1F] dark:text-[#E29A6F] hover:underline"
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
                                          className="inline-flex items-center gap-1 text-xs hover:text-[#B54B1F] tabular-nums min-h-[32px] px-1.5"
                                        >
                                          <ThumbsUp className="w-3.5 h-3.5" />
                                          <span>{toFaDigits(a.upvotes)}</span>
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
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
                                  className="flex-1 min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitAnswer(q.id)}
                                  className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] text-[#FAFAFA] text-xs font-medium"
                                >
                                  ثبت پاسخ
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReplyTargetId(q.id)}
                                className="text-xs text-[#5C5C58] hover:text-[#B54B1F] dark:text-[#A3A39E] min-h-[36px]"
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

          {/* Conditional Mobile Thumb-Zone Action Bar (<=15% Sticky Cap, Shown After Hero CTA Scrolled Past) */}
          {showMobileBar && recipe && !(recipe.isVip && !recipe.isUnlocked) && (
            <motion.div
              initial={prefersReducedMotion ? false : {opacity: 0, y: 14}}
              animate={{opacity: 1, y: 0}}
              transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2, ease: [0.16, 1, 0.3, 1]}}
              className="lg:hidden sticky bottom-0 z-20 border-t border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF]/95 dark:bg-[#0B0B0B]/95 backdrop-blur-[14px] px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCookMode(true)}
                  className="flex-1 min-h-[46px] px-4 rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#111110] text-xs font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  <ChefHat className="w-4 h-4 shrink-0" />
                  <span>شروع آشپزی</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddMissing}
                  className="min-h-[46px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#151514] text-[#0D0D0D] dark:text-[#FAFAFA] text-xs font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform whitespace-nowrap tabular-nums"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#A97222] dark:text-[#D8A85B] shrink-0" />
                  <span>
                    {Math.max(0, recipe.ingredients.length - haveSet.size) > 0
                      ? `کمبودها (${toFaDigits(Math.max(0, recipe.ingredients.length - haveSet.size))})`
                      : 'همه آماده است'}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
