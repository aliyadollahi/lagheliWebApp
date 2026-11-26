import {
  canonicalizeIngredient,
  classifyIngredientCategory,
  estimateRecipeCost,
  normalizePersian,
  toFaDigits,
} from './persianEngine.ts';
import type {
  AdminEditorialInsightsReport,
  EditorialAttentionReason,
  EditorialPriorityLevel,
  EditorialRecipeRecommendation,
  EditorialRecommendedAction,
  Recipe,
  SearchTrendItem,
} from './types.ts';

export interface RawSearchLogRow {
  queryRaw: string;
  queryNorm: string;
  source: 'search' | 'fridge';
  resultsCount: number;
  createdAt: string;
}

export interface RecipeEngagementSignals {
  bookmarksCount: number;
  questionsCount: number;
  unsolvedQuestionsCount: number;
  pendingPhotosCount: number;
  pendingDraftsCount: number;
}

/**
 * Matches a normalized Persian search query against a recipe using the existing
 * Persian text normalizer and canonical ingredient mapper.
 */
export function doesTrendMatchRecipe(normalizedQuery: string, recipe: Recipe): boolean {
  const qNorm = normalizePersian(normalizedQuery);
  if (!qNorm || qNorm.length < 2) return false;

  const qCanonical = normalizePersian(canonicalizeIngredient(qNorm));
  const tokens = qNorm.split(' ').filter((t) => t.length >= 2);

  const canonicalIngredients = recipe.ingredients.map((i) => normalizePersian(canonicalizeIngredient(i.name)));
  const rawIngredients = recipe.ingredients.map((i) => normalizePersian(i.name));

  const corpus = normalizePersian(
    [
      recipe.title,
      recipe.subtitle,
      recipe.description,
      recipe.category,
      recipe.region,
      recipe.season,
      ...recipe.dietTags,
      ...rawIngredients,
      ...canonicalIngredients,
    ].join(' ')
  );

  if (corpus.includes(qNorm) || (qCanonical.length >= 2 && corpus.includes(qCanonical))) {
    return true;
  }

  // Multi-word partial token overlap (at least 65% of meaningful tokens present)
  if (tokens.length >= 2) {
    const hitTokens = tokens.filter((t) => corpus.includes(t));
    if (hitTokens.length / tokens.length >= 0.65) {
      return true;
    }
  }

  return false;
}

/**
 * Pure deterministic smart recommendation engine built directly on top of
 * lagheli's existing Persian helpers (normalizePersian, canonicalizeIngredient,
 * classifyIngredientCategory, estimateRecipeCost).
 */
