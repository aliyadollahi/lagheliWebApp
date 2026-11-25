import type {
  IngredientItem,
  PartnerRoleId,
  RecipeEstimatedCost,
  ShoppingCategory,
  SubstitutionSuggestion,
} from './types.ts';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function toEnDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatToman(amount: number): string {
  const formatted = Math.round(amount).toLocaleString('en-US').replace(/,/g, '٬');
  return `${toFaDigits(formatted)} تومان`;
}

export function formatQuantity(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) {
    return toFaDigits(rounded);
  }
  return toFaDigits(String(rounded).replace('.', '٫'));
}

export function normalizePersian(input: string): string {
  return toEnDigits(input)
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

export function validateIranMobile(raw: string): {valid: boolean; normalized: string; error?: string} {
  const digits = toEnDigits(raw).replace(/[\s\-()]/g, '');
  let normalized = digits;
  if (normalized.startsWith('+98')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('98') && normalized.length === 12) {
    normalized = '0' + normalized.slice(2);
  }
  if (!/^09\d{9}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'شماره موبایل معتبر نیست؛ لطفاً با فرمت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.',
    };
  }
  return {valid: true, normalized};
}

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  'سبزیجات و صیفی‌جات',
  'میوه و دانه‌ها',
  'لبنیات',
  'پروتئین و تخم‌مرغ',
  'ادویه و معطرها',
  'چاشنی و رب‌ها',
  'غلات و آرد',
  'حبوبات',
  'خشکبار و مغزها',
  'روغن و چربی‌ها',
  'سایر مواد',
];

export const PARTNER_ROLES: {id: PartnerRoleId; label: string; shortLabel: string}[] = [
  {id: 'food_brands', label: 'برندهای مواد غذایی', shortLabel: 'برند غذایی'},
  {id: 'kitchen_equipment', label: 'تجهیزات خانه و آشپزخانه', shortLabel: 'تجهیزات آشپزخانه'},
  {id: 'stores_supermarkets', label: 'فروشگاه‌ها و سوپرمارکت‌ها', shortLabel: 'فروشگاه'},
  {id: 'restaurants_kitchens', label: 'رستوران‌ها و مطبخ‌ها', shortLabel: 'رستوران و مطبخ'},
  {id: 'cafes_bakeries', label: 'کافه‌ها و شیرینی‌سراها', shortLabel: 'کافه و شیرینی'},
  {id: 'chefs_nutritionists', label: 'سرآشپزها و مشاوران تغذیه', shortLabel: 'سرآشپز و تغذیه'},
  {id: 'culinary_schools', label: 'آموزشگاه‌های آشپزی', shortLabel: 'آموزشگاه'},
  {id: 'local_artisans', label: 'تولیدکنندگان بومی و مشاغل خانگی', shortLabel: 'تولید بومی'},
  {id: 'catering_events', label: 'کیترینگ و تشریفات', shortLabel: 'کیترینگ'},
  {id: 'instant_delivery', label: 'پیک و سرویس‌های ارسال فوری', shortLabel: 'ارسال فوری'},
];

export const PARTNER_ROLE_LABELS: Record<PartnerRoleId, string> = PARTNER_ROLES.reduce(
  (acc, item) => {
    acc[item.id] = item.label;
    return acc;
  },
  {} as Record<PartnerRoleId, string>
);

export const PANTRY_STAPLES = [
  'نمک',
  'فلفل سیاه',
  'فلفل',
  'زردچوبه',
  'آب',
  'روغن',
  'روغن مایع',
  'روغن زیتون',
];

