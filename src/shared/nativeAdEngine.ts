import {canonicalizeIngredient, classifyIngredientCategory, normalizePersian} from './persianEngine.ts';
import type {
  AdHarmonyConfig,
  FlagshipPackageDuration,
  IngredientItem,
  LocalVenueMatchResult,
  LocalVenueSuggestion,
  NativeAdFormat,
  NativeAdMediaType,
  NativeAdUnit,
  Recipe,
} from './types.ts';

export const DEFAULT_AD_HARMONY: AdHarmonyConfig = {
  adsEnabled: true,
  feedEditorialBannerEnabled: true,
  feedBannerEveryNRecipes: 6,
  inlineIngredientMentionEnabled: true,
  maxInlineMentionsPerRecipe: 2,
  toolAndSubMentionEnabled: true,
  fridgeCompanionAdEnabled: true,
  shoppingCompanionAdEnabled: true,
  nearbyVenuesEnabled: true,
  flagshipSponsorEnabled: true,
  disclosureLabel: 'همکار منتخب لاقلی',
};

export interface FlagshipPackageOption {
  duration: FlagshipPackageDuration;
  label: string;
  months: number;
  recommendedPriceToman: number;
  pitch: string;
}

export const FLAGSHIP_PACKAGE_CATALOG: FlagshipPackageOption[] = [
  {
    duration: '1m',
    label: 'پکیج ۱ ماهه',
    months: 1,
    recommendedPriceToman: 45_000_000,
    pitch: 'حضور انحصاری یک‌ماهه در نوار بالای صفحه و فوتر تمام صفحات برای کمپین‌های فصلی و لانچ محصول.',
  },
  {
    duration: '3m',
    label: 'پکیج ۳ ماهه (فصلی)',
    months: 3,
    recommendedPriceToman: 120_000_000,
    pitch: 'همراهی کامل در یک فصل آشپزی با صرفه‌جویی اقتصادی و ماندگاری بالا در ذهن مخاطبان.',
  },
  {
    duration: '6m',
    label: 'پکیج ۶ ماهه (نیم‌ساله)',
    months: 6,
    recommendedPriceToman: 215_000_000,
    pitch: 'جایگاه پیوسته برند پرچمدار برای تسلط ذهنی در دو فصل متوالی و گزارش عملکرد ماهانه.',
  },
  {
    duration: '12m',
    label: 'پکیج ۱ ساله (حامی کلیدی)',
    months: 12,
    recommendedPriceToman: 390_000_000,
    pitch: 'بالاترین سطح شراکت برندینگ لاقلی در طول سال با بیشترین پوشش نمایشی و انحصار کامل.',
  },
];

export const AD_RECIPE_CATEGORIES: string[] = [
  'همه دسته‌ها',
  'خورش',
  'پلو و ته‌چین',
  'لبنیات',
  'پاستا و ماکارونی',
  'نوشیدنی',
  'ادویه و چاشنی',
  'پیش‌غذا و صبحانه',
  'غذای شمالی',
  'گیاهی و رژیمی',
  'لوازم آشپزخانه',
];

export const NATIVE_MEDIA_TYPE_LABELS: Record<NativeAdMediaType, string> = {
  text: 'متنی تحریریه‌ای',
  click: 'کلیکی با لینک ردیابی',
  banner: 'بنری هماهنگ در فید',
};

export interface InlineIngredientAdMatch {
  ingredientIndex: number;
  ingredientName: string;
  ad: NativeAdUnit;
}

export interface UserLocationHint {
  city?: string;
  neighborhood?: string;
  lat?: number | null;
  lng?: number | null;
}

function keywordMatchesText(keyword: string, normalizedTarget: string, canonicalTarget?: string): boolean {
  const kNorm = normalizePersian(keyword);
  if (kNorm.length < 2) return false;
  if (normalizedTarget.includes(kNorm) || kNorm.includes(normalizedTarget)) return true;
  if (canonicalTarget) {
    const kCanon = normalizePersian(canonicalizeIngredient(keyword));
    if (kCanon.length >= 2 && (canonicalTarget.includes(kCanon) || kCanon.includes(canonicalTarget))) {
      return true;
    }
  }
  return false;
}

