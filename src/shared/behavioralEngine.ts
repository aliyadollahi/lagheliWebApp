import {normalizePersian} from './persianEngine.ts';
import type {
  DietaryTagId,
  FlagshipSponsorship,
  LocalVenueSuggestion,
  NativeAdUnit,
  UserDietaryPreferences,
} from './types.ts';

export const DEFAULT_USER_DIETARY_PREFERENCES: UserDietaryPreferences = {
  diets: [],
  excludedIngredients: [],
  preferredMealTimes: ['ناهار', 'شام'],
  cookingFrequency: 'weekly',
  strictAdFiltering: true,
};

export interface DietaryOptionMeta {
  id: DietaryTagId;
  label: string;
  shortNote: string;
  blockedTerms: string[];
  blockedCategories: string[];
}

export const DIETARY_OPTIONS: DietaryOptionMeta[] = [
  {
    id: 'vegan',
    label: 'وگان (کاملاً گیاهی)',
    shortNote: 'مسدودسازی قطعی تمام تبلیغات گوشت، مرغ، ماهی، سوسیس و لبنیات',
    blockedTerms: [
      'گوشت',
      'مرغ',
      'ماهی',
      'میگو',
      'سوسیس',
      'کالباس',
      'ژامبون',
      'برگر',
      'همبرگر',
      'کباب',
      'جوجه',
      'استیک',
      'چرخ کرده',
      'چرخ‌کرده',
      'تخم مرغ',
      'تخم‌مرغ',
      'ماست',
      'شیر',
      'کره',
      'خامه',
      'پنیر',
      'کشک',
      'دوغ',
      'بستنی',
      'عسل',
      'لبنی',
      'لبنیات',
      'کاله',
      'میهن',
      'حیوانی',
    ],
    blockedCategories: ['لبنیات', 'پروتئین و تخم‌مرغ'],
  },
  {
    id: 'vegetarian',
    label: 'گیاه‌خوار',
    shortNote: 'مسدودسازی قطعی تبلیغات گوشت قرمز، مرغ، ماهی، سوسیس و کالباس',
    blockedTerms: [
      'گوشت',
      'مرغ',
      'ماهی',
      'میگو',
      'سوسیس',
      'کالباس',
      'ژامبون',
      'برگر',
      'همبرگر',
      'کباب',
      'جوجه',
      'استیک',
      'چرخ کرده',
      'چرخ‌کرده',
      'ناگت',
      'هات داگ',
      'هات‌داگ',
    ],
    blockedCategories: [],
  },
  {
    id: 'no_processed_meat',
    label: 'بدون سوسیس، کالباس و فست‌فود گوشتی',
    shortNote: 'حذف کامل فرآورده‌های گوشتی و فست‌فودهای سنگین از تبلیغات',
    blockedTerms: [
      'سوسیس',
      'کالباس',
      'ژامبون',
      'هات داگ',
      'هات‌داگ',
      'ناگت',
      'پپرونی',
      'بیکن',
      'فست فود',
      'فست‌فود',
      'برگر',
    ],
    blockedCategories: [],
  },
  {
    id: 'no_red_meat',
    label: 'بدون گوشت قرمز',
    shortNote: 'حذف تبلیغات گوشت گوساله، گوسفندی، کباب و استیک',
    blockedTerms: ['گوشت قرمز', 'گوساله', 'گوسفند', 'استیک', 'کوبیده', 'برگ', 'چنجه', 'چرخ کرده', 'چرخ‌کرده', 'کباب'],
    blockedCategories: [],
  },
  {
    id: 'dairy_free',
    label: 'بدون لبنیات (حساسیت لاکتوز)',
    shortNote: 'مسدودسازی قطعی تبلیغات شیر، ماست، کره، خامه، پنیر و بستنی',
    blockedTerms: [
      'لبنی',
      'لبنیات',
      'ماست',
      'شیر',
      'کره',
      'خامه',
      'پنیر',
      'کشک',
      'دوغ',
      'بستنی',
      'کاله',
      'میهن',
      'پگاه',
      'رامک',
    ],
    blockedCategories: ['لبنیات'],
  },
  {
    id: 'gluten_free',
    label: 'بدون گلوتن',
    shortNote: 'مسدودسازی تبلیغات ماکارونی، پاستا، نان و آرد گندم',
    blockedTerms: ['ماکارونی', 'پاستا', 'اسپاگتی', 'لازانیا', 'رشته', 'نودل', 'آرد گندم', 'نان', 'زر ماکارون', 'گلوتن'],
    blockedCategories: ['پاستا و ماکارونی'],
  },
  {
    id: 'nut_free',
    label: 'بدون مغزها (حساسیت آجیل)',
    shortNote: 'حذف تبلیغات و پیشنهادهای حاوی گردو، بادام، پسته و بادام‌زمینی',
    blockedTerms: ['گردو', 'پسته', 'بادام', 'فندق', 'آجیل', 'مغز', 'فسنجان'],
    blockedCategories: ['خشکبار و مغزها'],
  },
  {
    id: 'low_carb',
    label: 'کم‌کربوهیدرات و کتو',
    shortNote: 'مسدودسازی تبلیغات پاستا، ماکارونی، برنج و شیرینی‌های پرقند',
    blockedTerms: ['ماکارونی', 'پاستا', 'اسپاگتی', 'لازانیا', 'شکر', 'شیرینی', 'کیک', 'بستنی', 'زر ماکارون'],
    blockedCategories: ['پاستا و ماکارونی'],
  },
  {
    id: 'no_sugar',
    label: 'بدون شکر و قند افزوده',
    shortNote: 'حذف تبلیغات نوشیدنی‌های شیرین، دسرهای قندی و بستنی',
    blockedTerms: ['شکر', 'قند', 'شیرینی', 'بستنی', 'شربت', 'نوشابه', 'دسر شیرین', 'کیک'],
    blockedCategories: [],
  },
];