const CANONICAL_MAP: Record<string, string> = {
  'گوجه فرنگی': 'گوجه',
  'گوجه‌فرنگی': 'گوجه',
  'گوجه گیلاسی': 'گوجه',
  'پیاز زرد': 'پیاز',
  'پیاز سفید': 'پیاز',
  'پیاز قرمز': 'پیاز',
  'حبه سیر': 'سیر',
  'سیر تازه': 'سیر',
  'مرغ': 'سینه مرغ',
  'فیله مرغ': 'سینه مرغ',
  'ران مرغ': 'مرغ',
  'برنج ایرانی': 'برنج',
  'برنج هاشمی': 'برنج',
  'برنج طارم': 'برنج',
  'ماست چکیده': 'ماست',
  'ماست یونانی': 'ماست',
  'روغن مایع': 'روغن',
  'روغن گیاهی': 'روغن',
  'رب انار ملس': 'رب انار',
  'زعفران دم کرده': 'زعفران',
  'زعفران دم‌کرده': 'زعفران',
  'بادمجان قلمی': 'بادمجان',
  'سبزی آش': 'سبزی آش',
  'شوید تازه': 'شوید',
  'باقالی سبز': 'باقالی',
  'گردو آسیاب شده': 'مغز گردو',
  'گردو': 'مغز گردو',
};

export function canonicalizeIngredient(name: string): string {
  const norm = normalizePersian(name);
  for (const [alias, canonical] of Object.entries(CANONICAL_MAP)) {
    if (norm === normalizePersian(alias)) {
      return canonical;
    }
  }
  return name.trim();
}

export function classifyIngredientCategory(name: string): ShoppingCategory {
  const n = normalizePersian(name);
  if (/(پیاز|سیر|گوجه|بادمجان|سبزی|شوید|جعفری|گشنیز|تره|نعنا|اسفناج|سیب زمینی|هویج|فلفل دلمه|کدو|خیار|کاهو|کرفس)/.test(n)) {
    return 'سبزیجات و صیفی‌جات';
  }
  if (/(زرشک|انار|لیمو|نارنج|آلو|سیب|پرتقال|توت|انجیر|خرما|کشمش)/.test(n)) {
    return 'میوه و دانه‌ها';
  }
  if (/(ماست|کشک|شیر|خامه|پنیر|کره|دوغ)/.test(n)) {
    return 'لبنیات';
  }
  if (/(مرغ|گوشت|ماهیچه|تخم مرغ|ماهی|میگو|بوقلمون|بلدرچین|کالباس)/.test(n)) {
    return 'پروتئین و تخم‌مرغ';
  }
  if (/(زعفران|زردچوبه|فلفل|نمک|دارچین|هل|زیره|سماق|گلپر|ادویه|آویشن|پاپریکا|گلاب)/.test(n)) {
    return 'ادویه و معطرها';
  }
  if (/(رب|سس|سرکه|آبلیمو|آبغوره|شکر|عسل|شیره)/.test(n)) {
    return 'چاشنی و رب‌ها';
  }
  if (/(برنج|آرد|رشته|نان|جو|گندم|پاستا|ماکارونی|سمولینا)/.test(n)) {
    return 'غلات و آرد';
  }
  if (/(نخود|لوبیا|عدس|لپه|باقالی|ماش|سویا)/.test(n)) {
    return 'حبوبات';
  }
  if (/(گردو|پسته|بادام|فندق|کنجد|تخمه|خلال)/.test(n)) {
    return 'خشکبار و مغزها';
  }
  if (/(روغن|دنبه)/.test(n)) {
    return 'روغن و چربی‌ها';
  }
  return 'سایر مواد';
}

interface IngredientPriceRule {
  pattern: RegExp;
  /** میانگین قیمت هر کیلوگرم/لیتر به تومان */
  pricePerKg: number;
  /** میانگین قیمت هر عدد/واحد استاندارد (در صورت استفاده از واحد عددی) */
  pricePerPiece?: number;
}

