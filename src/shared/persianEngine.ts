import type {PartnerRoleId, ShoppingCategory, SubstitutionSuggestion} from './types.ts';

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