/**
 * Safely validates http/https external URLs and appends clean UTM tracking parameters
 * without ever permitting javascript:, data:, or malformed schemes.
 */
export function buildTrackedAdUrl(
  targetUrl?: string | null,
  utmSource?: string | null,
  utmMedium?: string | null,
  utmCampaign?: string | null,
  fallbackMedium = 'native_ad'
): string | undefined {
  if (!targetUrl || !targetUrl.trim()) return undefined;
  try {
    const parsed = new URL(targetUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
    const source = (utmSource || 'lagheli').trim();
    const medium = (utmMedium || fallbackMedium).trim();
    const campaign = (utmCampaign || '').trim();
    if (source && !parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', source);
    }
    if (medium && !parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', medium);
    }
    if (campaign && !parsed.searchParams.has('utm_campaign')) {
      parsed.searchParams.set('utm_campaign', campaign);
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Checks whether an ad or booking falls within its active ISO date window (YYYY-MM-DD).
 * Non-ISO or empty date strings are treated as open-ended so legacy/editorial evergreen units still display.
 */
export function isAdActiveInDateWindow(
  startsAt?: string | null,
  endsAt?: string | null,
  nowDate = new Date()
): boolean {
  const todayIso = nowDate.toISOString().slice(0, 10);
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (startsAt && isoPattern.test(startsAt.trim()) && todayIso < startsAt.trim()) {
    return false;
  }
  if (endsAt && isoPattern.test(endsAt.trim()) && todayIso > endsAt.trim()) {
    return false;
  }
  return true;
}

/**
 * Pure date-range overlap check for exclusive slot reservations (ISO YYYY-MM-DD).
 */
export function checkDateRangeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
}

/**
 * Infers Persian culinary semantic buckets for a recipe so category-based ads
 * (e.g., spices on stews, dairy brands like Kalleh/Mihan on dairy dishes,
 * Zar Macaron / Bahram Sauce on pasta/sauces, Can kitchenware on stews/cookware)
 * align naturally with user intent.
 */
export function inferRecipeSemanticBuckets(recipe: Pick<Recipe, 'title' | 'subtitle' | 'category' | 'region' | 'dietTags' | 'ingredients' | 'tools'>): string[] {
  const buckets = new Set<string>();
  const combinedText = normalizePersian(
    [
      recipe.title,
      recipe.subtitle,
      recipe.category,
      recipe.region,
      ...(recipe.dietTags || []),
      ...(recipe.ingredients || []).map((i) => i.name),
      ...(recipe.tools || []),
    ].join(' ')
  );

  if (recipe.category) {
    buckets.add(normalizePersian(recipe.category));
  }

  // Stews (خورش)
  if (
    /خورش|خورشت|فسنجان|قرمه|قورمه|قیمه|بامیه|کرفس|بادمجان|مرغ ترش|آلو اسفناج/.test(combinedText)
  ) {
    buckets.add(normalizePersian('خورش'));
    buckets.add(normalizePersian('ادویه و چاشنی'));
    buckets.add(normalizePersian('لوازم آشپزخانه'));
  }

  // Rice & Tahchin (پلو و ته‌چین)
  if (/پلو|ته چین|ته‌چین|برنج|زعفران|زرشک|عدس پلو|باقالی/.test(combinedText)) {
    buckets.add(normalizePersian('پلو و ته‌چین'));
    buckets.add(normalizePersian('ادویه و چاشنی'));
  }

  // Dairy (لبنیات — e.g. Kalleh, Mihan)
  if (/ماست|شیر|خامه|کره|پنیر|کشک|دوغ|بستنی|ته‌چین|ته چین|آش|سس سفید/.test(combinedText)) {
    buckets.add(normalizePersian('لبنیات'));
  }

  // Pasta & Sauces (پاستا و ماکارونی — e.g. Zar Macaron, Bahram Sauce)
  if (/پاستا|ماکارونی|اسپاگتی|لازانیا|نودل|رشته|سس|کچاپ|مایونز|رب گوجه/.test(combinedText)) {
    buckets.add(normalizePersian('پاستا و ماکارونی'));
    buckets.add(normalizePersian('ادویه و چاشنی'));
  }

  // Drinks & Cafe (نوشیدنی)
  if (/نوشیدنی|قهوه|لاته|چای|شربت|اسموتی|شیک|دمنوش|موهیتو|کاپوچینو/.test(combinedText)) {
    buckets.add(normalizePersian('نوشیدنی'));
  }

  // Breakfast & Appetizer (پیش‌غذا و صبحانه)
  if (/صبحانه|پیش غذا|عصرانه|کوکو|میرزاقاسمی|کشک بادمجان|املت|خوراک/.test(combinedText)) {
    buckets.add(normalizePersian('پیش‌غذا و صبحانه'));
  }

  // Northern Persian
  if (/گیلان|شمال|مازندران|رشت|میرزاقاسمی|فسنجان|باقالی قاتوق|ترش تره/.test(combinedText)) {
    buckets.add(normalizePersian('غذای شمالی'));
  }

  // Vegan / Healthy
  if (/وگان|گیاهی|رژیمی|سبک|بدون گلوتن/.test(combinedText)) {
    buckets.add(normalizePersian('گیاهی و رژیمی'));
  }

  // Kitchenware
  if ((recipe.tools || []).length > 0 || /قابلمه|تابه|ماهیتابه|فر|چدن|زودپز|هود|اجاق/.test(combinedText)) {
    buckets.add(normalizePersian('لوازم آشپزخانه'));
  }

  return Array.from(buckets);
}

function sortActiveAds(ads: NativeAdUnit[], format?: NativeAdFormat): NativeAdUnit[] {
  return ads
    .filter(
      (a) =>
        a.status === 'active' &&
        (!format || a.format === format) &&
        isAdActiveInDateWindow(a.startsAt, a.endsAt)
    )
    .sort((a, b) => {
      const bidDiff = (b.bidAmountToman || 0) - (a.bidAmountToman || 0);
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return bidDiff;
    });
}

function scoreAdForCategories(ad: NativeAdUnit, targetBuckets: string[], activeFilterTerms: string[] = []): number {
  const adCats = (ad.recipeCategories || []).map((c) => normalizePersian(c)).filter(Boolean);
  const isWildcard = adCats.length === 0 || adCats.includes(normalizePersian('همه دسته‌ها'));

  let score = 0;

  // Strong boost if ad directly targets the active filter the user clicked
  for (const term of activeFilterTerms) {
    const normTerm = normalizePersian(term);
    if (!normTerm || normTerm === normalizePersian('همه')) continue;
    if (adCats.some((c) => c.includes(normTerm) || normTerm.includes(c))) {
      score += 40;
    }
    if (ad.matchKeywords.some((kw) => keywordMatchesText(kw, normTerm))) {
      score += 25;
    }
  }

  // Semantic bucket overlap with visible recipes
  for (const bucket of targetBuckets) {
    if (adCats.some((c) => c.includes(bucket) || bucket.includes(c))) {
      score += 18;
    }
    if (ad.matchKeywords.some((kw) => keywordMatchesText(kw, bucket))) {
      score += 10;
    }
  }

  if (isWildcard && score === 0) {
    score += 5;
  }

  return score + (ad.priority || 0);
}

/**
 * Smart Category-Aware Multi-Format Feed Ad Selector (Textual, Clickable/UTM & Banner).
 * Enforces strict frequency capping (never fewer than 3 recipes apart, capped cleanly)
 * and aligns each inserted ad with the surrounding recipe categories so users never feel spammed.
 */
export function selectSmartFeedNativeAds(
  recipes: Recipe[],
  ads: NativeAdUnit[],
  activeCategoryTerms: string[] = [],
  harmony: AdHarmonyConfig = DEFAULT_AD_HARMONY
): Map<number, NativeAdUnit> {
  const slotMap = new Map<number, NativeAdUnit>();
  if (!harmony.adsEnabled || !harmony.feedEditorialBannerEnabled || recipes.length < 3) {
    return slotMap;
  }

  const eligible = sortActiveAds(ads, 'feed_editorial_story');
  if (eligible.length === 0) return slotMap;

  const step = Math.max(3, Math.min(12, Math.round(harmony.feedBannerEveryNRecipes || 6)));
  const maxFeedAds = Math.min(4, Math.max(1, Math.floor(recipes.length / step)));
  const usedAdIds = new Set<string>();
  const usedPartners = new Set<string>();

  let inserted = 0;
  for (let pos = step - 1; pos < recipes.length && inserted < maxFeedAds; pos += step) {
    // Inspect the local window of recipes immediately preceding this feed slot
    const windowRecipes = recipes.slice(Math.max(0, pos - step + 1), pos + 1);
    const localBuckets = Array.from(new Set(windowRecipes.flatMap((r) => inferRecipeSemanticBuckets(r))));

    const ranked = eligible
      .filter((ad) => !usedAdIds.has(ad.id) && !usedPartners.has(ad.partnerId))
      .map((ad) => ({
        ad,
        score: scoreAdForCategories(ad, localBuckets, activeCategoryTerms),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0]?.ad;
    if (!best) break;

    slotMap.set(pos, best);
    usedAdIds.add(best.id);
    usedPartners.add(best.partnerId);
    inserted += 1;
  }

  return slotMap;
}

/**
 * Legacy-compatible wrapper for simple recipe-count feed mapping.
 */
export function selectFeedEditorialStoryMap(
  recipesCount: number,
  ads: NativeAdUnit[],
  harmony: AdHarmonyConfig = DEFAULT_AD_HARMONY
): Map<number, NativeAdUnit> {
  const slotMap = new Map<number, NativeAdUnit>();
  if (!harmony.adsEnabled || !harmony.feedEditorialBannerEnabled || recipesCount < 3) {
    return slotMap;
  }

  const eligible = sortActiveAds(ads, 'feed_editorial_story');
  if (eligible.length === 0) return slotMap;

  const step = Math.max(3, Math.min(12, Math.round(harmony.feedBannerEveryNRecipes || 6)));
  let adIdx = 0;

  for (let pos = step - 1; pos < recipesCount && adIdx < eligible.length; pos += step) {
    slotMap.set(pos, eligible[adIdx]);
    adIdx += 1;
  }

  return slotMap;
}

/**
 * Matches subtle 1-line native brand mentions (textual or clickable/UTM) directly to recipe ingredients
 * & recipe semantic categories while strictly enforcing frequency cap and partner deduplication.
 */
export function matchInlineIngredientAds(
  ingredients: IngredientItem[],
  ads: NativeAdUnit[],
  harmony: AdHarmonyConfig = DEFAULT_AD_HARMONY,
  recipeContext?: Pick<Recipe, 'title' | 'subtitle' | 'category' | 'region' | 'dietTags' | 'ingredients' | 'tools'>
): InlineIngredientAdMatch[] {
  if (!harmony.adsEnabled || !harmony.inlineIngredientMentionEnabled || harmony.maxInlineMentionsPerRecipe <= 0) {
    return [];
  }

  const eligible = sortActiveAds(ads, 'inline_ingredient');
  if (eligible.length === 0) return [];

  const recipeBuckets = recipeContext ? inferRecipeSemanticBuckets(recipeContext) : [];
  const matches: InlineIngredientAdMatch[] = [];
  const usedPartners = new Set<string>();
  const usedAdIds = new Set<string>();

  for (let idx = 0; idx < ingredients.length; idx++) {
    if (matches.length >= harmony.maxInlineMentionsPerRecipe) break;
    const ing = ingredients[idx];
    const ingNorm = normalizePersian(ing.name);
    const ingCanon = normalizePersian(canonicalizeIngredient(ing.name));
    const ingCategory = ing.category || classifyIngredientCategory(ing.name);

    const candidates = eligible
      .filter((ad) => !usedAdIds.has(ad.id) && !usedPartners.has(ad.partnerId))
      .map((ad) => {
        let score = 0;
        const kwHit = ad.matchKeywords.some((kw) => keywordMatchesText(kw, ingNorm, ingCanon));
        if (kwHit) score += 35;

        const ingCatHit = ad.matchCategories.includes(ingCategory);
        if (ingCatHit) score += 16;

        if (recipeBuckets.length > 0 && ad.recipeCategories && ad.recipeCategories.length > 0) {
          const catOverlap = ad.recipeCategories.some((rc) => {
            const rcNorm = normalizePersian(rc);
            return (
              rcNorm === normalizePersian('همه دسته‌ها') ||
              recipeBuckets.some((b) => b.includes(rcNorm) || rcNorm.includes(b))
            );
          });
          if (catOverlap && (kwHit || ingCatHit)) {
            score += 15;
          }
        }

        if (score === 0) return null;
        return {ad, score: score + (ad.priority || 0)};
      })
      .filter((x): x is {ad: NativeAdUnit; score: number} => x !== null)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0]?.ad;
    if (best) {
      usedAdIds.add(best.id);
      usedPartners.add(best.partnerId);
      matches.push({
        ingredientIndex: idx,
        ingredientName: ing.name,
        ad: best,
      });
    }
  }

  return matches;
}

/**
 * Finds at most ONE calm contextual brand recommendation for recipe tools, cookware,
 * category sponsorship (e.g. Can kitchenware on stews), or ingredient substitutions.
 */
export function matchContextualToolOrSubAd(
  terms: string[],
  ads: NativeAdUnit[],
  harmony: AdHarmonyConfig = DEFAULT_AD_HARMONY,
  recipeContext?: Pick<Recipe, 'title' | 'subtitle' | 'category' | 'region' | 'dietTags' | 'ingredients' | 'tools'>
): NativeAdUnit | null {
  if (!harmony.adsEnabled || !harmony.toolAndSubMentionEnabled) return null;
  const eligible = sortActiveAds(ads, 'contextual_tool');
  if (eligible.length === 0) return null;

  const recipeBuckets = recipeContext ? inferRecipeSemanticBuckets(recipeContext) : [];
  const normalizedTerms = terms
    .map((t) => ({norm: normalizePersian(t), canon: normalizePersian(canonicalizeIngredient(t))}))
    .filter((t) => t.norm.length >= 2);

  let bestAd: NativeAdUnit | null = null;
  let bestScore = 0;

  for (const ad of eligible) {
    let score = 0;
    const kwMatched = normalizedTerms.some((term) =>
      ad.matchKeywords.some((kw) => keywordMatchesText(kw, term.norm, term.canon))
    );
    if (kwMatched) score += 30;

    if (recipeBuckets.length > 0 && ad.recipeCategories && ad.recipeCategories.length > 0) {
      const catHit = ad.recipeCategories.some((rc) => {
        const rcNorm = normalizePersian(rc);
        return recipeBuckets.some((b) => b.includes(rcNorm) || rcNorm.includes(b));
      });
      if (catHit) score += 25;
    }

    if (score > 0) {
      const total = score + (ad.priority || 0);
      if (total > bestScore) {
        bestScore = total;
        bestAd = ad;
      }
    }
  }

  if (bestAd) return bestAd;
  return eligible.find((ad) => ad.matchKeywords.length === 0) || null;
}

/**
 * Finds at most ONE calm companion recommendation for Smart Fridge or Shopping List
 * matched against the actual ingredients/categories the user has selected.
 */
export function matchPantryCompanionAd(
  itemNames: string[],
  ads: NativeAdUnit[],
  surface: 'fridge' | 'shopping',
  harmony: AdHarmonyConfig = DEFAULT_AD_HARMONY
): NativeAdUnit | null {
  if (!harmony.adsEnabled) return null;
  if (surface === 'fridge' && !harmony.fridgeCompanionAdEnabled) return null;
  if (surface === 'shopping' && !harmony.shoppingCompanionAdEnabled) return null;

  const eligible = sortActiveAds(ads, 'pantry_companion');
  if (eligible.length === 0) return null;

  const normalizedItems = itemNames
    .map((n) => ({
      norm: normalizePersian(n),
      canon: normalizePersian(canonicalizeIngredient(n)),
      cat: classifyIngredientCategory(n),
    }))
    .filter((n) => n.norm.length >= 2);

  for (const ad of eligible) {
    const hit = normalizedItems.some(
      (item) =>
        ad.matchKeywords.some((kw) => keywordMatchesText(kw, item.norm, item.canon)) ||
        ad.matchCategories.includes(item.cat)
    );
    if (hit) return ad;
  }

  return eligible[0] || null;
}

/**
 * Haversine distance in kilometers between two GPS coordinates.
 */
export function computeDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Matches verified nearby restaurants, cafes, and fast-foods serving the selected recipe or drink
 * when the user doesn't feel like cooking ("حوصله پختش رو نداری؟").
 * Combines manual City & Neighborhood matching with optional browser GPS coordinates.
 */
export function matchNearbyVenuesForRecipe(
  recipe: Pick<Recipe, 'title' | 'subtitle' | 'category' | 'region' | 'dietTags' | 'ingredients' | 'tools'>,
  venues: LocalVenueSuggestion[],
  location: UserLocationHint = {},
  maxResults = 3
): LocalVenueMatchResult[] {
  const activeVenues = venues.filter((v) => v.status === 'active');
  if (activeVenues.length === 0) return [];

  const titleNorm = normalizePersian(recipe.title);
  const titleWords = titleNorm.split(/\s+/).filter((w) => w.length >= 3);
  const recipeBuckets = inferRecipeSemanticBuckets(recipe);
  const userCity = normalizePersian(location.city || '');
  const userNeighborhood = normalizePersian(location.neighborhood || '');
  const hasGps =
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng);

  const scored: LocalVenueMatchResult[] = [];

  for (const venue of activeVenues) {
    let dishScore = 0;
    let matchedDishLabel = '';

    for (const dish of venue.servedDishes) {
      const dishNorm = normalizePersian(dish);
      if (!dishNorm) continue;
      if (titleNorm.includes(dishNorm) || dishNorm.includes(titleNorm)) {
        dishScore = Math.max(dishScore, 55);
        matchedDishLabel = dish;
      } else if (titleWords.some((w) => dishNorm.includes(w) || w.includes(dishNorm))) {
        if (dishScore < 38) {
          dishScore = 38;
          matchedDishLabel = dish;
        }
      }
    }

    if (dishScore === 0) {
      const catHit = venue.servedCategories.find((vc) => {
        const vcNorm = normalizePersian(vc);
        return recipeBuckets.some((b) => b.includes(vcNorm) || vcNorm.includes(b));
      });
      if (catHit) {
        dishScore = 24;
        matchedDishLabel = `منوی ${catHit}`;
      }
    }

    if (dishScore === 0) continue;

    let locationScore = 0;
    let distanceKm: number | null = null;
    const venueCity = normalizePersian(venue.city);
    const venueNeighborhood = normalizePersian(venue.neighborhood);

    if (userCity && venueCity === userCity) {
      locationScore += 22;
    } else if (userCity && venueCity !== userCity) {
      locationScore -= 12;
    }

    if (userNeighborhood && venueNeighborhood && (venueNeighborhood.includes(userNeighborhood) || userNeighborhood.includes(venueNeighborhood))) {
      locationScore += 18;
    }

    if (hasGps && Number.isFinite(venue.lat) && Number.isFinite(venue.lng) && venue.lat !== 0 && venue.lng !== 0) {
      distanceKm = computeDistanceKm(location.lat!, location.lng!, venue.lat, venue.lng);
      if (distanceKm <= 3) locationScore += 28;
      else if (distanceKm <= 8) locationScore += 18;
      else if (distanceKm <= 20) locationScore += 8;
    }

    const totalScore = dishScore + locationScore + (venue.isFeatured ? 6 : 0);
    if (totalScore < 20) continue;

    const matchReason =
      distanceKm !== null
        ? `در فاصله تقریبی ${distanceKm} کیلومتری شما`
        : userNeighborhood && venueNeighborhood.includes(userNeighborhood)
          ? `در محله ${venue.neighborhood}`
          : `${venue.city} · ${venue.neighborhood}`;

    scored.push({
      venue,
      matchScore: totalScore,
      distanceKm,
      matchedDishLabel: matchedDishLabel || recipe.title,
      matchReason,
    });
  }

  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, maxResults);
}