const INGREDIENT_PRICE_RULES: IngredientPriceRule[] = [
  {pattern: /(ماهیچه|گوسفندی|بره|راسته|فیله گوساله)/, pricePerKg: 860000, pricePerPiece: 290000},
  {pattern: /(گوشت|چرخ کرده|چرخ‌کرده|گوساله)/, pricePerKg: 690000, pricePerPiece: 160000},
  {pattern: /(میگو|سالمون|ماهی)/, pricePerKg: 590000, pricePerPiece: 180000},
  {pattern: /(زعفران)/, pricePerKg: 95000000, pricePerPiece: 38000},
  {pattern: /(پسته|بادام|خلال|فندق)/, pricePerKg: 880000, pricePerPiece: 45000},
  {pattern: /(گردو)/, pricePerKg: 740000, pricePerPiece: 12000},
  {pattern: /(روغن زیتون)/, pricePerKg: 540000, pricePerPiece: 18000},
  {pattern: /(کره)/, pricePerKg: 380000, pricePerPiece: 22000},
  {pattern: /(زرشک|کشمش)/, pricePerKg: 310000, pricePerPiece: 18000},
  {pattern: /(رب انار)/, pricePerKg: 280000, pricePerPiece: 14000},
  {pattern: /(مرغ|بوقلمون|بلدرچین)/, pricePerKg: 175000, pricePerPiece: 55000},
  {pattern: /(کشک|پنیر|خامه)/, pricePerKg: 190000, pricePerPiece: 24000},
  {pattern: /(ماست|شیر|دوغ)/, pricePerKg: 110000, pricePerPiece: 18000},
  {pattern: /(برنج)/, pricePerKg: 155000, pricePerPiece: 26000},
  {pattern: /(قارچ)/, pricePerKg: 155000, pricePerPiece: 8000},
  {pattern: /(تخم مرغ|تخم‌مرغ)/, pricePerKg: 135000, pricePerPiece: 7500},
  {pattern: /(نخود|لوبیا|عدس|لپه|باقالی|ماش)/, pricePerKg: 140000, pricePerPiece: 22000},
  {pattern: /(رب گوجه|رب)/, pricePerKg: 98000, pricePerPiece: 6000},
  {pattern: /(رشته|آرد|نان|پاستا|ماکارونی)/, pricePerKg: 75000, pricePerPiece: 12000},
  {pattern: /(سبزی|شوید|جعفری|گشنیز|تره|نعنا|اسفناج|کرفس)/, pricePerKg: 68000, pricePerPiece: 18000},
  {pattern: /(سیر)/, pricePerKg: 130000, pricePerPiece: 3500},
  {pattern: /(پیاز|گوجه|بادمجان|سیب زمینی|هویج|کدو|خیار|فلفل دلمه)/, pricePerKg: 36000, pricePerPiece: 6000},
  {pattern: /(روغن)/, pricePerKg: 120000, pricePerPiece: 5000},
  {pattern: /(نمک|فلفل|زردچوبه|دارچین|هل|زیره|سماق|گلپر|ادویه|آویشن|پاپریکا)/, pricePerKg: 420000, pricePerPiece: 4000},
];

const CATEGORY_FALLBACK_KG_PRICE: Record<ShoppingCategory, number> = {
  'پروتئین و تخم‌مرغ': 320000,
  'خشکبار و مغزها': 650000,
  'ادویه و معطرها': 350000,
  'لبنیات': 150000,
  'روغن و چربی‌ها': 150000,
  'چاشنی و رب‌ها': 140000,
  'غلات و آرد': 125000,
  'حبوبات': 135000,
  'میوه و دانه‌ها': 130000,
  'سبزیجات و صیفی‌جات': 48000,
  'سایر مواد': 110000,
};