export function buildAdminEditorialInsights(
  recipes: Recipe[],
  searchLogs: RawSearchLogRow[],
  signalsByRecipe: Map<string, RecipeEngagementSignals>,
  nowMs = Date.now()
): AdminEditorialInsightsReport {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  // 1. Aggregate anonymized search logs into normalized trend buckets
  const bucketMap = new Map<
    string,
    {
      displayCounts: Map<string, number>;
      searchCount: number;
      recentCount: number;
      totalResults: number;
      sources: Set<'search' | 'fridge'>;
      lastSearchedAt: string;
    }
  >();

  for (const log of searchLogs) {
    const norm = normalizePersian(log.queryNorm || log.queryRaw);
    if (!norm || norm.length < 2) continue;

    let bucket = bucketMap.get(norm);
    if (!bucket) {
      bucket = {
        displayCounts: new Map<string, number>(),
        searchCount: 0,
        recentCount: 0,
        totalResults: 0,
        sources: new Set<'search' | 'fridge'>(),
        lastSearchedAt: log.createdAt,
      };
      bucketMap.set(norm, bucket);
    }

    const display = (log.queryRaw || norm).trim();
    bucket.displayCounts.set(display, (bucket.displayCounts.get(display) || 0) + 1);
    bucket.searchCount += 1;
    bucket.totalResults += Math.max(0, Number(log.resultsCount) || 0);
    bucket.sources.add(log.source === 'fridge' ? 'fridge' : 'search');
    if (log.createdAt > bucket.lastSearchedAt) {
      bucket.lastSearchedAt = log.createdAt;
    }

    const parsedTs = Date.parse(log.createdAt);
    if (!Number.isNaN(parsedTs) && nowMs - parsedTs <= sevenDaysMs) {
      bucket.recentCount += 1;
    }
  }

  // Convert buckets into sorted SearchTrendItem list and count live catalog matches
  const publishedRecipes = recipes.filter((r) => r.status === 'published');
  const trendingQueries: SearchTrendItem[] = Array.from(bucketMap.entries())
    .map(([normalizedQuery, b]) => {
      let bestDisplay = normalizedQuery;
      let bestCount = -1;
      for (const [disp, cnt] of b.displayCounts.entries()) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestDisplay = disp;
        }
      }
      const matchedRecipesCount = publishedRecipes.filter((rec) => doesTrendMatchRecipe(normalizedQuery, rec)).length;
      const source: SearchTrendItem['source'] =
        b.sources.size > 1 ? 'mixed' : b.sources.has('fridge') ? 'fridge' : 'search';

      return {
        query: bestDisplay,
        normalizedQuery,
        searchCount: b.searchCount,
        recentCount: b.recentCount,
        avgResultsCount: Math.round((b.totalResults / Math.max(1, b.searchCount)) * 10) / 10,
        matchedRecipesCount,
        category: classifyIngredientCategory(canonicalizeIngredient(bestDisplay)),
        source,
        lastSearchedAt: b.lastSearchedAt,
      };
    })
    .sort((a, b) => b.searchCount - a.searchCount || b.recentCount - a.recentCount);

  // Content gaps: trending searches with 0 matching published recipes
  const contentGaps = trendingQueries.filter((t) => t.matchedRecipesCount === 0).slice(0, 12);

  // 2. Evaluate every recipe for demand × editorial attention signals
  const maxTrendHits = Math.max(
    1,
    ...recipes.map((rec) =>
      trendingQueries.reduce((acc, t) => (doesTrendMatchRecipe(t.normalizedQuery, rec) ? acc + t.searchCount : acc), 0)
    )
  );

  let totalHealthAccumulator = 0;
  const recommendations: EditorialRecipeRecommendation[] = [];

  for (const rec of recipes) {
    const sig = signalsByRecipe.get(rec.id) || {
      bookmarksCount: 0,
      questionsCount: 0,
      unsolvedQuestionsCount: 0,
      pendingPhotosCount: 0,
      pendingDraftsCount: rec.pendingDraftsCount || 0,
    };

    const matchedTrends: {query: string; count: number}[] = [];
    let searchHits = 0;
    for (const tr of trendingQueries) {
      if (doesTrendMatchRecipe(tr.normalizedQuery, rec)) {
        searchHits += tr.searchCount;
        matchedTrends.push({query: tr.query, count: tr.searchCount});
      }
    }
    matchedTrends.sort((a, b) => b.count - a.count);

    // Popularity / Demand Score (0..50)
    const searchRatio = searchHits / maxTrendHits;
    const engagementPoints = Math.min(18, sig.bookmarksCount * 4 + sig.questionsCount * 3);
    const demandScore = Math.min(50, Math.round(searchRatio * 34 + engagementPoints));

    // Editorial Attention Reasons (0..65 raw, clamped to 50 for composite score)
    const reasons: EditorialAttentionReason[] = [];
    const hasCover = Boolean(rec.imageUrl && rec.imageUrl.trim().length > 0);

    if (!hasCover) {
      reasons.push({
        code: 'missing_cover_photo',
        label: 'فاقد تصویر اصلی',
        detail:
          searchHits > 0
            ? `با وجود ${toFaDigits(searchHits)} جستجوی مرتبط، هنوز تصویر اصلی ندارد.`
            : 'ثبت یا تایید عکس واقعی نرخ کلیک این دستور را به‌طور محسوسی افزایش می‌دهد.',
        weight: 30,
      });
    }

    if (sig.pendingPhotosCount > 0) {
      reasons.push({
        code: 'pending_community_photo',
        label: `${toFaDigits(sig.pendingPhotosCount)} عکس ارسالی منتظر بررسی`,
        detail: 'کاربران عکس واقعی از این غذا فرستاده‌اند که آماده تایید یا انتخاب به‌عنوان تصویر اصلی است.',
        weight: 22,
      });
    }

    if (sig.pendingDraftsCount > 0) {
      reasons.push({
        code: 'pending_draft_review',
        label: `${toFaDigits(sig.pendingDraftsCount)} پیش‌نویس آماده تایید`,
        detail: 'نسخه ویرایشی جدید ثبت شده و منتظر پیش‌نمایش و انتشار نهایی است.',
        weight: 24,
      });
    }

    if (sig.unsolvedQuestionsCount > 0) {
      reasons.push({
        code: 'unsolved_questions',
        label: `${toFaDigits(sig.unsolvedQuestionsCount)} پرسش بی‌پاسخ کاربران`,
        detail: 'کاربران درباره اجرای این دستور سوال ثبت کرده‌اند که هنوز پاسخ برگزیده ندارد.',
        weight: 24,
      });
    }

    if (rec.status === 'pending') {
      reasons.push({
        code: 'pending_publication',
        label: 'در انتظار انتشار نهایی',
        detail: 'این دستور هنوز منتشر نشده و با ترندهای جستجوی کاربران هم‌راستاست.',
        weight: 22,
      });
    }

    const stepsWithoutTimer = rec.steps.filter((s) => !s.timerMinutes).length;
    const isThinSteps = rec.steps.length < 4 || stepsWithoutTimer >= Math.ceil(rec.steps.length * 0.7);
    const isShortDesc = (rec.description || '').trim().length < 65;
    if (isThinSteps || isShortDesc) {
      reasons.push({
        code: 'thin_steps_or_timers',
        label: 'نیاز به غنی‌سازی مراحل یا زمان‌سنج',
        detail:
          rec.steps.length < 4
            ? `تنها ${toFaDigits(rec.steps.length)} مرحله ثبت شده؛ افزودن نکات کلیدی و تایمر کیفیت آشپزی را بالا می‌برد.`
            : `${toFaDigits(stepsWithoutTimer)} مرحله بدون زمان‌سنج پخت است یا توضیح معرفی کوتاه می‌باشد.`,
        weight: 14,
      });
    }

    if (rec.tools.length === 0 || rec.dietTags.length < 2) {
      reasons.push({
        code: 'missing_tools_or_tags',
        label: 'برچسب رژیم یا ابزار پخت ناقص',
        detail: 'تکمیل برچسب‌های رژیمی و ابزار آشپزی باعث نمایش بهتر در فیلترها و همکاران تجاری می‌شود.',
        weight: 10,
      });
    }

    const rawAttention = reasons.reduce((sum, r) => sum + r.weight, 0);
    const attentionScore = Math.min(50, rawAttention);
    const recipeHealth = Math.max(20, 100 - Math.min(80, rawAttention));
    totalHealthAccumulator += recipeHealth;

    // Only surface recipes that actually have at least one actionable attention reason
    if (reasons.length === 0) continue;

    // Prioritize high-demand recipes that ALSO need editorial attention
    const demandBoost = searchHits > 0 ? Math.min(12, Math.round(searchHits * 0.8)) : 0;
    const priorityScore = Math.min(100, Math.round(attentionScore * 1.15 + demandScore * 0.75 + demandBoost));

    const priorityLevel: EditorialPriorityLevel =
      priorityScore >= 72 ? 'critical' : priorityScore >= 46 ? 'high' : 'medium';

    // Pick the single sharpest 1-click recommended action
    const topReason = [...reasons].sort((a, b) => b.weight - a.weight)[0];
    let recommendedAction: EditorialRecommendedAction = 'edit_draft';
    let recommendedActionLabel = 'بازبینی و ثبت پیش‌نویس';

    if (topReason.code === 'pending_draft_review') {
      recommendedAction = 'review_draft';
      recommendedActionLabel = 'پیش‌نمایش و تایید پیش‌نویس';
    } else if (topReason.code === 'pending_community_photo') {
      recommendedAction = 'moderate_photo';
      recommendedActionLabel = 'بررسی و انتخاب تصویر اصلی';
    } else if (topReason.code === 'unsolved_questions') {
      recommendedAction = 'answer_qa';
      recommendedActionLabel = 'پاسخ‌گویی به پرسش کاربران';
    } else if (topReason.code === 'missing_cover_photo' && sig.pendingPhotosCount > 0) {
      recommendedAction = 'moderate_photo';
      recommendedActionLabel = 'انتخاب عکس از صف کاربران';
    }

    const costInfo = rec.estimatedCost || estimateRecipeCost(rec.ingredients, rec.servings);

    recommendations.push({
      recipe: rec,
      priorityScore,
      priorityLevel,
      demandScore,
      attentionScore,
      searchHits,
      bookmarksCount: sig.bookmarksCount,
      questionsCount: sig.questionsCount,
      unsolvedQuestionsCount: sig.unsolvedQuestionsCount,
      pendingPhotosCount: sig.pendingPhotosCount,
      pendingDraftsCount: sig.pendingDraftsCount,
      matchedTrends: matchedTrends.slice(0, 4),
      reasons: reasons.sort((a, b) => b.weight - a.weight),
      recommendedAction,
      recommendedActionLabel,
      costTier: costInfo.tier,
    });
  }

  recommendations.sort(
    (a, b) => b.priorityScore - a.priorityScore || b.searchHits - a.searchHits || b.attentionScore - a.attentionScore
  );

  const catalogHealthScore =
    recipes.length > 0 ? Math.round(totalHealthAccumulator / recipes.length) : 100;

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totalSearchesAnalyzed: searchLogs.length,
    uniqueTrendingQueries: trendingQueries.length,
    catalogHealthScore,
    trendingQueries: trendingQueries.slice(0, 14),
    contentGaps,
    recommendations,
  };
}