const DIETARY_MAP = new Map<DietaryTagId, DietaryOptionMeta>(DIETARY_OPTIONS.map((o) => [o.id, o]));

function textContainsAnyTerm(normalizedHaystack: string, rawTerms: string[]): string | null {
  for (const term of rawTerms) {
    const normTerm = normalizePersian(term);
    if (normTerm.length >= 2 && normalizedHaystack.includes(normTerm)) {
      return term;
    }
  }
  return null;
}

/**
 * Hard-blocks any NativeAdUnit that conflicts with the user's declared dietary profile
 * or custom excluded ingredients (e.g., vegan users strictly NEVER see sausage, meat, or dairy ads).
 */
export function isAdCompatibleWithUserDiet(
  ad: Pick<NativeAdUnit, 'title' | 'subtitle' | 'editorialCopy' | 'partnerName' | 'recipeCategories' | 'matchKeywords' | 'matchCategories'>,
  prefs?: UserDietaryPreferences | null
): {allowed: boolean; blockedReason?: string} {
  if (!prefs || (prefs.diets.length === 0 && prefs.excludedIngredients.length === 0)) {
    return {allowed: true};
  }

  const combinedText = normalizePersian(
    [
      ad.title,
      ad.subtitle,
      ad.editorialCopy,
      ad.partnerName,
      ...(ad.recipeCategories || []),
      ...(ad.matchKeywords || []),
      ...(ad.matchCategories || []),
    ].join(' ')
  );

  const normalizedAdCats = new Set(
    [...(ad.recipeCategories || []), ...(ad.matchCategories || [])].map((c) => normalizePersian(c))
  );

  for (const dietId of prefs.diets) {
    const meta = DIETARY_MAP.get(dietId);
    if (!meta) continue;

    for (const blockedCat of meta.blockedCategories) {
      if (normalizedAdCats.has(normalizePersian(blockedCat))) {
        return {allowed: false, blockedReason: `ناسازگار با رژیم ${meta.label}`};
      }
    }

    const matchedTerm = textContainsAnyTerm(combinedText, meta.blockedTerms);
    if (matchedTerm) {
      return {allowed: false, blockedReason: `ناسازگار با رژیم ${meta.label} (${matchedTerm})`};
    }
  }

  if (prefs.excludedIngredients.length > 0) {
    const customHit = textContainsAnyTerm(combinedText, prefs.excludedIngredients);
    if (customHit) {
      return {allowed: false, blockedReason: `شامل ماده حذف‌شده (${customHit})`};
    }
  }

  return {allowed: true};
}