function estimateSingleIngredientToman(item: IngredientItem): number {
  const normName = normalizePersian(item.name);
  const normUnit = normalizePersian(item.unit || '');
  const amount = Math.max(0.1, Number(item.amount) || 1);

  const rule = INGREDIENT_PRICE_RULES.find((r) => r.pattern.test(normName));
  const category = item.category || classifyIngredientCategory(item.name);
  const pricePerKg = rule?.pricePerKg ?? CATEGORY_FALLBACK_KG_PRICE[category] ?? 110000;

  // Special handling for brewed saffron (زعفران دم‌کرده) measured in spoons
  if (normName.includes('زعفران') && /(قاشق|پیمانه)/.test(normUnit)) {
    return Math.round(amount * 24000);
  }

  if (/(کیلو|کیلوگرم|لیتر)/.test(normUnit)) {
    return Math.round(amount * pricePerKg);
  }
  if (/(گرم|میلی)/.test(normUnit)) {
    return Math.round((amount / 1000) * pricePerKg);
  }
  if (/(پیمانه|لیوان)/.test(normUnit)) {
    const kgEquivalent = category === 'سبزیجات و صیفی‌جات' ? 0.08 : 0.17;
    return Math.round(amount * kgEquivalent * pricePerKg);
  }
  if (/(قاشق غذاخوری|قاشق سوپ|قاشق)/.test(normUnit)) {
    const isTea = /(چای|مربا)/.test(normUnit);
    const kgEquivalent = isTea ? 0.006 : 0.018;
    return Math.round(amount * kgEquivalent * pricePerKg);
  }
  if (/(حبه)/.test(normUnit)) {
    return Math.round(amount * (rule?.pricePerPiece ?? 3500));
  }
  if (/(بسته|دسته|تکه|شاخه)/.test(normUnit)) {
    return Math.round(amount * Math.min(pricePerKg * 0.28, 65000));
  }
  if (/(مقدار لازم|دلخواه|کمی)/.test(normUnit)) {
    return 4500;
  }

  // Default piece-based unit (عدد, etc.)
  const piecePrice = rule?.pricePerPiece ?? Math.round(pricePerKg * 0.14);
  return Math.round(amount * piecePrice);
}

/**
 * Computes estimated ingredient cost in Toman and economical tier based on
 * average Iranian market ingredient prices.
 */
export function estimateRecipeCost(ingredients: IngredientItem[], servings = 4): RecipeEstimatedCost {
  const safeServings = Math.max(1, Number(servings) || 4);
  const rawTotal = (ingredients || []).reduce((sum, item) => sum + estimateSingleIngredientToman(item), 0);
  const totalToman = Math.max(25000, Math.round(rawTotal / 5000) * 5000);
  const perServingToman = Math.max(10000, Math.round(totalToman / safeServings / 1000) * 1000);

  if (perServingToman <= 90000) {
    return {totalToman, perServingToman, tier: 'اقتصادی', level: 1};
  }
  if (perServingToman <= 150000) {
    return {totalToman, perServingToman, tier: 'متوسط', level: 2};
  }
  return {totalToman, perServingToman, tier: 'مجلسی', level: 3};
}

export function computeUserLevel(xp: number): {levelName: string; nextLevelXp: number} {
  if (xp >= 1200) return {levelName: 'استاد آشپزی لاقلی', nextLevelXp: 2000};
  if (xp >= 700) return {levelName: 'سرآشپز خلاق', nextLevelXp: 1200};
  if (xp >= 350) return {levelName: 'کدبانو و آشپز فعال', nextLevelXp: 700};
  if (xp >= 120) return {levelName: 'همراه پرانرژی', nextLevelXp: 350};
  return {levelName: 'آشپز تازه‌کار', nextLevelXp: 120};
}

interface SubstitutionEntry {
  keywords: string[];
  suggestions: Omit<SubstitutionSuggestion, 'source'>[];
}

const SUBSTITUTION_DICTIONARY: SubstitutionEntry[] = [
  {
    keywords: ['ماست', 'ماست چکیده', 'ماست یونانی'],
    suggestions: [
      {
        substitute: 'خامه ترش یا پنیر خامه‌ای رقیق‌شده با شیر',
        ratio: '۱ پیمانه به‌ازای ۱ پیمانه',
        flavorNote: 'بافت لطیف و کرمی مشابه ایجاد می‌کند؛ برای ته‌چین فوق‌العاده است.',
        compatibility: 94,
        category: 'لبنیات',
        isVegan: false,
      },
      {
        substitute: 'ماست سویا یا بادام بدون قند',
        ratio: '۱ به ۱ با چند قطره آبلیمو',
        flavorNote: 'جایگزین کاملاً گیاهی با اسیدیته متعادل.',
        compatibility: 88,
        category: 'لبنیات',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['زعفران', 'زعفران دم کرده'],
    suggestions: [
      {
        substitute: 'ترکیب زردچوبه و مقدار کمی گلاب',
        ratio: 'ربع قاشق چای‌خوری زردچوبه + ۱ قاشق چای‌خوری گلاب',
        flavorNote: 'رنگ طلایی نزدیک به زعفران با عطر ایرانی ملایم ایجاد می‌کند.',
        compatibility: 78,
        category: 'ادویه و معطرها',
        isVegan: true,
      },
      {
        substitute: 'گلرنگ دم‌کرده',
        ratio: '۲ برابر مقدار زعفران',
        flavorNote: 'رنگ طبیعی زیبا بدون تلخی، اما عطر ملایم‌تری نسبت به زعفران دارد.',
        compatibility: 84,
        category: 'ادویه و معطرها',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['رب انار', 'انار'],
    suggestions: [
      {
        substitute: 'ترکیب رب آلوچه و شیره خرما یا عسل',
        ratio: '۲ قاشق رب آلوچه + ۱ قاشق شیره خرما',
        flavorNote: 'طعم ملس و رنگ تیره مشابه فسنجان اصیل می‌سازد.',
        compatibility: 91,
        category: 'چاشنی و رب‌ها',
        isVegan: true,
      },
      {
        substitute: 'سرکه بالزامیک غلیظ‌شده با شکر قهوه‌ای',
        ratio: '۳ قاشق بالزامیک + ۱ قاشق چای‌خوری شکر',
        flavorNote: 'اسیدیته شیرین و غلظت مناسب برای خورشت‌ها و سس‌ها.',
        compatibility: 82,
        category: 'چاشنی و رب‌ها',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['کشک', 'کشک مایع'],
    suggestions: [
      {
        substitute: 'ماست چکیده غلیظ + کمی نمک و نعناداغ',
        ratio: '۱ پیمانه ماست چکیده + نصف قاشق چای‌خوری نمک',
        flavorNote: 'بافت مخملی و ترشی ملایم‌تر نسبت به کشک سنتی برای آش رشته.',
        compatibility: 89,
        category: 'لبنیات',
        isVegan: false,
      },
      {
        substitute: 'پوره بادام هندی خیس‌خورده با آبلیمو و مخمر تغذیه‌ای',
        ratio: 'نصف پیمانه بادام هندی میکس‌شده با آب گرم',
        flavorNote: 'جایگزین غلیظ، وگان و بسیار خوش‌طعم برای تزیین آش.',
        compatibility: 85,
        category: 'خشکبار و مغزها',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['مغز گردو', 'گردو'],
    suggestions: [
      {
        substitute: 'مغز فندق یا بادام درختی بوداده',
        ratio: '۱ به ۱ (آسیاب‌شده)',
        flavorNote: 'روغن‌اندازی ملایم‌تر و طعم شیرین‌تر و مجلسی‌تر ایجاد می‌کند.',
        compatibility: 87,
        category: 'خشکبار و مغزها',
        isVegan: true,
      },
      {
        substitute: 'تخمه آفتابگردان خام بوداده و آسیاب‌شده',
        ratio: '۱ به ۱',
        flavorNote: 'جایگزین اقتصادی و ضدآلرژی با چربی طبیعی مناسب برای خورشت.',
        compatibility: 79,
        category: 'خشکبار و مغزها',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['تخم مرغ', 'تخم‌مرغ'],
    suggestions: [
      {
        substitute: 'پوره دانه چیا یا بذر کتان خیس‌خورده',
        ratio: '۱ قاشق غذاخوری بذر + ۳ قاشق آب ولرم (به‌ازای هر تخم‌مرغ)',
        flavorNote: 'چسبندگی عالی در کوکوها، کیک‌ها و ته‌چین گیاهی ایجاد می‌کند.',
        compatibility: 90,
        category: 'میوه و دانه‌ها',
        isVegan: true,
      },
      {
        substitute: 'ماست چکیده یا آرد نخودچی',
        ratio: '۲ قاشق غذاخوری به‌ازای هر تخم‌مرغ',
        flavorNote: 'مناسب برای انسجام‌بخشی در کتلت و کوکوهای سنتی.',
        compatibility: 84,
        category: 'حبوبات',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['کره', 'کره حیوانی'],
    suggestions: [
      {
        substitute: 'روغن زیتون فرابکر ملایم یا روغن کنجد',
        ratio: 'سه‌چهارم مقدار کره',
        flavorNote: 'سبک‌تر و سالم‌تر برای پلوها و تفت دادن سبزیجات.',
        compatibility: 92,
        category: 'روغن و چربی‌ها',
        isVegan: true,
      },
      {
        substitute: 'روغن حیوانی (کرمانشاهی)',
        ratio: 'سه‌چهارم مقدار کره',
        flavorNote: 'عطر اصیل و ماندگارتر در غذاهای سنتی و مجلسی ایرانی.',
        compatibility: 96,
        category: 'روغن و چربی‌ها',
        isVegan: false,
      },
    ],
  },
  {
    keywords: ['شوید', 'شوید تازه'],
    suggestions: [
      {
        substitute: 'شوید خشک معطر',
        ratio: '۱ قاشق غذاخوری شوید خشک به‌ازای ۳ قاشق تازه',
        flavorNote: 'بهتر است ۵ دقیقه در آب ولرم خیس شود تا رنگ سبز زنده بماند.',
        compatibility: 95,
        category: 'سبزیجات و صیفی‌جات',
        isVegan: true,
      },
      {
        substitute: 'ترخون و جعفری تازه',
        ratio: '۱ به ۱',
        flavorNote: 'عطر گیاهی متفاوت اما بسیار خوشایند کنار باقالی و برنج.',
        compatibility: 80,
        category: 'سبزیجات و صیفی‌جات',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['زرشک'],
    suggestions: [
      {
        substitute: 'کرنبری خشک یا آلبالو خشک ریزشده',
        ratio: '۱ به ۱ با چند قطره آبلیمو',
        flavorNote: 'ترشی و رنگ یاقوتی نزدیک به زرشک برای تزیین پلو و ته‌چین.',
        compatibility: 88,
        category: 'میوه و دانه‌ها',
        isVegan: true,
      },
      {
        substitute: 'دانه انار ترش تازه',
        ratio: '۱ به ۱ (در مرحله سرو)',
        flavorNote: 'بافت ترد و تازگی ادیتوریال فوق‌العاده هنگام سرو غذا.',
        compatibility: 86,
        category: 'میوه و دانه‌ها',
        isVegan: true,
      },
    ],
  },
  {
    keywords: ['سینه مرغ', 'مرغ', 'گوشت', 'ماهیچه'],
    suggestions: [
      {
        substitute: 'قارچ شاه‌صدفی یا قارچ پورتوبلو گریل‌شده',
        ratio: '۱٫۲ برابر وزن گوشت',
        flavorNote: 'بافت گوشتی، اومامی طبیعی و مناسب برای نسخه گیاهی غذاها.',
        compatibility: 86,
        category: 'سبزیجات و صیفی‌جات',
        isVegan: true,
      },
      {
        substitute: 'سینه بوقلمون یا توفوی سفت مرینیت‌شده',
        ratio: '۱ به ۱',
        flavorNote: 'پروتئین بالا با جذب عالی ادویه‌های ایرانی.',
        compatibility: 91,
        category: 'پروتئین و تخم‌مرغ',
        isVegan: false,
      },
    ],
  },
];

export function findNativeSubstitutions(
  ingredientQuery: string,
  source: 'native' | 'offline' = 'native'
): SubstitutionSuggestion[] {
  const norm = normalizePersian(ingredientQuery);
  if (!norm) return [];

  for (const entry of SUBSTITUTION_DICTIONARY) {
    if (entry.keywords.some((k) => norm.includes(normalizePersian(k)) || normalizePersian(k).includes(norm))) {
      return entry.suggestions.map((s) => ({...s, source}));
    }
  }

  // Category-based intelligent fallback (never empty!)
  const detectedCategory = classifyIngredientCategory(ingredientQuery);
  const categoryFallbacks: Record<ShoppingCategory, Omit<SubstitutionSuggestion, 'source'>[]> = {
    'سبزیجات و صیفی‌جات': [
      {
        substitute: 'نسخه خشک معطر یا سبزی هم‌خانواده فصل',
        ratio: 'یک‌سوم مقدار در صورت استفاده از نوع خشک',
        flavorNote: 'برای حفظ عطر، در ۱۰ دقیقه پایانی پخت اضافه شود.',
        compatibility: 78,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'لبنیات': [
      {
        substitute: 'ماست چکیده یا شیر گیاهی غنی‌شده',
        ratio: '۱ به ۱',
        flavorNote: 'بافت نرم و ملایم مشابه در سس‌ها و خمیرها ایجاد می‌کند.',
        compatibility: 80,
        category: detectedCategory,
        isVegan: false,
      },
    ],
    'ادویه و معطرها': [
      {
        substitute: 'ادویه کاری ملایم یا ترکیب دارچین و فلفل سیاه',
        ratio: 'نصف مقدار اولیه و تنظیم تدریجی',
        flavorNote: 'گرما و عطر متعادل بدون غلبه بر طعم اصلی غذا.',
        compatibility: 76,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'چاشنی و رب‌ها': [
      {
        substitute: 'آبلیموی تازه یا آبغوره خانگی',
        ratio: '۲ قاشق غذاخوری و تنظیم بر اساس ذائقه',
        flavorNote: 'اسیدیته تمیز و متعادل برای تکمیل طعم غذا.',
        compatibility: 79,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'پروتئین و تخم‌مرغ': [
      {
        substitute: 'حبوبات پخته (نخود یا عدس) یا قارچ تفت‌داده‌شده',
        ratio: '۱ به ۱',
        flavorNote: 'تامین پروتئین و بافت رضایت‌بخش در غذاهای ایرانی.',
        compatibility: 80,
        category: 'حبوبات',
        isVegan: true,
      },
    ],
    'خشکبار و مغزها': [
      {
        substitute: 'بادام یا تخمه آفتابگردان بوداده',
        ratio: '۱ به ۱',
        flavorNote: 'تردی و چربی طبیعی مشابه برای خورشت‌ها و تزیین.',
        compatibility: 82,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'روغن و چربی‌ها': [
      {
        substitute: 'روغن زیتون ملایم یا روغن کنجد',
        ratio: '۱ به ۱',
        flavorNote: 'مقاومت حرارتی مناسب و طعم سبک و سالم.',
        compatibility: 90,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'حبوبات': [
      {
        substitute: 'لپه یا عدس پخته',
        ratio: '۱ به ۱',
        flavorNote: 'زمان پخت سریع‌تر و لعاب مناسب در آش و خورشت.',
        compatibility: 81,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'غلات و آرد': [
      {
        substitute: 'آرد برنج یا بلغور جو دوسر آسیاب‌شده',
        ratio: '۱ به ۱',
        flavorNote: 'بافت لطیف و گزینه مناسب برای رژیم بدون گلوتن.',
        compatibility: 80,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'میوه و دانه‌ها': [
      {
        substitute: 'کشمش پلویی یا برگه آلوچه خردشده',
        ratio: '۱ به ۱',
        flavorNote: 'تعادل شیرینی و ترشی طبیعی در پلوها و خورشت‌ها.',
        compatibility: 81,
        category: detectedCategory,
        isVegan: true,
      },
    ],
    'سایر مواد': [
      {
        substitute: 'ماده هم‌طعم تازه و فصلی در دسترس آشپزخانه',
        ratio: '۱ به ۱ با تنظیم چاشنی',
        flavorNote: 'بهتر است پیش از افزودن کامل، میزان نمک و ترشی غذا چشیده شود.',
        compatibility: 74,
        category: 'سایر مواد',
        isVegan: true,
      },
    ],
  };

  return categoryFallbacks[detectedCategory].map((s) => ({...s, source}));
}