export function filterAdsForUserDiet(
  ads: NativeAdUnit[],
  prefs?: UserDietaryPreferences | null
): {safeAds: NativeAdUnit[]; blockedCount: number} {
  if (!prefs || (prefs.diets.length === 0 && prefs.excludedIngredients.length === 0)) {
    return {safeAds: ads, blockedCount: 0};
  }
  const safeAds: NativeAdUnit[] = [];
  let blockedCount = 0;
  for (const ad of ads) {
    if (isAdCompatibleWithUserDiet(ad, prefs).allowed) {
      safeAds.push(ad);
    } else {
      blockedCount += 1;
    }
  }
  return {safeAds, blockedCount};
}

/**
 * Ensures nearby restaurant/cafe/fastfood suggestions also respect strict user diets
 * (e.g., vegan or no-processed-meat users will not be shown sausage/burger-only fast-foods).
 */
export function filterVenuesForUserDiet(
  venues: LocalVenueSuggestion[],
  prefs?: UserDietaryPreferences | null
): LocalVenueSuggestion[] {
  if (!prefs || (prefs.diets.length === 0 && prefs.excludedIngredients.length === 0)) {
    return venues;
  }

  const wantsPlantBased = prefs.diets.includes('vegan') || prefs.diets.includes('vegetarian');
  const blocksFastFoodMeat = prefs.diets.includes('no_processed_meat') || wantsPlantBased;

  return venues.filter((venue) => {
    const combined = normalizePersian(
      [venue.name, venue.deliveryNote, ...(venue.servedDishes || []), ...(venue.servedCategories || [])].join(' ')
    );

    if (blocksFastFoodMeat && venue.venueType === 'fastfood') {
      // Allow fastfood only if it explicitly highlights vegan/vegetarian dishes
      if (!/وگان|گیاهی|فلافل|سالاد/.test(combined)) {
        return false;
      }
    }

    if (wantsPlantBased) {
      const hasPlantSignal = /وگان|گیاهی|میرزاقاسمی|کشک بادمجان|نوشیدنی|قهوه|چای|دمنوش|اسموتی|سالاد/.test(combined);
      const isMeatHeavy = /کباب|جوجه|چلوکباب|سوسیس|کالباس|برگر|استیک|قیمه|قورمه/.test(combined);
      if (isMeatHeavy && !hasPlantSignal) {
        return false;
      }
    }

    if (prefs.excludedIngredients.length > 0) {
      const customHit = textContainsAnyTerm(combined, prefs.excludedIngredients);
      if (customHit) return false;
    }

    return true;
  });
}

export function isFlagshipCompatibleWithUserDiet(
  sponsorship: FlagshipSponsorship | null,
  prefs?: UserDietaryPreferences | null
): boolean {
  if (!sponsorship || !prefs || (prefs.diets.length === 0 && prefs.excludedIngredients.length === 0)) {
    return true;
  }
  const check = isAdCompatibleWithUserDiet(
    {
      title: sponsorship.tagline,
      subtitle: sponsorship.ctaLabel,
      editorialCopy: '',
      partnerName: sponsorship.partnerName,
      recipeCategories: [],
      matchKeywords: [],
      matchCategories: [],
    },
    prefs
  );
  return check.allowed;
}

/**
 * Gently boosts priority of diet-safe ads that align with the user's passively viewed categories
 * without breaking frequency caps or visual harmony.
 */
export function personalizeSafeAdsByAffinity(
  safeAds: NativeAdUnit[],
  passiveCategories: string[] = []
): NativeAdUnit[] {
  if (passiveCategories.length === 0) return safeAds;
  const normAffinity = new Set(passiveCategories.map((c) => normalizePersian(c)).filter(Boolean));
  return safeAds.map((ad) => {
    const matchesAffinity = (ad.recipeCategories || []).some((cat) => normAffinity.has(normalizePersian(cat)));
    if (!matchesAffinity) return ad;
    return {
      ...ad,
      priority: (ad.priority || 5) + 4,
    };
  });
}

export const SECTION_LABELS_FA: Record<string, string> = {
  explore: 'صفحه کاوش و فید دستورپخت‌ها',
  recipe_detail: 'صفحه جزئیات دستورپخت و مواد اولیه',
  cooking_mode: 'حالت آشپزی گام‌به‌گام و تایمر',
  kitchen: 'آشپزخانه هوشمند (یخچال و جایگزین)',
  shopping: 'لیست خرید هوشمند',
  marketplace: 'ویترین برندهای همکار',
  nearby_venues: 'پیشنهاد رستوران و کافه اطراف',
  profile: 'نمایه کاربری و تنظیمات رژیم',
};
